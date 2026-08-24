/**
 * Gateway Server - HTTP 服务器（中转站）
 * 
 * 接收 Pi 的请求，转发到真实供应商，统计 token/价格/缓存
 */

import * as http from "node:http";
import * as https from "node:https";
import type { GatewayConfig } from "./types.js";
import { recordStats } from "./stats.js";

// 连接池 - 保持长连接，减少首token延迟
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 60000,
});

export class GatewayServer {
  private server: http.Server | null = null;
  private config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      // 尝试启动，如果端口被占用则自动换端口
      const tryPort = (port: number) => {
        this.server!.listen(port, () => {
          // 更新配置中的端口
          this.config.port = port;
          console.log(`[Gateway] 监听端口: ${port}`);
          resolve();
        });

        this.server!.on("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "EADDRINUSE") {
            console.log(`[Gateway] 端口 ${port} 被占用，尝试 ${port + 1}`);
            tryPort(port + 1);
          } else {
            reject(err);
          }
        });
      };

      tryPort(this.config.port);
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
    // 只处理 POST 请求
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    // 读取请求体
    const body = await this.readBody(req);

    try {
      const requestData = JSON.parse(body);
      const modelId = requestData.model;

      if (!modelId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing model" }));
        return;
      }

      // 直接查找路由配置（不解析模型 ID）
      const route = this.config.routes[modelId];
      if (!route) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Unknown model: ${modelId}` }));
        return;
      }

      // 获取供应商配置
      const provider = this.config.providers[route.provider];
      if (!provider) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Provider not configured: ${route.provider}` }));
        return;
      }

      // 构建转发请求
      const targetUrl = `${provider.baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;
      const forwardBody = {
        ...requestData,
        model: route.model,
      };

      // 转发请求（流式）
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${provider.apiKey}`,
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

      // 流式转发响应
      const reader = response.body?.getReader();
      if (!reader) {
        res.end(JSON.stringify({ error: "No response body" }));
        return;
      }

      let statsRecorded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // 记录统计（简化版）
          if (!statsRecorded) {
            recordStats({
              provider: route.provider,
              model: route.model,
              inputTokens: 0,
              outputTokens: 0,
              cachedTokens: 0,
            });
          }
          break;
        }

        // 转发数据块
        res.write(value);
        statsRecorded = true;
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
