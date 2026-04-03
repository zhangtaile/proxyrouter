# ProxyRouter: Smart Gemini Model Router

ProxyRouter is a lightweight, high-performance edge router that acts as an intelligent proxy for the Google Gemini API. It automatically routes user prompts to different Gemini models (Lite, Flash, or Pro) based on a real-time complexity analysis.

[English](#english) | [简体中文](#简体中文) | [繁體中文](#繁體中文)

---

<a name="english"></a>
## 🌟 Key Features

- **Multi-Platform Support**: Deploy on **Cloudflare Workers** or **Vercel Edge Functions**.
- **Intelligent Routing**: Uses `gemini-3.1-flash-lite-preview` to evaluate prompt complexity (1-100).
- **3-Tier Model Support**:
  - **Lite (< 30)**: Simple greetings, basic facts.
  - **Flash (30-69)**: Standard reasoning, coding, multi-step tasks.
  - **Pro (>= 70)**: Complex architecture, deep research, advanced debugging.
- **Native API Compatibility**: Fully compatible for Google Gemini native format (`/v1beta/models`).
- **Seamless Integration**: Works perfectly with **Cherry Studio** by mimicking the official provider.
- **Streaming Support**: Full support for `streamGenerateContent`.

## 🚀 Deployment

### Option 1: Cloudflare Workers (Recommended)

#### GitHub Deployment
1. Fork this repository.
2. In **Cloudflare Dashboard**, go to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
3. Select your forked `proxyrouter` repository.
4. Save and Deploy.

#### Manual Deployment
1. Install Wrangler: `npm install -g wrangler`.
2. Login: `wrangler login`.
3. Deploy: `npm run deploy`.

---

### Option 2: Vercel Edge Functions

#### Vercel Dashboard Deployment
1. Fork this repository.
2. In **Vercel Dashboard**, click **Add New** -> **Project**.
3. Import your forked `proxyrouter` repository.
4. Vercel will automatically detect the configuration. Click **Deploy**.

#### Vercel CLI Deployment
1. Install Vercel CLI: `npm install -g vercel`.
2. Deploy: `npm run deploy:vercel`.

## ⚙️ Configuration

### 1. API Key (Security)
ProxyRouter prioritizes the API Key from the client (`x-goog-api-key`). To set a fallback:
- **Cloudflare**: Go to Worker -> **Settings** -> **Variables** -> Add a **Secret** named `GEMINI_API_KEY`.
- **Vercel**: Go to Project -> **Settings** -> **Environment Variables** -> Add `GEMINI_API_KEY`.

### 2. Security Settings (New)
To prevent unauthorized access to your proxy:
- **`AUTH_TOKEN`**: Set this to a secret string. If set, clients **must** provide `Authorization: Bearer <your_token>` in their request headers.
- **`ALLOWED_ORIGINS`**: Restrict access to specific domains. Default is `*`. Example: `https://chat.example.com`.

### 3. Model Settings
Override default models via environment variables:
- `SCORING_MODEL`: Model used for complexity scoring.
- `LITE_MODEL`: Model for extremely simple tasks.
- `SIMPLE_MODEL`: Model for low-to-medium tasks.
- `COMPLEX_MODEL`: Model for high-complexity tasks.

### 4. Feature Toggles: `ENABLE_DIFFICULTY_PROMPT`
Appends a difficulty indicator to the system instruction:
- **Lite**: "请以「这个问题不难」作为开始回答问题"
- **Flash**: "请以「这个问题难度正常」作为开始回答问题"
- **Pro**: "请以「这个问题有难度」作为开始回答问题"

**Default**: Enabled. Set to `"false"` or `"0"` to disable.

## 🖥️ Usage in Cherry Studio
1. **Settings** -> **Model Providers** -> **Google Gemini**.
2. **API Key**: Enter your real Gemini Key.
3. **Base URL**: Enter your deployed URL (Cloudflare or Vercel).
4. Start chatting! The proxy handles routing automatically.

## 📄 License
MIT

---

<a name="简体中文"></a>
## 🌟 主要特性

- **多平台支持**: 可部署在 **Cloudflare Workers** 或 **Vercel Edge Functions**。
- **智能路由**: 使用 `gemini-3.1-flash-lite-preview` 评估提示词复杂度（1-100分）。
- **三级模型支持**:
  - **Lite (< 30)**: 处理简单问候、基础事实。
  - **Flash (30-69)**: 处理标准推理、编程任务、多步指令。
  - **Pro (>= 70)**: 处理复杂架构设计、深度研究、高级调试。
- **原生接口兼容**: 完全兼容 Google Gemini 原生格式 (`/v1beta/models`)。
- **无缝集成**: 模拟官方提供商，完美匹配 **Cherry Studio** 等客户端。
- **流式输出**: 完美支持 `streamGenerateContent`。

## 🚀 部署指南

### 选项 1：Cloudflare Workers（推荐）

#### GitHub 自动部署
1. Fork 本仓库。
2. 在 Cloudflare 控制台，进入 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**。
3. 选择你 Fork 的仓库并部署。

#### 手动部署
1. 安装 Wrangler: `npm install -g wrangler`
2. 登录: `wrangler login`
3. 部署: `npm run deploy`

---

### 选项 2：Vercel Edge Functions

#### Vercel 面板部署
1. Fork 本仓库。
2. 在 Vercel 控制台，点击 **Add New** -> **Project** 并导入仓库。
3. 点击 **Deploy**，Vercel 会自动识别配置。

## ⚙️ 配置说明

### 1. API 密钥 (Security)
代理优先使用客户端传入的 Key (`x-goog-api-key`)。设置备用 Key：
- **Cloudflare**: 进入 Worker -> **设置** -> **变量** -> 添加名为 `GEMINI_API_KEY` 的 **加密变量 (Secret)**。
- **Vercel**: 进入项目 -> **Settings** -> **Environment Variables** -> 添加 `GEMINI_API_KEY`。

### 2. 安全设置 (新增)
防止他人盗用你的代理：
- **`AUTH_TOKEN`**: 设置一个秘密字符串。启用后，客户端必须在请求头中包含 `Authorization: Bearer <your_token>`。
- **`ALLOWED_ORIGINS`**: 限制可以访问你代理的域名。默认值为 `*`。例如：`https://chat.example.com`。

### 3. 模型设置
你可以通过设置环境变量来覆盖默认模型：
- `SCORING_MODEL`: 用于复杂度评分的模型。
- `LITE_MODEL`: 处理极简任务的模型。
- `SIMPLE_MODEL`: 处理中低难度任务的模型。
- `COMPLEX_MODEL`: 处理高难度任务的模型。

### 4. 功能开关：`ENABLE_DIFFICULTY_PROMPT`
启用后，AI 在回答前会追加难度标识：
- **Lite**: "请以「这个问题不难」作为开始回答问题"
- **Flash**: "请以「这个问题难度正常」作为开始回答问题"
- **Pro**: "请以「这个问题有难度」作为开始回答问题"

**默认值**: 启用。设置为 `"false"` 或 `"0"` 可关闭。

## 🖥️ 在 Cherry Studio 中使用
1. **设置** -> **模型提供商** -> **Google Gemini**。
2. **API Key**: 输入真实的 Gemini Key。
3. **代理地址**: 输入你部署后的 URL。
4. 开始聊天！代理将自动处理模型切换。

## 📄 许可证
MIT

---

<a name="繁體中文"></a>
## 🌟 主要特性

- **多平台支持**: 可部署在 **Cloudflare Workers** 或 **Vercel Edge Functions**。
- **智能路由**: 使用 `gemini-3.1-flash-lite-preview` 評估提示詞複雜度（1-100分）。
- **三級模型支持**:
  - **Lite (< 30)**: 處理簡單問候、基礎事實。
  - **Flash (30-69)**: 處理標準推理、編程任務、多步指令。
  - **Pro (>= 70)**: 處理複雜架構設計、深度研究、高級調試。
- **原生接口兼容**: 完全兼容 Google Gemini 原生格式 (`/v1beta/models`)。
- **無縫集成**: 模擬官方提供商，完美匹配 **Cherry Studio** 等客戶端。
- **流式輸出**: 完美支持 `streamGenerateContent`。

## 🚀 部署指南

### 選項 1：Cloudflare Workers（推薦）

#### GitHub 自動部署
1. Fork 本倉庫。
2. 在 Cloudflare 控制台，進入 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**。
3. 選擇你 Fork 的倉庫並部署。

#### 手動部署
1. 安裝 Wrangler: `npm install -g wrangler`
2. 登錄: `wrangler login`
3. 部署: `npm run deploy`

---

### 選項 2：Vercel Edge Functions

#### Vercel 面板部署
1. Fork 本倉庫。
2. 在 Vercel 控制台，點擊 **Add New** -> **Project** 並導入倉庫。
3. 點擊 **Deploy**，Vercel 會自動識別配置。

## ⚙️ 配置說明

### 1. API 金鑰 (Security)
代理優先使用客戶端傳入的 Key (`x-goog-api-key`)。設置備用 Key：
- **Cloudflare**: 進入 Worker -> **設置** -> **變量** -> 添加名為 `GEMINI_API_KEY` 的 **加密變量 (Secret)**。
- **Vercel**: 進入項目 -> **Settings** -> **Environment Variables** -> 添加 `GEMINI_API_KEY`。

### 2. 安全設置 (新增)
防止他人盜用你的代理：
- **`AUTH_TOKEN`**: 設置一個秘密字符串。啟用後，客戶端必須在請求頭中包含 `Authorization: Bearer <your_token>`。
- **`ALLOWED_ORIGINS`**: 限制可以訪問你代理的域名。默認值為 `*`。例如：`https://chat.example.com`。

### 3. 模型設置
你可以通過設置環境變量來覆蓋默認模型：
- `SCORING_MODEL`: 用於複雜度評分的模型。
- `LITE_MODEL`: 處理極简任務的模型。
- `SIMPLE_MODEL`: 處理中低難度任務的模型。
- `COMPLEX_MODEL`: 處理高難度任務的模型。

### 4. 功能開關：`ENABLE_DIFFICULTY_PROMPT`
啟用後，AI 在回答前會追加難度標識：
- **Lite**: "請以「這個問題不難」作為開始回答問題"
- **Flash**: "請以「這個問題難度正常」作為開始回答問題"
- **Pro**: "請以「這個問題有難度」作為開始回答問題"

**默認值**: 啟用。設置為 `"false"` 或 `"0"` 可關閉。

## 🖥️ 在 Cherry Studio 中使用
1. **設置** -> **模型提供商** -> **Google Gemini**。
2. **API Key**: 輸入真實的 Gemini Key。
3. **代理地址**: 輸入你部署後的 URL。
4. 開始聊天！代理將自動處理模型切換。

## 📄 許可證
MIT
