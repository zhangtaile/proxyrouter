# ProxyRouter: Smart Gemini Model Router | 智能 Gemini 模型路由器

ProxyRouter is a lightweight, high-performance **Cloudflare Worker** that acts as an intelligent proxy for the Google Gemini API. It automatically routes user prompts to different Gemini models (Lite, Flash, or Pro) based on a real-time complexity analysis.

ProxyRouter 是一个轻量级、高性能的 **Cloudflare Worker**，作为 Google Gemini API 的智能代理。它根据实时复杂度分析，自动将用户提示路由到不同的 Gemini 模型（Lite、Flash 或 Pro）。

---

## 🌟 Key Features | 主要特性

- **Intelligent Routing | 智能路由**: Uses `gemini-3.1-flash-lite-preview` to evaluate prompt complexity (1-100). | 使用 `gemini-3.1-flash-lite-preview` 评估提示词复杂度（1-100分）。
- **3-Tier Model Support | 三级模型支持**:
  - **Lite (< 30)**: Simple greetings, basic facts. | 处理简单问候、基础事实。
  - **Flash (30-69)**: Standard reasoning, coding, multi-step tasks. | 处理标准推理、编程任务、多步指令。
  - **Pro (>= 70)**: Complex architecture, deep research, advanced debugging. | 处理复杂架构设计、深度研究、高级调试。
- **Native API Compatibility | 原生接口兼容**: Fully compatible with Google Gemini native format (`/v1beta/models`). | 完全兼容 Google Gemini 原生格式。
- **Seamless Integration | 无缝集成**: Works perfectly with **Cherry Studio** by mimicking the official provider. | 模拟官方提供商，完美匹配 **Cherry Studio**。
- **Edge Deployment | 边缘部署**: Powered by Cloudflare Workers for global low latency. | 基于 Cloudflare Workers，全球低延迟。
- **Streaming Support | 流式支持**: Full support for `streamGenerateContent`. | 完美支持流式输出。

---

## 🚀 Quick Start | 快速开始

### Option 1: GitHub Deployment (Recommended) | 选项 1：GitHub 部署（推荐）
1. Fork this repository. | Fork 本仓库。
2. In **Cloudflare Dashboard**, go to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**. | 在 Cloudflare 控制台，进入 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**。
3. Select your forked `proxyrouter` repository. | 选择你 Fork 的 `proxyrouter` 仓库。
4. Save and Deploy. | 保存并部署。

### Option 2: Manual Console Deployment | 选项 2：手动部署
1. Create a new Worker in Cloudflare. | 在 Cloudflare 中创建一个新的 Worker。
2. Paste the content of `worker.js` into the editor. | 将 `worker.js` 的内容粘贴到编辑器中。
3. Save and Deploy. | 保存并部署。

---

## ⚙️ Configuration | 配置

### 1. API Key (Security) | API 密钥（安全）
ProxyRouter prioritizes the API Key from the client. To set a fallback: | 代理优先使用客户端传入的 Key。设置备用 Key：
1. Go to Worker -> **Settings** -> **Variables**. | 进入 Worker -> **设置** -> **变量**。
2. Add a **Secret** named `GEMINI_API_KEY`. | 添加名为 `GEMINI_API_KEY` 的 **加密变量 (Secret)**。

### 2. Model Settings | 模型设置 (`wrangler.toml`)
Modify target models in `wrangler.toml`: | 在 `wrangler.toml` 中修改目标模型：
- `LITE_MODEL`: For complexity scoring. | 用于复杂度评分。
- `SIMPLE_MODEL`: For low-to-medium tasks. | 处理中低难度任务。
- `COMPLEX_MODEL`: For high-complexity tasks. | 处理高难度任务。

---

## 🖥️ Usage in Cherry Studio | 在 Cherry Studio 中使用

1. **Settings** -> **Model Providers** -> **Google Gemini**. | **设置** -> **模型提供商** -> **Google Gemini**。
2. **API Key**: Enter your real Gemini Key. | **API Key**: 输入真实的 Gemini Key。
3. **Base URL**: Enter your Worker URL (e.g., `https://proxyrouter.your-sub.workers.dev`). | **代理地址**: 输入你的 Worker URL。
4. Start chatting! The proxy handles routing automatically. | 开始聊天！代理将自动处理模型切换。

---

## 🛠️ Debugging | 调试

Monitor routing in the Cloudflare Dashboard: | 在 Cloudflare 控制台中监控路由逻辑：
- `[DEBUG] Analyzing complexity...`
- `[DEBUG] Raw score output from Lite: "45"`
- `[ROUTE] Score: 45/100 | Decision: FLASH (gemini-3-flash-preview)`

---

## 📄 License | 许可证

MIT
