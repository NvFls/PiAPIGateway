/**
 * Main Menu - 管理界面主菜单
 */

import type { ExtensionAPI, ExtensionCommandContext } from "../types.js";
import type { Config } from "../config.js";
import { showVirtualSupplierManage } from "./virtual-supplier-manage.js";
import { showRealProviderManage } from "./real-provider-manage.js";
import { showStatsView } from "./stats-view.js";

export async function showMainMenu(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  config: Config
): Promise<void> {
  const vsCount = Object.keys(config.virtualSuppliers).length;
  const rpCount = Object.keys(config.realProviders).length;
  const routeCount = Object.values(config.virtualSuppliers).reduce(
    (sum, vs) => sum + Object.keys(vs.routes).length,
    0
  );

  // 如果配置不完整，显示警告
  if (vsCount === 0 || rpCount === 0 || routeCount === 0) {
    const warnings: string[] = [];
    if (rpCount === 0) warnings.push("⚠️ 尚未配置真实供应商");
    if (vsCount === 0) warnings.push("⚠️ 尚未配置虚拟供应商");
    if (routeCount === 0) warnings.push("⚠️ 尚未配置路由");

    const choice = await ctx.ui.select("API 网关 - 需要配置", [
      ...warnings,
      "",
      "→ 前往配置",
      "返回",
    ]);

    if (choice === "→ 前往配置") {
      await showSetupWizard(pi, ctx, config);
    }
    return;
  }

  const options = [
    "虚拟供应商管理",
    "真实供应商管理",
    "查看统计",
  ];

  while (true) {
    const choice = await ctx.ui.select("API 网关管理", options);
    if (choice === undefined) break;

    switch (choice) {
      case "虚拟供应商管理":
        await showVirtualSupplierManage(ctx, config);
        break;
      case "真实供应商管理":
        await showRealProviderManage(ctx, config);
        break;
      case "查看统计":
        await showStatsView(ctx);
        break;
    }
  }
}

async function showSetupWizard(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  config: Config
): Promise<void> {
  ctx.ui.notify("欢迎使用 API 网关！让我们开始配置。", "info");

  // 步骤 1：添加真实供应商
  const addReal = await ctx.ui.confirm("配置向导", "第一步：是否添加真实供应商？");
  if (addReal) {
    await showRealProviderManage(ctx, config);
  }

  // 步骤 2：添加虚拟供应商
  const addVs = await ctx.ui.confirm("配置向导", "第二步：是否添加虚拟供应商？");
  if (addVs) {
    await showVirtualSupplierManage(ctx, config);
  }

  // 完成
  const vsCount = Object.keys(config.virtualSuppliers).length;
  const rpCount = Object.keys(config.realProviders).length;

  if (vsCount > 0 && rpCount > 0) {
    ctx.ui.notify(`配置完成！已添加 ${rpCount} 个真实供应商和 ${vsCount} 个虚拟供应商。`, "info");
  } else {
    ctx.ui.notify("您随时可以运行 /gateway 继续配置。", "info");
  }
}
