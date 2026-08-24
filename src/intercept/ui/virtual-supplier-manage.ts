/**
 * Virtual Supplier Management - 虚拟供应商管理
 */

import type { ExtensionCommandContext } from "../../types.js";
import type { Config, RouteConfig } from "../../config.js";

export async function showVirtualSupplierManage(
  ctx: ExtensionCommandContext,
  config: Config
): Promise<void> {
  while (true) {
    const vsNames = Object.keys(config.virtualSuppliers);
    const options = [
      ...vsNames.map((name) => {
        const vs = config.virtualSuppliers[name];
        const routeCount = Object.keys(vs.routes).length;
        return `${name} (${routeCount} 个路由)`;
      }),
      "+ 添加虚拟供应商",
    ];

    const choice = await ctx.ui.select("虚拟供应商管理", options);
    if (choice === undefined) break;

    if (choice === "+ 添加虚拟供应商") {
      await addVirtualSupplier(ctx, config);
    } else {
      const vsName = choice.split(" ")[0];
      await editVirtualSupplier(ctx, config, vsName);
    }
  }
}

async function addVirtualSupplier(
  ctx: ExtensionCommandContext,
  config: Config
): Promise<void> {
  const name = await ctx.ui.input("虚拟供应商名称（如 deepseek）");
  if (!name) return;

  config.virtualSuppliers[name] = { routes: {} };
  ctx.ui.notify(`虚拟供应商 ${name} 已添加`, "info");

  // 立即添加路由
  const addRoute = await ctx.ui.confirm("添加路由", "是否立即添加路由？");
  if (addRoute) {
    await addRouteToVirtualSupplier(ctx, config, name);
  }
}

async function editVirtualSupplier(
  ctx: ExtensionCommandContext,
  config: Config,
  name: string
): Promise<void> {
  const vs = config.virtualSuppliers[name];
  if (!vs) return;

  while (true) {
    const routeNames = Object.keys(vs.routes);
    const options = [
      ...routeNames.map((id) => {
        const route = vs.routes[id];
        return `${id} → ${route.provider}/${route.model}`;
      }),
      "+ 添加路由",
      "删除虚拟供应商",
      "返回",
    ];

    const choice = await ctx.ui.select(`编辑 ${name}`, options);
    if (choice === undefined || choice === "返回") break;

    if (choice === "+ 添加路由") {
      await addRouteToVirtualSupplier(ctx, config, name);
    } else if (choice === "删除虚拟供应商") {
      const confirm = await ctx.ui.confirm("删除", `确定删除虚拟供应商 ${name}？`);
      if (confirm) {
        delete config.virtualSuppliers[name];
        ctx.ui.notify(`虚拟供应商 ${name} 已删除`, "info");
        break;
      }
    } else {
      const routeId = choice.split(" ")[0];
      await editRoute(ctx, config, name, routeId);
    }
  }
}

async function addRouteToVirtualSupplier(
  ctx: ExtensionCommandContext,
  config: Config,
  vsName: string
): Promise<void> {
  const id = await ctx.ui.input("路由 ID（如 deepseek-v4-pro）");
  if (!id) return;

  // 显示可用真实供应商
  const rpNames = Object.keys(config.realProviders);
  if (rpNames.length === 0) {
    ctx.ui.notify("请先配置真实供应商！", "error");
    return;
  }

  const provider = await ctx.ui.select("选择真实供应商", rpNames);
  if (!provider) return;

  const model = await ctx.ui.input("真实模型名（如 deepseek-v4-pro）");
  if (!model) return;

  const timeoutStr = await ctx.ui.input("超时时间（毫秒，如 60000）");
  const timeoutMs = parseInt(timeoutStr || "60000", 10);

  const retriesStr = await ctx.ui.input("最大重试次数（如 2）");
  const maxRetries = parseInt(retriesStr || "2", 10);

  config.virtualSuppliers[vsName].routes[id] = {
    provider,
    model,
    timeoutMs,
    maxRetries,
  };

  ctx.ui.notify(`路由 ${id} 已添加 → ${provider}/${model}`, "info");
}

async function editRoute(
  ctx: ExtensionCommandContext,
  config: Config,
  vsName: string,
  routeId: string
): Promise<void> {
  const route = config.virtualSuppliers[vsName].routes[routeId];
  if (!route) return;

  const action = await ctx.ui.select(`编辑路由 ${routeId}`, [
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
      delete config.virtualSuppliers[vsName].routes[routeId];
      ctx.ui.notify(`路由 ${routeId} 已删除`, "info");
      break;
    }
  }
}
