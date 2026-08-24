/**
 * Intercept - Pi 拦截部分
 * 
 * 职责：
 * - 监听 model_select 事件
 * - 注册虚拟供应商（自定义 streamSimple）
 * - 构建自定义请求发给网关
 */

import type { ExtensionAPI } from "../types.js";
import { GatewayServer } from "../gateway/server.js";
import { loadConfig, saveConfig, getConfigDir } from "../config.js";
import { showMainMenu } from "./ui/main-menu.js";

let server: GatewayServer | null = null;

/**
 * 注册虚拟供应商到 Pi
 */
function registerVirtualSuppliers(pi: ExtensionAPI): void {
  const config = loadConfig();

  for (const [vsName, vs] of Object.entries(config.virtualSuppliers)) {
    const models = Object.entries(vs.routes).map(([id, route]) => ({
      id,
      name: route.model,
      reasoning: false,
      input: ["text"] as ("text" | "image")[],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: config.realProviders[route.provider]?.contextWindow ?? 128000,
      maxTokens: 16384,
    }));

    pi.registerProvider(`local-gateway-${vsName}`, {
      name: `网关 (${vsName})`,
      baseUrl: `http://localhost:${config.port}`,
      apiKey: "key_114514",
      api: "openai-completions",
      models,
      // 自定义 streamSimple - 拦截请求并发给网关
      streamSimple: async (model, context, options) => {
        return await handleVirtualSupplierRequest(vsName, model, context, options);
      },
    });
  }
}

/**
 * 处理虚拟供应商请求
 */
async function handleVirtualSupplierRequest(
  vsName: string,
  model: any,
  context: any,
  options: any
): Promise<any> {
  const config = loadConfig();
  const vs = config.virtualSuppliers[vsName];
  
  if (!vs) {
    throw new Error(`Virtual supplier not found: ${vsName}`);
  }

  const route = vs.routes[model.id];
  if (!route) {
    throw new Error(`Model not found: ${model.id} in ${vsName}`);
  }

  const realProvider = config.realProviders[route.provider];
  if (!realProvider) {
    throw new Error(`Real provider not configured: ${route.provider}`);
  }

  // 构建自定义请求发给网关
  const gatewayUrl = `http://localhost:${config.port}/v1/chat/completions`;
  const requestBody = {
    virtualSupplier: vsName,
    model: model.id,
    messages: context.messages,
    stream: true,
  };

  const response = await fetch(gatewayUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  return response;
}

export default function (pi: ExtensionAPI) {
  const config = loadConfig();

  // 注册虚拟供应商
  registerVirtualSuppliers(pi);

  // 启动网关
  pi.on("session_start", async (_event, ctx) => {
    if (config.port) {
      server = new GatewayServer(config);
      await server.start();
      registerVirtualSuppliers(pi); // 重新注册（端口可能已更改）
      ctx.ui.notify(`API 网关已启动: http://localhost:${config.port}`, "info");
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
      registerVirtualSuppliers(pi); // 重新注册
    },
  });
}
