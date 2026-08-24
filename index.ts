/**
 * API Gateway Plugin for Pi
 * 
 * 入口文件 - 启动拦截部分和网关服务
 */

import type { ExtensionAPI } from "./src/types.js";
import { loadConfig, saveConfig } from "./src/config.js";
import { GatewayServer } from "./src/gateway/server.js";
import { showMainMenu } from "./src/intercept/ui/main-menu.js";
import { handleVirtualSupplierRequest } from "./src/intercept/event-stream-handler.js";

let server: GatewayServer | null = null;

export default function (pi: ExtensionAPI) {
  const config = loadConfig();

  // 注册虚拟供应商（扩展加载时，会话恢复之前）
  registerVirtualSuppliers(pi, config);

  // 启动网关（仅当选择虚拟供应商时）
  pi.on("session_start", async (_event, ctx) => {
    // 检查当前选择的供应商是否是虚拟供应商
    const currentModel = ctx.model;
    const isVirtualSupplier = currentModel && Object.keys(config.virtualSuppliers).some(
      vsName => currentModel.provider === `local-gateway-${vsName}`
    );
    
    if (isVirtualSupplier) {
      console.log("[Gateway] 当前使用虚拟供应商，启动网关");
      server = new GatewayServer(config);
      await server.start();
      registerVirtualSuppliers(pi, config);
      ctx.ui.notify(`API 网关已启动: http://localhost:${config.port}`, "info");
    } else {
      console.log("[Gateway] 当前使用正常供应商，网关不启动");
    }
  });

  // 停止网关
  pi.on("session_shutdown", async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  // 注册命令
  pi.registerCommand("gateway", {
    description: "API 网关管理 · 配置虚拟供应商和真实供应商",
    handler: async (_args, ctx) => {
      const config = loadConfig();
      await showMainMenu(pi, ctx, config);
      saveConfig(config);
      // 重新注册虚拟供应商
      registerVirtualSuppliers(pi, config);
    },
  });
}

/**
 * 注册虚拟供应商到 Pi
 */
function registerVirtualSuppliers(pi: ExtensionAPI, config: any): void {
  for (const [vsName, vs] of Object.entries(config.virtualSuppliers as Record<string, any>)) {
    const models = Object.entries(vs.routes).map(([id, route]: [string, any]) => ({
      id,
      name: route.model,
      reasoning: false,
      input: ["text"] as ("text" | "image")[],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: config.realProviders?.[route.provider]?.contextWindow ?? 128000,
      maxTokens: 16384,
    }));

    pi.registerProvider(`local-gateway-${vsName}`, {
      name: `网关 (${vsName})`,
      baseUrl: `http://localhost:${config.port}`,
      apiKey: "key_114514",
      api: "openai-completions",
      models,
      streamSimple: async (model: any, context: any, options: any) => {
      return await handleVirtualSupplierRequest(vsName, config, model.id, context.messages, true);
    },
    });
  }
}


