/**
 * Real Provider Management - 真实供应商管理
 */

import type { ExtensionCommandContext } from "../../types.js";
import type { Config } from "../../config.js";

export async function showRealProviderManage(
  ctx: ExtensionCommandContext,
  config: Config
): Promise<void> {
  while (true) {
    const rpNames = Object.keys(config.realProviders);
    const options = [
      ...rpNames.map((name) => {
        const rp = config.realProviders[name];
        return `${name} (${rp.baseUrl})`;
      }),
      "+ 添加真实供应商",
    ];

    const choice = await ctx.ui.select("真实供应商管理", options);
    if (choice === undefined) break;

    if (choice === "+ 添加真实供应商") {
      await addRealProvider(ctx, config);
    } else {
      const name = choice.split(" ")[0];
      await editRealProvider(ctx, config, name);
    }
  }
}

async function addRealProvider(
  ctx: ExtensionCommandContext,
  config: Config
): Promise<void> {
  const name = await ctx.ui.input("真实供应商名称（如 DeepSeek）");
  if (!name) return;

  const apiKey = await ctx.ui.input("API Key");
  if (!apiKey) return;

  const baseUrl = await ctx.ui.input("Base URL（如 https://api.deepseek.com）");
  if (!baseUrl) return;

  const contextWindowStr = await ctx.ui.input("上下文窗口大小（如 128000）");
  const contextWindow = parseInt(contextWindowStr || "128000", 10);

  const temperatureStr = await ctx.ui.input("默认温度（如 0.7）");
  const temperature = parseFloat(temperatureStr || "0.7");

  config.realProviders[name] = {
    apiKey,
    baseUrl,
    contextWindow,
    temperature,
  };

  ctx.ui.notify(`真实供应商 ${name} 已添加`, "info");
}

async function editRealProvider(
  ctx: ExtensionCommandContext,
  config: Config,
  name: string
): Promise<void> {
  const rp = config.realProviders[name];
  if (!rp) return;

  const action = await ctx.ui.select(`编辑 ${name}`, [
    "修改 API Key",
    "修改 Base URL",
    "修改上下文窗口",
    "修改默认温度",
    "删除真实供应商",
    "返回",
  ]);

  if (action === undefined || action === "返回") return;

  switch (action) {
    case "修改 API Key": {
      const newKey = await ctx.ui.input("新的 API Key");
      if (newKey) {
        rp.apiKey = newKey;
        ctx.ui.notify("API Key 已更新", "info");
      }
      break;
    }
    case "修改 Base URL": {
      const newUrl = await ctx.ui.input("新的 Base URL");
      if (newUrl) {
        rp.baseUrl = newUrl;
        ctx.ui.notify("Base URL 已更新", "info");
      }
      break;
    }
    case "修改上下文窗口": {
      const newSize = await ctx.ui.input("新的上下文窗口大小");
      if (newSize) {
        rp.contextWindow = parseInt(newSize, 10);
        ctx.ui.notify("上下文窗口已更新", "info");
      }
      break;
    }
    case "修改默认温度": {
      const newTemp = await ctx.ui.input("新的默认温度");
      if (newTemp) {
        rp.temperature = parseFloat(newTemp);
        ctx.ui.notify("默认温度已更新", "info");
      }
      break;
    }
    case "删除真实供应商": {
      const confirm = await ctx.ui.confirm("删除", `确定删除真实供应商 ${name}？`);
      if (confirm) {
        delete config.realProviders[name];
        ctx.ui.notify(`真实供应商 ${name} 已删除`, "info");
      }
      break;
    }
  }
}
