/**
 * Statistics View - 统计查看
 */

import type { ExtensionCommandContext } from "../../types.js";
import { loadStats } from "../../gateway/stats.js";

export async function showStatsView(ctx: ExtensionCommandContext): Promise<void> {
  const stats = loadStats();

  while (true) {
    const choice = await ctx.ui.select("查看统计", [
      "总览",
      "按真实供应商查看",
      "按模型查看",
      "返回",
    ]);

    if (choice === undefined || choice === "返回") break;

    switch (choice) {
      case "总览":
        await showOverview(ctx, stats);
        break;
      case "按真实供应商查看":
        await showByProvider(ctx, stats);
        break;
      case "按模型查看":
        await showByModel(ctx, stats);
        break;
    }
  }
}

async function showOverview(
  ctx: ExtensionCommandContext,
  stats: ReturnType<typeof loadStats>
): Promise<void> {
  const cacheRate = stats.totalInputTokens > 0
    ? ((stats.totalCachedTokens / stats.totalInputTokens) * 100).toFixed(1)
    : "0.0";

  const lines = [
    `总请求次数：${stats.totalRequests}`,
    `总输入 token：${stats.totalInputTokens.toLocaleString()}`,
    `总输出 token：${stats.totalOutputTokens.toLocaleString()}`,
    `缓存命中 token：${stats.totalCachedTokens.toLocaleString()}`,
    `缓存命中率：${cacheRate}%`,
    `总花费：$${stats.totalCost.toFixed(4)}`,
  ];

  await ctx.ui.select("总览", [...lines, "返回"]);
}

async function showByProvider(
  ctx: ExtensionCommandContext,
  stats: ReturnType<typeof loadStats>
): Promise<void> {
  const providers = Object.keys(stats.byProvider);
  if (providers.length === 0) {
    ctx.ui.notify("暂无数据", "info");
    return;
  }

  const choice = await ctx.ui.select("按真实供应商查看", [...providers, "返回"]);
  if (choice === undefined || choice === "返回") return;

  const providerStats = stats.byProvider[choice];
  const cacheRate = providerStats.inputTokens > 0
    ? ((providerStats.cachedTokens / providerStats.inputTokens) * 100).toFixed(1)
    : "0.0";

  const lines = [
    `请求次数：${providerStats.requests}`,
    `输入 token：${providerStats.inputTokens.toLocaleString()}`,
    `输出 token：${providerStats.outputTokens.toLocaleString()}`,
    `缓存命中 token：${providerStats.cachedTokens.toLocaleString()}`,
    `缓存命中率：${cacheRate}%`,
    `花费：$${providerStats.cost.toFixed(4)}`,
  ];

  await ctx.ui.select(choice, [...lines, "返回"]);
}

async function showByModel(
  ctx: ExtensionCommandContext,
  stats: ReturnType<typeof loadStats>
): Promise<void> {
  const models = Object.keys(stats.byModel);
  if (models.length === 0) {
    ctx.ui.notify("暂无数据", "info");
    return;
  }

  const choice = await ctx.ui.select("按模型查看", [...models, "返回"]);
  if (choice === undefined || choice === "返回") return;

  const modelStats = stats.byModel[choice];
  const cacheRate = modelStats.inputTokens > 0
    ? ((modelStats.cachedTokens / modelStats.inputTokens) * 100).toFixed(1)
    : "0.0";

  const lines = [
    `真实供应商：${modelStats.provider}`,
    `请求次数：${modelStats.requests}`,
    `输入 token：${modelStats.inputTokens.toLocaleString()}`,
    `输出 token：${modelStats.outputTokens.toLocaleString()}`,
    `缓存命中 token：${modelStats.cachedTokens.toLocaleString()}`,
    `缓存命中率：${cacheRate}%`,
    `花费：$${modelStats.cost.toFixed(4)}`,
  ];

  await ctx.ui.select(choice, [...lines, "返回"]);
}
