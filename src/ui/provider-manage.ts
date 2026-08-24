/**
 * Provider Management UI for API Gateway Plugin
 */

import type { ExtensionCommandContext } from "../types.js";
import type { GatewayConfig } from "../types.js";

export async function showProviderManage(
  ctx: ExtensionCommandContext,
  config: GatewayConfig
): Promise<void> {
  while (true) {
    const providerNames = Object.keys(config.providers);
    const options = [
      ...providerNames.map((name) => `${name} (${config.providers[name].baseUrl})`),
      "+ 添加新供应商",
    ];

    const choice = await ctx.ui.select("供应商管理", options);
    if (choice === undefined) break;

    if (choice === "+ 添加新供应商") {
      await addProvider(ctx, config);
    } else {
      // 编辑现有供应商
      const providerName = choice.split(" ")[0];
      await editProvider(ctx, config, providerName);
    }
  }
}

async function addProvider(
  ctx: ExtensionCommandContext,
  config: GatewayConfig
): Promise<void> {
  const name = await ctx.ui.input("供应商名称（如 openai）");
  if (!name) return;

  const apiKey = await ctx.ui.input("API Key");
  if (!apiKey) return;

  const baseUrl = await ctx.ui.input("Base URL（如 https://api.openai.com）");
  if (!baseUrl) return;

  const contextWindowStr = await ctx.ui.input("上下文窗口大小（如 128000）");
  const contextWindow = parseInt(contextWindowStr || "128000", 10);

  const temperatureStr = await ctx.ui.input("默认温度（如 0.7）");
  const temperature = parseFloat(temperatureStr || "0.7");

  config.providers[name] = {
    apiKey,
    baseUrl,
    contextWindow,
    temperature,
  };

  ctx.ui.notify(`供应商 ${name} 已添加`, "info");
}

async function editProvider(
  ctx: ExtensionCommandContext,
  config: GatewayConfig,
  name: string
): Promise<void> {
  const provider = config.providers[name];
  if (!provider) return;

  const action = await ctx.ui.select(`编辑 ${name}`, [
    "修改 API Key",
    "修改 Base URL",
    "修改上下文窗口",
    "修改默认温度",
    "测试连接",
    "删除供应商",
    "返回",
  ]);

  if (action === undefined || action === "返回") return;

  switch (action) {
    case "修改 API Key": {
      const newKey = await ctx.ui.input("新的 API Key");
      if (newKey) {
        provider.apiKey = newKey;
        ctx.ui.notify("API Key 已更新", "info");
      }
      break;
    }
    case "修改 Base URL": {
      const newUrl = await ctx.ui.input("新的 Base URL");
      if (newUrl) {
        provider.baseUrl = newUrl;
        ctx.ui.notify("Base URL 已更新", "info");
      }
      break;
    }
    case "修改上下文窗口": {
      const newSize = await ctx.ui.input("新的上下文窗口大小");
      if (newSize) {
        provider.contextWindow = parseInt(newSize, 10);
        ctx.ui.notify("上下文窗口已更新", "info");
      }
      break;
    }
    case "修改默认温度": {
      const newTemp = await ctx.ui.input("新的默认温度");
      if (newTemp) {
        provider.temperature = parseFloat(newTemp);
        ctx.ui.notify("默认温度已更新", "info");
      }
      break;
    }
    case "测试连接": {
      ctx.ui.notify("测试连接功能待实现", "info");
      break;
    }
    case "删除供应商": {
      delete config.providers[name];
      ctx.ui.notify(`供应商 ${name} 已删除`, "info");
      break;
    }
  }
}
