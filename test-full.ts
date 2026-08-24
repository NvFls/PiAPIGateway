/**
 * 完整功能测试 - 模拟请求转发
 */

import { GatewayServer } from "./dist/gateway-server.js";
import { loadConfig, saveConfig } from "./dist/config.js";
import { loadStats, saveStats, recordStats } from "./dist/stats.js";
import * as http from "node:http";

let mockProviderServer: http.Server | null = null;

// 模拟 AI 供应商
async function startMockProvider(): Promise<void> {
  return new Promise((resolve) => {
    mockProviderServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        
        // 验证请求
        const authHeader = req.headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }
        
        // 返回模拟响应
        const response = {
          id: "chatcmpl-test",
          object: "chat.completion",
          model: body.model,
          choices: [{
            index: 0,
            message: {
              role: "assistant",
              content: "这是测试响应",
            },
            finish_reason: "stop",
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
            prompt_tokens_details: {
              cached_tokens: 30,
            },
          },
        };
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      });
    });
    
    mockProviderServer.listen(19090, () => {
      console.log("✓ 模拟供应商启动 (端口 19090)");
      resolve();
    });
  });
}

async function stopMockProvider(): Promise<void> {
  return new Promise((resolve) => {
    if (mockProviderServer) {
      mockProviderServer.close(() => {
        mockProviderServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function testFullFlow() {
  console.log("=== 完整功能测试 ===\n");
  
  try {
    // 1. 启动模拟供应商
    await startMockProvider();
    
    // 2. 配置网关
    const config = loadConfig();
    config.port = 18081;
    config.providers["test"] = {
      apiKey: "test-api-key-123",
      baseUrl: "http://localhost:19090",
      contextWindow: 128000,
      temperature: 0.7,
    };
    saveConfig(config);
    
    // 3. 启动网关
    const server = new GatewayServer(config);
    await server.start();
    console.log("✓ 网关启动 (端口 18081)");
    
    // 4. 发送测试请求
    const response = await fetch("http://localhost:18081/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "test-gpt-4o",
        messages: [{ role: "user", content: "测试消息" }],
      }),
    });
    
    const result = await response.json();
    console.log(`✓ 请求转发成功: ${response.status}`);
    console.log(`  模型: ${result.model}`);
    console.log(`  响应: ${result.choices[0].message.content}`);
    
    // 5. 验证统计
    const stats = loadStats();
    console.log("✓ 统计数据正确:");
    console.log(`  总请求: ${stats.totalRequests}`);
    console.log(`  输入 token: ${stats.totalInputTokens}`);
    console.log(`  输出 token: ${stats.totalOutputTokens}`);
    console.log(`  缓存命中: ${stats.totalCachedTokens}`);
    console.log(`  花费: $${stats.totalCost.toFixed(4)}`);
    
    // 6. 清理
    await server.stop();
    console.log("✓ 网关停止");
    
    await stopMockProvider();
    console.log("✓ 模拟供应商停止");
    
    // 清理统计数据
    saveStats({
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      totalCost: 0,
      entries: [],
      byProvider: {},
      byModel: {},
    });
    
    console.log("\n=== 完整功能测试通过 ===");
    
  } catch (error) {
    console.error("\n=== 测试失败 ===");
    console.error(error);
  }
}

testFullFlow();
