/**
 * Gateway Server - 独立进程运行
 */

import * as http from "node:http";
import * as https from "node:https";
import * as fs from "node:fs";
import * as path from "node:path";

const CONFIG_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".pi",
  "agent",
  "gateway"
);
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const PORT_FILE = path.join(CONFIG_DIR, "port.txt");

interface RouteConfig {
  provider: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
}

interface RealProviderConfig {
  apiKey: string;
  baseUrl: string;
  contextWindow: number;
  temperature: number;
}

interface Config {
  virtualSuppliers: Record<string, { routes: Record<string, RouteConfig> }>;
  realProviders: Record<string, RealProviderConfig>;
  port: number;
}

let cachedConfig: Config | null = null;

function loadConfig(): Config {
  if (cachedConfig) return cachedConfig;
  
  try {
    const data = fs.readFileSync(CONFIG_FILE, "utf-8");
    cachedConfig = JSON.parse(data);
    return cachedConfig!;
  } catch {
    return { virtualSuppliers: {}, realProviders: {}, port: 18081 };
  }
}

// 连接池
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
});

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const body = await readBody(req);

  try {
    const requestData = JSON.parse(body);
    const { virtualSupplier, model, messages, stream } = requestData;

    if (!virtualSupplier || !model) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing virtualSupplier or model" }));
      return;
    }

    cachedConfig = null;
    const config = loadConfig();

    const vs = config.virtualSuppliers[virtualSupplier];
    if (!vs) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Unknown virtual supplier: ${virtualSupplier}` }));
      return;
    }

    const route = vs.routes[model];
    if (!route) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Unknown model: ${model} in ${virtualSupplier}` }));
      return;
    }

    const realProvider = config.realProviders[route.provider];
    if (!realProvider) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Real provider not configured: ${route.provider}` }));
      return;
    }

    const targetUrl = `${realProvider.baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;
    const forwardBody = {
      model: route.model,
      messages,
      stream: stream ?? true,
    };

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${realProvider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(forwardBody),
      agent: targetUrl.startsWith("https") ? httpsAgent : undefined,
    });

    if (!response.ok) {
      res.writeHead(response.status, { "Content-Type": "application/json" });
      res.end(await response.text());
      return;
    }

    res.writeHead(response.status, {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
      "Transfer-Encoding": "chunked",
    });

    const reader = response.body?.getReader();
    if (!reader) {
      res.end(JSON.stringify({ error: "No response body" }));
      return;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }

    res.end();

  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }));
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

async function start(): Promise<void> {
  const config = loadConfig();
  let port = config.port;
  let attempts = 0;
  const maxAttempts = 100;

  const tryListen = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (attempts >= maxAttempts) {
        reject(new Error(`无法找到可用端口，已尝试 ${maxAttempts} 个端口`));
        return;
      }

      const server = http.createServer(handleRequest);

      server.listen(port, "127.0.0.1", () => {
        console.log(`[Gateway] 监听端口: ${port}`);
        
        // 写入端口文件
        try {
          fs.writeFileSync(PORT_FILE, String(port), "utf-8");
        } catch (err) {
          console.error(`[Gateway] 写入端口文件失败: ${err}`);
        }
        
        resolve();
      });

      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          port++;
          attempts++;
          tryListen().then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  };

  await tryListen();
}

// 启动网关
start().catch((err) => {
  console.error(`[Gateway] 启动失败: ${err}`);
  process.exit(1);
});
