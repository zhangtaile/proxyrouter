# ProxyRouter: Smart Gemini Model Router | 智能 Gemini 模型路由器

ProxyRouter is a lightweight, high-performance edge router that acts as an intelligent proxy for the Google Gemini API. It automatically routes user prompts to different Gemini models (Lite, Flash, or Pro) based on a real-time complexity analysis.

ProxyRouter 是一个轻量级、高性能的边缘路由器，作为 Google Gemini API 的智能代理。它根据实时复杂度分析，自动将用户提示路由到不同的 Gemini 模型（Lite、Flash 或 Pro）。

---

## 🌟 Key Features | 主要特性

- **Multi-Platform Support | 多平台支持**: Deploy on **Cloudflare Workers** or **Vercel Edge Functions**. | 支持部署在 **Cloudflare Workers** 或 **Vercel Edge Functions**。
- **Intelligent Routing | 智能路由**: Uses `gemini-3.1-flash-lite-preview` to evaluate prompt complexity (1-100). | 使用 `gemini-3.1-flash-lite-preview` 评估提示词复杂度（1-100分）。
- **3-Tier Model Support | 三级模型支持**:
  - **Lite (< 30)**: Simple greetings, basic facts. | 处理简单问候、基础事实。
  - **Flash (30-69)**: Standard reasoning, coding, multi-step tasks. | 处理标准推理、编程任务、多步指令。
  - **Pro (>= 70)**: Complex architecture, deep research, advanced debugging. | 处理复杂架构设计、深度研究、高级调试。
- **Native API Compatibility | 原生接口兼容**: Fully compatible with Google Gemini native format (`/v1beta/models`). | 完全兼容 Google Gemini 原生格式。
- **Seamless Integration | 无缝集成**: Works perfectly with **Cherry Studio** by mimicking the official provider. | 模拟官方提供商，完美匹配 **Cherry Studio**。
- **Streaming Support | 流式支持**: Full support for `streamGenerateContent`. | 完美支持流式输出。

---

## 🚀 Deployment | 部署指南

### Option 1: Cloudflare Workers (Recommended) | 选项 1：Cloudflare Workers（推荐）

#### GitHub Deployment | GitHub 自动部署
1. Fork this repository. | Fork 本仓库。
2. In **Cloudflare Dashboard**, go to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**. | 在 Cloudflare 控制台，进入 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**。
3. Select your forked `proxyrouter` repository. | 选择你 Fork 的 `proxyrouter` 仓库。
4. Save and Deploy. | 保存并部署。

#### Manual Deployment | 手动部署
1. Install Wrangler: `npm install -g wrangler`. | 安装 Wrangler：`npm install -g wrangler`。
2. Login: `wrangler login`. | 登录：`wrangler login`。
3. Deploy: `npm run deploy`. | 部署：`npm run deploy`。

---

### Option 2: Vercel Edge Functions | 选项 2：Vercel Edge Functions

#### Vercel Dashboard Deployment | Vercel 面板部署
1. Fork this repository. | Fork 本仓库。
2. In **Vercel Dashboard**, click **Add New** -> **Project**. | 在 Vercel 控制台，点击 **Add New** -> **Project**。
3. Import your forked `proxyrouter` repository. | 导入你 Fork 的 `proxyrouter` 仓库。
4. Vercel will automatically detect the configuration. Click **Deploy**. | Vercel 会自动识别配置，点击 **Deploy**。

#### Vercel CLI Deployment | Vercel 命令行部署
1. Install Vercel CLI: `npm install -g vercel`. | 安装 Vercel CLI：`npm install -g vercel`。
2. Deploy: `npm run deploy:vercel`. | 部署：`npm run deploy:vercel`。

---

## ⚙️ Configuration | 配置

### 1. API Key (Security) | API 密钥（安全）

ProxyRouter prioritizes the API Key from the client. To set a fallback: | 代理优先使用客户端传入的 Key。设置备用 Key：

- **Cloudflare**: Go to Worker -> **Settings** -> **Variables** -> Add a **Secret** named `GEMINI_API_KEY`. | **Cloudflare**: 进入 Worker -> **设置** -> **变量** -> 添加名为 `GEMINI_API_KEY` 的 **加密变量 (Secret)**。
- **Vercel**: Go to Project -> **Settings** -> **Environment Variables** -> Add `GEMINI_API_KEY`. | **Vercel**: 进入项目 -> **Settings** -> **Environment Variables** -> 添加 `GEMINI_API_KEY`。

### 2. Model Settings | 模型设置

You can override the default models by setting environment variables: | 你可以通过设置环境变量来覆盖默认模型：

- `LITE_MODEL`: Model used for complexity scoring. | 用于复杂度评分的模型。
- `SIMPLE_MODEL`: Model for low-to-medium tasks. | 处理中低难度任务的模型。
- `COMPLEX_MODEL`: Model for high-complexity tasks. | 处理高难度任务的模型。

---

## 🖥️ Usage in Cherry Studio | 在 Cherry Studio 中使用

1. **Settings** -> **Model Providers** -> **Google Gemini**. | **设置** -> **模型提供商** -> **Google Gemini**。
2. **API Key**: Enter your real Gemini Key. | **API Key**: 输入真实的 Gemini Key。
3. **Base URL**: Enter your deployed URL (Cloudflare or Vercel). | **代理地址**: 输入你部署后的 URL (Cloudflare 或 Vercel)。
4. Start chatting! The proxy handles routing automatically. | 开始聊天！代理将自动处理模型切换。

---

## 🛠️ Debugging | 调试

Monitor routing in the deployment logs (Cloudflare Dashboard or Vercel Logs): | 在部署日志（Cloudflare 控制台或 Vercel 日志）中监控路由逻辑：
- `[ROUTE] Score: 45/100 | Decision: FLASH (gemini-3-flash-preview)`

---

## 📄 License | 许可证

MIT
