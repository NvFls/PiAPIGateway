/**
 * HTTP 服务器测试
 */

import { GatewayServer } from "./dist/gateway-server.js";
import { loadConfig, saveConfig } from "./dist/config.js";

async function testHttpServer() {
  console.log("=== 测试 HTTP 服务器 ===");
  
  const config = loadConfig();
  config.port = 18080; // 使用测试端口
  
  // 添加测试供应商
  config.providers["test"] = {
    apiKey: "test-key",
    baseUrl: "http://localhost:19090", // 模拟供应商
    contextWindow: 128000,
    temperature: 0.7,
  };
  
  const server = new GatewayServer(config);
  
  try {
    await server.start();
    console.log("✓ 服务器启动成功");
    
    // 测试健康检查
    const healthResponse = await fetch("http://localhost:18080/health");
    console.log(`✓ 健康检查: ${healthResponse.status}`);
    
    // 测试模型列表
    const modelsResponse = await fetch("http://localhost:18080/v1/models");
    console.log(`✓ 模型列表: ${modelsResponse.status}`);
    
    await server.stop();
    console.log("✓ 服务器停止成功");
    
  } catch (error) {
    console.error("✗ 测试失败:", error);
  }
}

testHttpServer();
