/**
 * Types - Pi 扩展类型定义（自己定义，零依赖）
 */

export interface ExtensionUIContext {
  select(title: string, options: string[]): Promise<string | undefined>;
  confirm(title: string, message: string): Promise<boolean>;
  input(title: string, placeholder?: string): Promise<string | undefined>;
  notify(message: string, type?: "info" | "warning" | "error"): void;
}

export interface ExtensionContext {
  ui: ExtensionUIContext;
  getModel(): { provider: string; id: string } | undefined;
}

export interface ExtensionCommandContext extends ExtensionContext {
  notify(message: string, type?: "info" | "warning" | "error"): void;
}

export interface ModelInfo {
  id: string;
  name: string;
  reasoning?: boolean;
  input?: string[];
  cost?: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow?: number;
  maxTokens?: number;
}

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  api: string;
  models: ModelInfo[];
  streamSimple?: (model: any, context: any, options: any) => Promise<any>;
}

export interface ExtensionAPI {
  on(event: string, handler: (event: any, ctx: ExtensionContext) => Promise<void> | void): void;
  registerProvider(name: string, config: ProviderConfig): void;
  registerCommand(name: string, options: { description?: string; handler: (args: string, ctx: ExtensionCommandContext) => Promise<void> }): void;
  unregisterProvider(name: string): void;
}
