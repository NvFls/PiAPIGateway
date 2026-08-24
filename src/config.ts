/**
 * Config - 配置管理（拦截部分和网关共享）
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CONFIG_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".pi",
  "agent",
  "gateway"
);
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export interface RouteConfig {
  provider: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
}

export interface RealProviderConfig {
  apiKey: string;
  baseUrl: string;
  contextWindow: number;
  temperature: number;
}

export interface Config {
  virtualSuppliers: Record<string, { routes: Record<string, RouteConfig> }>;
  realProviders: Record<string, RealProviderConfig>;
  port: number;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function loadConfig(): Config {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return createDefaultConfig();
    }
    const data = fs.readFileSync(CONFIG_FILE, "utf-8");
    const raw = JSON.parse(data);
    
    // 兼容旧格式迁移
    if (raw.providers && !raw.realProviders) {
      return {
        virtualSuppliers: {},
        realProviders: raw.providers,
        port: raw.port ?? 18081,
      };
    }
    
    return {
      virtualSuppliers: raw.virtualSuppliers ?? {},
      realProviders: raw.realProviders ?? {},
      port: raw.port ?? 18081,
    };
  } catch {
    return createDefaultConfig();
  }
}

export function saveConfig(config: Config): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
  } catch {
    // Ignore save errors
  }
}

function createDefaultConfig(): Config {
  return {
    virtualSuppliers: {},
    realProviders: {},
    port: 18081,
  };
}
