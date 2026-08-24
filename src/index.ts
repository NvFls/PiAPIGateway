/**
 * API Gateway Plugin for Pi
 * 
 * 本地 AI 中转站 + 管理界面
 * 支持 OpenAI 格式，可扩展到 Anthropic/Google
 */

import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "./types.js";
import { GatewayServer } from "./gateway-server.js";
import { loadConfig, saveConfig } from "./config.js";
import { loadStats, saveStats } from "./stats.js";
import { showMainMenu } from "./ui/main-menu.js";

let server: GatewayServer | null = null;

/**
 * 注册/重新注册网关供应商到 Pi
 */
function registerGatewayProvider(pi: ExtensionAPI): void {
  const config = loadConfig();

  // 按供应商分组路由
  const providerRoutes: Record<string, Array<{ id: string; name: string; model: string }>> = {};
  for ([id, route] of Object.entries(config.routes)) {
    if (!providerRoutes[route.provider]) {
      providerRoutes[route.provider] = [];
    }
    providerRoutes[route.provider].push({
      id,
      name: route.model,
      model: route.model,
    });
  }

  // 为每个供应商注册一个虚拟供应商
  for (const [providerName, routes] of Object.entries(providerRoutes)) {
    const providerConfig = config.providers[providerName];
    
    pi.registerProvider(`local-gateway-${providerName}`, {
      name: `本地网关 (${providerName})`,
      baseUrl: `http://localhost:${config.port}`,
      apiKey: "key_114514",
      api: "openai-completions",
      models: routes.map(r => ({
        id: r.id,
        name: r.name,
        reasoning: false,
        input: ["text"] as ("text" | "image")[],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: providerConfig?.contextWindow ?? 128000,
        maxTokens: 16384,
      })),
    });
  }

  // 如果没有路由，注册一个占位供应商
  if (Object.keys(providerRoutes).length === 0) {
    pi.registerProvider("local-gateway", {
      name: "本地网关",
      baseUrl: `http://localhost:${config.port}`,
      apiKey: "key_114514",
      api: "openai-completions",
      models: [{
        id: "_setup_required",
        name: "⚠️ 需要配置 - 运行 /gateway 添加供应商和路由",
        reasoning: false,
        input: ["text"] as ("text" | "image")[],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 16384,
      }],
    });
  }
}

export default function (pi: ExtensionAPI) {
  const config = loadConfig();

  // ===== 注册供应商到 Pi（扩展加载时）=====
  registerGatewayProvider(pi);

  // ===== 启动中转站 =====
  pi.on("session_start", async (_event, ctx) => {
    // 如果配置了自动启动，或者之前正在运行
    if (config.autoStart || config.wasRunning) {
      server = new GatewayServer(config);
      await server.start();
      // 重新注册供应商（端口可能已更改）
      registerGatewayProvider(pi);
      ctx.ui.notify(`API 网关已启动: http://localhost:${config.port}`, "info");
    }
  });

  // ===== 停止中转站 =====
  pi.on("session_shutdown", async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  // ===== 注册命令 =====
  pi.registerCommand("gateway", {
    description: "API 网关管理 · 配置供应商、路由、查看统计",
    handler: async (_args, ctx) => {
      const config = loadConfig();
      await showMainMenu(pi, ctx, config);
      saveConfig(config);
      // 重新注册供应商（可能添加了新路由）
      registerGatewayProvider(pi);
    },
  });
}
