/**
 * Stats - 网关统计功能
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CONFIG_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".pi",
  "agent",
  "gateway"
);
const STATS_FILE = path.join(CONFIG_DIR, "stats.json");

export interface StatsEntry {
  timestamp: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export interface StatsData {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalCost: number;
  entries: StatsEntry[];
  byProvider: Record<string, ProviderStats>;
  byModel: Record<string, ModelStats>;
}

export interface ProviderStats {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cost: number;
}

export interface ModelStats {
  provider: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cost: number;
}

export interface RecordStatsInput {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

// 模型价格（每 1M tokens）
const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number }> = {
  "gpt-4o": { input: 2.50, output: 10.00, cacheRead: 1.25 },
  "gpt-4o-mini": { input: 0.15, output: 0.60, cacheRead: 0.075 },
  "deepseek-v4-pro": { input: 0.25, output: 1.00, cacheRead: 0.10 },
};

function getDefaultPricing(): { input: number; output: number; cacheRead: number } {
  return { input: 1.00, output: 2.00, cacheRead: 0.50 };
}

export function loadStats(): StatsData {
  try {
    if (!fs.existsSync(STATS_FILE)) {
      return createEmptyStats();
    }
    const data = fs.readFileSync(STATS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return createEmptyStats();
  }
}

export function saveStats(stats: StatsData): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2) + "\n", "utf-8");
  } catch {
    // Ignore save errors
  }
}

export function recordStats(input: RecordStatsInput): void {
  const stats = loadStats();
  const pricing = MODEL_PRICING[input.model] || getDefaultPricing();

  const uncachedTokens = input.inputTokens - input.cachedTokens;
  const cost = 
    (uncachedTokens / 1_000_000) * pricing.input +
    (input.cachedTokens / 1_000_000) * pricing.cacheRead +
    (input.outputTokens / 1_000_000) * pricing.output;

  // 更新总计
  stats.totalRequests++;
  stats.totalInputTokens += input.inputTokens;
  stats.totalOutputTokens += input.outputTokens;
  stats.totalCachedTokens += input.cachedTokens;
  stats.totalCost += cost;

  // 更新按供应商统计
  if (!stats.byProvider[input.provider]) {
    stats.byProvider[input.provider] = {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      cost: 0,
    };
  }
  const providerStats = stats.byProvider[input.provider];
  providerStats.requests++;
  providerStats.inputTokens += input.inputTokens;
  providerStats.outputTokens += input.outputTokens;
  providerStats.cachedTokens += input.cachedTokens;
  providerStats.cost += cost;

  // 更新按模型统计
  if (!stats.byModel[input.model]) {
    stats.byModel[input.model] = {
      provider: input.provider,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      cost: 0,
    };
  }
  const modelStats = stats.byModel[input.model];
  modelStats.requests++;
  modelStats.inputTokens += input.inputTokens;
  modelStats.outputTokens += input.outputTokens;
  modelStats.cachedTokens += input.cachedTokens;
  modelStats.cost += cost;

  // 添加条目
  stats.entries.push({
    timestamp: Date.now(),
    provider: input.provider,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    cachedTokens: input.cachedTokens,
  });

  // 限制条目数量（保留最近 1000 条）
  if (stats.entries.length > 1000) {
    stats.entries = stats.entries.slice(-1000);
  }

  saveStats(stats);
}

function createEmptyStats(): StatsData {
  return {
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedTokens: 0,
    totalCost: 0,
    entries: [],
    byProvider: {},
    byModel: {},
  };
}
