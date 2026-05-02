# LLM Translator

基于 Cloudflare Pages 和 Workers AI 的多语言翻译应用。

## 特性

- **多语言支持**: 支持 20+ 种语言互译
- **多种 AI 模型**: 支持 OpenAI, Claude, Gemini, DeepSeek, NVIDIA NIM 等主流大模型
- **管理后台**: 可配置 API Key、模型选择、提示词模板
- **响应式设计**: 适配桌面端和移动端
- **主题切换**: 支持亮色/暗色模式

## 技术栈

- **前端**: 原生 HTML/CSS/JavaScript
- **后端**: Cloudflare Pages Functions
- **存储**: Cloudflare KV
- **AI**: Cloudflare Workers AI / 第三方大模型 API

## 部署

本项目部署在 Cloudflare Pages 上。

### 环境变量

| 变量名 | 类型 | 说明 |
|--------|------|------|
| ADMIN_PASSWORD | Secret | 管理后台登录密码 |

### 绑定资源

| 类型 | 变量名 | 说明 |
|------|--------|------|
| KV Namespace | SETTINGS | 存储配置和 API Key |
| Workers AI | AI | Cloudflare AI 模型 |

## 管理后台

访问 `/admin.html` 进入管理后台，使用 `ADMIN_PASSWORD` 登录。

## License

MIT
