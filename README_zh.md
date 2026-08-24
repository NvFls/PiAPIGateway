# Pi API Gateway Plugin

[English](README.md) | [中文](README_zh.md)

---

Pi 编码代理扩展，提供多供应商支持的 API 网关功能。

### 功能

- **虚拟供应商**：创建代理到真实 AI 供应商的虚拟供应商
- **多供应商支持**：根据配置将请求路由到不同供应商
- **流式传输**：完整支持思维链流式响应
- **统计功能**：追踪 token 用量、费用和缓存命中率
- **交互式界面**：通过 Pi 交互界面配置供应商和路由

### 安装

```bash
# 复制到 Pi 扩展目录
cp -r pi-api-gateway ~/.pi/agent/extensions/
```

### 配置

编辑 `~/.pi/agent/gateway/config.json`：

```json
{
  "realProviders": {
    "DeepSeek": {
      "apiKey": "sk-your-key",
      "baseUrl": "https://api.deepseek.com",
      "contextWindow": 1000000,
      "temperature": 0.7
    }
  },
  "virtualSuppliers": {
    "my-seek": {
      "routes": {
        "deepseek-v4-pro": {
          "provider": "DeepSeek",
          "model": "deepseek-v4-pro",
          "timeoutMs": 60000,
          "maxRetries": 2
        }
      }
    }
  },
  "port": 18081
}
```

### 使用

1. 启动 Pi
2. 运行 `/gateway` 配置供应商
3. 使用 `/model` 选择虚拟供应商
4. 网关将请求转发到配置的真实供应商

### 架构

```
Pi → local-gateway-xxx（虚拟供应商）→ 网关 (:8081) → 真实供应商 API
```

---

## 许可证

GPL-3.0
