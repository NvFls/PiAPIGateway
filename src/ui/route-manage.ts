/**
 * Route Management UI for API Gateway Plugin
 */

import type { ExtensionCommandContext } from "../types.js";
import type { GatewayConfig } from "../types.js";

export async function showRouteManage(
  ctx: ExtensionCommandContext,
  config: GatewayConfig
): Promise<void> {
  while (true) {
    const routeNames = Object.keys(config.routes);
    const options = [
      ...routeNames.map((name) => {
        const route = config.routes[name];
        return `${name} (超时: ${route.timeoutMs}ms, 重试: ${route.maxRetries})`;
      }),
      "+ 添加新路由",
    ];

    const choice = await ctx.ui.select("路由管理", options);
    if (choice === undefined) break;

    if (choice === "+ 添加新路由") {
      await addRoute(ctx, config);
    } else {
      const routeName = choice.split(" ")[0];
      await editRoute(ctx, config, routeName);
    }
  }
}

async function addRoute(
  ctx: ExtensionCommandContext,
  config: GatewayConfig
): Promise<void> {
  const name = await ctx.ui.input("路由名称（如 openai-gpt-4o）");
  if (!name) return;

  // 显示可用供应商
  const providerNames = Object.keys(config.providers);
  if (providerNames.length === 0) {
    ctx.ui.notify("请先添加供应商！", "error");
    return;
  }

  const provider = await ctx.ui.select("选择供应商", providerNames);
  if (!provider) return;

  const model = await ctx.ui.input("真实模型名（如 gpt-4o）");
  if (!model) return;

  const timeoutStr = await ctx.ui.input("超时时间（毫秒，如 60000）");
  const timeoutMs = parseInt(timeoutStr || "60000", 10);

  const retriesStr = await ctx.ui.input("最大重试次数（如 2）");
  const maxRetries = parseInt(retriesStr || "2", 10);

  config.routes[name] = {
    provider,
    model,
    timeoutMs,
    maxRetries,
  };

  ctx.ui.notify(`路由 ${name} 已添加 → ${provider}/${model}`, "info");
}

async function editRoute(
  ctx: ExtensionCommandContext,
  config: GatewayConfig,
  name: string
): Promise<void> {
  const route = config.routes[name];
  if (!route) return;

  const action = await ctx.ui.select(`编辑 ${name}`, [
    "修改超时时间",
    "修改重试次数",
    "删除路由",
    "返回",
  ]);

  if (action === undefined || action === "返回") return;

  switch (action) {
    case "修改超时时间": {
      const newTimeout = await ctx.ui.input("新的超时时间（毫秒）");
      if (newTimeout) {
        route.timeoutMs = parseInt(newTimeout, 10);
        ctx.ui.notify("超时时间已更新", "info");
      }
      break;
    }
    case "修改重试次数": {
      const newRetries = await ctx.ui.input("新的最大重试次数");
      if (newRetries) {
        route.maxRetries = parseInt(newRetries, 10);
        ctx.ui.notify("重试次数已更新", "info");
      }
      break;
    }
    case "删除路由": {
      delete config.routes[name];
      ctx.ui.notify(`路由 ${name} 已删除`, "info");
      break;
    }
  }
}
