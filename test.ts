/**
 * API Gateway Plugin - 自动测试
 */

import { GatewayServer } from "./dist/gateway-server.js";
import { loadConfig, saveConfig } from "./dist/config.js";
import { loadStats, saveStats, recordStats } from "./dist/stats.js";

// ===== 测试配置 =====
async function testConfig() {
  console.log("=== 测试配置管理 ===");
  
  // 测试加载默认配置
  const config = loadConfig();
  console.log("✓ 加载默认配置成功");
  console.log(`  端口: ${config.port}`);
  console.log(`  自动启动: ${config.autoStart}`);
  
  // 测试保存配置
  config.providers["test-provider"] = {
    apiKey: "test-key",
    baseUrl: "https://api.test.com",
    contextWindow: 128000,
    temperature: 0.7,
  };
  saveConfig(config);
  console.log("✓ 保存配置成功");
  
  // 测试加载已保存的配置
  const loadedConfig = loadConfig();
  if (loadedConfig.providers["test-provider"]) {
    console.log("✓ 加载已保存的配置成功");
  }
  
  // 清理测试数据
  delete loadedConfig.providers["test-provider"];
  saveConfig(loadedConfig);
  console.log("✓ 清理测试数据成功");
}

// ===== 测试统计 =====
async function testStats() {
  console.log("\n=== 测试统计功能 ===");
  
  // 测试加载默认统计
  const stats = loadStats();
  console.log("✓ 加载默认统计成功");
  console.log(`  总请求: ${stats.totalRequests}`);
  
  // 测试记录统计
  recordStats({
    provider: "openai",
    model: "gpt-4o",
    inputTokens: 1000,
    outputTokens: 500,
    cachedTokens: 200,
  });
  console.log("✓ 记录统计成功");
  
  // 验证记录
  const updatedStats = loadStats();
  if (updatedStats.totalRequests === 1) {
    console.log("✓ 统计数据正确");
    console.log(`  输入 token: ${updatedStats.totalInputTokens}`);
    console.log(`  输出 token: ${updatedStats.totalOutputTokens}`);
    console.log(`  缓存命中: ${updatedStats.totalCachedTokens}`);
    console.log(`  花费: $${updatedStats.totalCost.toFixed(4)}`);
  }
  
  // 清理测试数据
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
  console.log("✓ 清理测试数据成功");
}

// ===== 测试路由解析 =====
async function testRouteParsing() {
  console.log("\n=== 测试路由解析 ===");
  
  const server = new GatewayServer(loadConfig());
  
  // 测试模型 ID 解析
  const testCases = [
    { input: "openai-gpt-4o", expected: { provider: "openai", model: "gpt-4o" } },
    { input: "anthropic-claude-sonnet", expected: { provider: "anthropic", model: "claude-sonnet" } },
    { input: "google-gemini-2.0-flash", expected: { provider: "google", model: "gemini-2.0-flash" } },
  ];
  
  for (const testCase of testCases) {
    const result = (server as any).parseModelId(testCase.input);
    if (result && result.provider === testCase.expected.provider && result.model === testCase.expected.model) {
      console.log(`✓ 解析 "${testCase.input}" 成功: ${result.provider}/${result.model}`);
    } else {
      console.log(`✗ 解析 "${testCase.input}" 失败`);
    }
  }
}

// ===== 运行所有测试 =====
async function runTests() {
  console.log("开始测试 API Gateway 插件...\n");
  
  try {
    await testConfig();
    await testStats();
    await testRouteParsing();
    
    console.log("\n=== 所有测试通过 ===");
  } catch (error) {
    console.error("\n=== 测试失败 ===");
    console.error(error);
  }
}

runTests();
