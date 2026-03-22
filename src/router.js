// ================= 默认配置 =================
const DEFAULT_LITE_MODEL = "gemini-3.1-flash-lite-preview";
const DEFAULT_SIMPLE_MODEL = "gemini-3-flash-preview";
const DEFAULT_COMPLEX_MODEL = "gemini-3.1-pro-preview";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * 核心路由逻辑
 * @param {Request} request 
 * @param {Object} env 环境变量对象
 */
export async function handleRequest(request, env = {}) {
  // 获取配置，优先使用传入的 env，其次尝试全局 process.env，最后使用默认值
  const getEnv = (key) => env?.[key] || (typeof process !== 'undefined' ? process.env?.[key] : undefined);
  
  const LITE_MODEL = getEnv("LITE_MODEL") || DEFAULT_LITE_MODEL;
  const SIMPLE_MODEL = getEnv("SIMPLE_MODEL") || DEFAULT_SIMPLE_MODEL;
  const COMPLEX_MODEL = getEnv("COMPLEX_MODEL") || DEFAULT_COMPLEX_MODEL;

  // 1. 处理 CORS (跨域请求)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-goog-api-key, Authorization",
      },
    });
  }

  const url = new URL(request.url);
  
  // 只处理 /v1beta/models/... 的 POST 请求
  if (!url.pathname.startsWith("/v1beta/models/") || request.method !== "POST") {
    return new Response("Not Found", { status: 404 });
  }

  // 解析请求路径，提取 action
  const match = url.pathname.match(/\/v1beta\/models\/([^:]+):(.+)/);
  if (!match) {
    return new Response("Invalid URL format", { status: 400 });
  }
  const action = match[2];

  // 2. 提取 API Key
  const apiKey = request.headers.get("x-goog-api-key") || getEnv("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("[ERROR] Missing API Key. Check request headers (x-goog-api-key) or env variables.");
    return new Response(JSON.stringify({ error: "Missing API Key" }), { 
      status: 401, 
      headers: { "Content-Type": "application/json" } 
    });
  }

  // 2.5 OOM (内存溢出) 保护
  const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
  const OOM_THRESHOLD = 5 * 1024 * 1024; // 5MB
  if (contentLength > OOM_THRESHOLD) {
    console.warn(`[WARNING] Payload too large (${contentLength} bytes). Triggering OOM protection. Routing directly to FLASH.`);
    
    const targetUrl = new URL(`${GEMINI_BASE_URL}/${SIMPLE_MODEL}:${action}`);
    url.searchParams.forEach((value, key) => targetUrl.searchParams.append(key, value));

    const newHeaders = new Headers(request.headers);
    newHeaders.set("x-goog-api-key", apiKey);

    const targetRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      duplex: "half"
    });

    try {
      let response = await fetch(targetRequest);
      let responseHeaders = new Headers(response.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    } catch (err) {
      console.error(`[ERROR] OOM bypass fetch failed: ${err.message}`);
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const contents = body.contents || [];
  if (contents.length === 0) {
    return new Response("No contents provided", { status: 400 });
  }

  // 3. 提取最近 2 轮的对话内容作为评估依据
  const recentContext = contents.slice(-2).map(c => {
    let text = (c.parts || [])
      .filter(p => !p.thought)
      .map(p => p.text || "")
      .join(" ");
    
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    if (text.length > 500) {
      text = "..." + text.slice(-500);
    }
    return `${c.role || "user"}: ${text}`;
  }).join("\n");

  // 4. 获取复杂度评分
  const score = await getComplexityScore(recentContext, apiKey, LITE_MODEL);

  // 5. 模型路由
  let targetModel = LITE_MODEL;
  let modelLabel = "LITE";
  if (score >= 70) {
    targetModel = COMPLEX_MODEL;
    modelLabel = "PRO";
  } else if (score >= 30) {
    targetModel = SIMPLE_MODEL;
    modelLabel = "FLASH";
  }

  console.log(`[ROUTE] Score: ${score}/100 | Decision: ${modelLabel} (${targetModel})`);

  // 动态追加系统指令
  let systemInstructionAppend = "";
  if (modelLabel === "LITE") {
    systemInstructionAppend = "请以\"这个问题不难\n\"作为开始回答问题";
  } else if (modelLabel === "FLASH") {
    systemInstructionAppend = "请以\"这个问题难度正常\n\"作为开始回答问题";
  } else if (modelLabel === "PRO") {
    systemInstructionAppend = "请以\"这个问题有难度\n\"作为开始回答问题";
  }

  if (!body.systemInstruction) {
    body.systemInstruction = { parts: [{ text: "" }] };
  } else if (!body.systemInstruction.parts || !Array.isArray(body.systemInstruction.parts)) {
    body.systemInstruction.parts = [{ text: "" }];
  } else if (body.systemInstruction.parts.length === 0) {
    body.systemInstruction.parts.push({ text: "" });
  } else if (typeof body.systemInstruction.parts[0].text !== "string") {
    body.systemInstruction.parts[0].text = "";
  }
  
  const existingText = body.systemInstruction.parts[0].text;
  body.systemInstruction.parts[0].text = existingText 
    ? existingText + "\n\n" + systemInstructionAppend
    : systemInstructionAppend;

  // 6. 构造目标请求
  const targetUrl = new URL(`${GEMINI_BASE_URL}/${targetModel}:${action}`);
  url.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  const targetRequest = new Request(targetUrl.toString(), {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // 7. 转发请求并透传响应
  try {
    let response = await fetch(targetRequest);
    let newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (err) {
    console.error(`[ERROR] Proxy fetch failed: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// --- 辅助函数：评估复杂度 ---
async function getComplexityScore(prompt, apiKey, LITE_MODEL) {
  if (!prompt) return 30;

  const payload = {
    systemInstruction: {
      parts: [{
        text: "You are a routing assistant. Rate the complexity of the user's prompt on a scale of 1-100.\n\nScoring guide:\n- 1-30: Simple greetings, basic facts, yes/no questions, short translations\n- 31-50: Basic code tasks, simple explanations, straightforward requests\n- 51-70: Moderate reasoning, multi-step tasks, detailed explanations\n- 71-90: Complex reasoning, architecture design, complex debugging, creative writing\n- 91-100: Advanced research, system design, long-form content, deep analysis\n\nReply ONLY with a number (1-100)."
      }]
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 20, temperature: 0.1 }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

  try {
    const url = `${GEMINI_BASE_URL}/${LITE_MODEL}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) return 50;

    const result = await response.json();
    const scoreStr = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "50";
    const numMatch = scoreStr.match(/\d+/);
    let score = numMatch ? parseInt(numMatch[0], 10) : 50;
    return Math.max(1, Math.min(100, score));
  } catch (err) {
    clearTimeout(timeoutId);
    return 50;
  }
}
