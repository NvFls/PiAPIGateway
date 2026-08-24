/**
 * Main Menu for API Gateway Plugin
 */

import type { ExtensionCommandContext, ExtensionAPI } from "../types.js";
import type { GatewayConfig } from "../types.js";
import { showProviderManage } from "./provider-manage.js";
import { showRouteManage } from "./route-manage.js";
import { showStatsView } from "./stats-view.js";

export async function showMainMenu(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  config: GatewayConfig
): Promise<void> {
  // 检查配置状态
  const providerCount = Object.keys(config.providers).length;
  const routeCount = Object.keys(config.routes).length;
  
  // 如果配置不完整，显示警告
  if (providerCount === 0 || routeCount === 0) {
    const warnings: string[] = [];
    if (providerCount === 0) warnings.push("⚠️ 尚未配置任何供应商");
    if (routeCount === 0) warnings.push("⚠️ 尚未配置任何路由");
    
    await ctx.ui.select("API 网关 - 需要配置", [
      ...warnings,
      "",
      "→ 前往配置",
      "返回",
    ]).then(async (choice) => {
      if (choice === "→ 前往配置") {
        await showSetupWizard(pi, ctx, config);
      }
    });
    return;
  }

  const options = [
    "供应商管理",
    "路由管理",
    "查看统计",
    config.wasRunning ? "停止网关" : "启动网关",
  ];

  while (true) {
    const choice = await ctx.ui.select("API 网关管理", options);
    if (choice === undefined) break;

    switch (choice) {
      case "供应商管理":
        await showProviderManage(ctx, config);
        break;
      case "路由管理":
        await showRouteManage(ctx, config);
        break;
      case "查看统计":
        await showStatsView(ctx);
        break;
      case "启动网关":
      case "停止网关":
        config.wasRunning = !config.wasRunning;
        ctx.ui.notify(
          config.wasRunning ? "网关已启动" : "网关已停止",
          "info"
        );
        break;
    }
  }
}

/**
 * 配置向导 - 引导用户完成初始配置
 */
async function showSetupWizard(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  config: GatewayConfig
): Promise<void> {
  ctx.ui.notify("欢迎使用 API 网关！让我们开始配置。", "info");
  
  // 步骤 1：添加供应商
  const addProvider = await ctx.ui.confirm("配置向导", "第一步：是否添加一个供应商？");
  if (addProvider) {
    await showProviderManage(ctx, config);
  }
  
  // 步骤 2：添加路由
  const addRoute = await ctx.ui.confirm("配置向导", "第二步：是否添加一个路由？");
  if (addRoute) {
    await showRouteManage(ctx, config);
  }
  
  // 完成
  const providerCount = Object.keys(config.providers).length;
  const routeCount = Object.keys(config.routes).length;
  
  if (providerCount > 0 && routeCount > 0) {
    ctx.ui.notify(`配置完成！已添加 ${providerCount} 个供应商和 ${routeCount} 个路由。`, "info");
  } else {
    ctx.ui.notify("您随时可以运行 /gateway 继续配置。", "info");
  }
}
