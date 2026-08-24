# Pi API Gateway Plugin

[English](README.md) | [中文](README_zh.md)

---

A Pi Coding Agent extension that provides API gateway functionality with multi-provider support.

### Features

- **Virtual Suppliers**: Create virtual suppliers that proxy to real AI providers
- **Multi-Provider Support**: Route requests to different suppliers based on configuration
- **Streaming**: Full support for streaming responses with thinking chains
- **Statistics**: Track token usage, costs, and cache hit rates
- **Interactive UI**: Configure suppliers and routes through Pi's interactive interface

### Installation

```bash
# Clone to Pi extensions directory
cp -r pi-api-gateway ~/.pi/agent/extensions/
```

### Configuration

Edit `~/.pi/agent/gateway/config.json`:

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

### Usage

1. Start Pi
2. Run `/gateway` to configure suppliers
3. Use `/model` to select a virtual supplier
4. The gateway forwards requests to the configured real provider

### Architecture

```
Pi → local-gateway-xxx (virtual supplier) → Gateway (:8081) → Real Provider API
```

---

## License

GPL-3.0
