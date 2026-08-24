/**
 * Gateway Server - 纯工具人，只负责转发
 * 
 * 职责：
 * - 接收请求
 * - 根据 virtualSupplier 查规则
 * - 转发到真实供应商
 * - 流式返回结果
 */

import * as http from "node:http";
import * as https from "node:https";
import * as fs from "node:fs";
import * as path from "node:path";
import { recordStats } from "./stats.js";

const CONFIG_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".pi",
  "agent",
  "gateway"
);
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// 连接池
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
});

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

export class GatewayServer {
  private server: http.Server | null = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      let port = this.config.port;
      let attempts = 0;
      const maxAttempts = 10;

      const tryListen = () => {
        if (attempts >= maxAttempts) {
          reject(new Error(`无法找到可用端口，已尝试 ${maxAttempts} 个端口`));
          return;
        }

        const server = http.createServer((req, res) => {
          this.handleRequest(req, res);
        });

        server.listen(port, () => {
          this.server = server;
          this.config.port = port;
          console.log(`[Gateway] 监听端口: ${port}`);
          resolve();
        });

        server.on("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "EADDRINUSE") {
            console.log(`[Gateway] 端口 ${port} 被占用，尝试 ${port + 1}`);
            server.close();
            port++;
            attempts++;
            tryListen();
          } else {
            reject(err);
          }
        });
      };

      tryListen();
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    const body = await this.readBody(req);

    try {
      const requestData = JSON.parse(body);
      const { virtualSupplier, model, messages, stream } = requestData;

      if (!virtualSupplier || !model) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing virtualSupplier or model" }));
        return;
      }

      // 重新加载配置（支持热更新）
      cachedConfig = null;
      const config = loadConfig();

      // 查找虚拟供应商
      const vs = config.virtualSuppliers[virtualSupplier];
      if (!vs) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Unknown virtual supplier: ${virtualSupplier}` }));
        return;
      }

      // 查找路由
      const route = vs.routes[model];
      if (!route) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Unknown model: ${model} in ${virtualSupplier}` }));
        return;
      }

      // 查找真实供应商
      const realProvider = config.realProviders[route.provider];
      if (!realProvider) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Real provider not configured: ${route.provider}` }));
        return;
      }

      // 构建转发请求
      const targetUrl = `${realProvider.baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;
      const forwardBody = {
        model: route.model,
        messages,
        stream: stream ?? true,
      };

      // 转发请求（流式）
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${realProvider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(forwardBody),
        agent: targetUrl.startsWith("https") ? httpsAgent : undefined,
      });

      // 设置响应头
      res.writeHead(response.status, {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Transfer-Encoding": "chunked",
      });

      // 流式转发
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

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks).toString()));
      req.on("error", reject);
    });
  }
}
