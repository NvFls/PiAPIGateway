/**
 * API Gateway Plugin - Pi 插件部分
 * 
 * 只注册供应商，不管理网关
 */

import type { ExtensionAPI } from "./types.js";
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

function loadConfig(): Config {
  try {
    const data = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { virtualSuppliers: {}, realProviders: {}, port: 18081 };
  }
}

function getGatewayPort(): number {
  try {
    return parseInt(fs.readFileSync(PORT_FILE, "utf-8").trim(), 10);
  } catch {
    return loadConfig().port;
  }
}

export default function (pi: ExtensionAPI) {
  const config = loadConfig();
  const port = getGatewayPort();
  
  // 注册虚拟供应商
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
      baseUrl: `http://127.0.0.1:${port}`,
      apiKey: "key_114514",
      api: "openai-completions",
      models,
      streamSimple: async (model: any, context: any, options: any) => {
        const { handleVirtualSupplierRequest } = await import("./src/intercept/event-stream-handler.js");
        return await handleVirtualSupplierRequest(vsName, config, model.id, context.messages, true, options?.signal);
      },
    });
  }
}
