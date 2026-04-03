// ================= 默认配置 =================
const DEFAULT_SCORING_MODEL = "gemini-3.1-flash-lite-preview";
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

  const SCORING_MODEL = getEnv("SCORING_MODEL") || DEFAULT_SCORING_MODEL;
  const LITE_MODEL = getEnv("LITE_MODEL") || DEFAULT_LITE_MODEL;
  const SIMPLE_MODEL = getEnv("SIMPLE_MODEL") || DEFAULT_SIMPLE_MODEL;
  const COMPLEX_MODEL = getEnv("COMPLEX_MODEL") || DEFAULT_COMPLEX_MODEL;
  const ENABLE_DIFFICULTY_PROMPT = getEnv("ENABLE_DIFFICULTY_PROMPT");
  const AUTH_TOKEN = getEnv("AUTH_TOKEN");
  const ALLOWED_ORIGINS = getEnv("ALLOWED_ORIGINS") || "*";
  const shouldAppendDifficulty = !ENABLE_DIFFICULTY_PROMPT || !["false", "0"].includes(ENABLE_DIFFICULTY_PROMPT.toLowerCase());

  // 1. 处理 CORS 和安全头
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-goog-api-key, Authorization",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 2. 身份验证 (如果设置了 AUTH_TOKEN)
  if (AUTH_TOKEN) {
    const authHeader = request.headers.get("Authorization");
    const expectedAuth = `Bearer ${AUTH_TOKEN}`;
    if (authHeader !== expectedAuth) {
      return new Response(JSON.stringify({ error: "Unauthorized access" }), { 
        status: 403, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  }

  const url = new URL(request.url);
  
  // 只处理 /v1beta/models/... 的 POST 请求
  if (!url.pathname.startsWith("/v1beta/models/") || request.method !== "POST") {
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }

  // 解析请求路径，提取 action
  const match = url.pathname.match(/\/v1beta\/models\/([^:]+):(.+)/);
  if (!match) {
    return new Response("Invalid URL format", { status: 400, headers: corsHeaders });
  }
  const action = match[2];

  // 3. 提取 API Key
  const apiKey = request.headers.get("x-goog-api-key") || getEnv("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("[ERROR] Missing API Key.");
    return new Response(JSON.stringify({ error: "Missing API Key" }), { 
      status: 401, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  // 4. OOM (内存溢出) 保护
  const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
  const OOM_THRESHOLD = 5 * 1024 * 1024; // 5MB
  if (contentLength > OOM_THRESHOLD) {
    console.warn(`[WARNING] Payload too large (${contentLength} bytes). Routing directly to FLASH.`);
    
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
      Object.entries(corsHeaders).forEach(([k, v]) => responseHeaders.set(k, v));
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    } catch (err) {
      console.error(`[ERROR] OOM bypass fetch failed: ${err.message}`);
      return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const contents = body.contents || [];
  if (contents.length === 0) {
    return new Response("No contents provided", { status: 400, headers: corsHeaders });
  }

  // 5. 提取最近 2 轮的对话内容
  let hasMultimodal = false;
  const recentContext = contents.slice(-2).map(c => {
    const parts = c.parts || [];
    if (parts.some(p => p.inlineData || p.fileData || p.videoMetadata)) {
      hasMultimodal = true;
    }
    let text = parts.filter(p => !p.thought).map(p => p.text || "").join(" ");
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    if (text.length > 500) text = "..." + text.slice(-500);
    return `${c.role || "user"}: ${text}`;
  }).join("\n");

  // 6. 获取复杂度评分
  let score;
  try {
    score = await getComplexityScore(recentContext, apiKey, SCORING_MODEL);
  } catch (err) {
    if (err.message.startsWith("AUTH_FAILED:")) {
      const status = parseInt(err.message.split(":")[1], 10);
      return new Response(JSON.stringify({ error: "Upstream Authentication Failed" }), { 
        status: status, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    score = 50;
  }

  if (hasMultimodal && score < 40) score = 40;

  // 7. 模型路由
  let targetModel = LITE_MODEL;
  let modelLabel = "LITE";
  if (score >= 70) {
    targetModel = COMPLEX_MODEL;
    modelLabel = "PRO";
  } else if (score >= 30) {
    targetModel = SIMPLE_MODEL;
    modelLabel = "FLASH";
  }

  console.log(`[ROUTE] Score: ${score}/100 | Decision: ${modelLabel}`);

  // 动态追加系统指令
  if (shouldAppendDifficulty) {
    let systemInstructionAppend = "";
    if (modelLabel === "LITE") systemInstructionAppend = "请以\"这个问题不难\n\"作为开始回答问题";
    else if (modelLabel === "FLASH") systemInstructionAppend = "请以\"这个问题难度正常\n\"作为开始回答问题";
    else if (modelLabel === "PRO") systemInstructionAppend = "请以\"这个问题有难度\n\"作为开始回答问题";

    if (!body.systemInstruction) body.systemInstruction = { parts: [{ text: systemInstructionAppend }] };
    else if (!body.systemInstruction.parts) body.systemInstruction.parts = [{ text: systemInstructionAppend }];
    else body.systemInstruction.parts.push({ text: "\n\n" + systemInstructionAppend });
  }

  // 8. 构造目标请求
  const targetUrl = new URL(`${GEMINI_BASE_URL}/${targetModel}:${action}`);
  url.searchParams.forEach((value, key) => targetUrl.searchParams.append(key, value));

  const targetRequest = new Request(targetUrl.toString(), {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // 9. 转发并透传
  try {
    let response = await fetch(targetRequest);
    let responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => responseHeaders.set(k, v));
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Proxy Error" }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

// --- 辅助函数：评估复杂度 ---
async function getComplexityScore(prompt, apiKey, scoringModel) {
  if (!prompt) return 30;

  const payload = {
    systemInstruction: {
      parts: [{
        text: "You are a routing assistant. Rate the complexity of the user's prompt on a scale of 1-100. Reply ONLY with a number."
      }]
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 20, temperature: 0.1 }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const url = `${GEMINI_BASE_URL}/${scoringModel}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error(`AUTH_FAILED:${response.status}`);
      return 50;
    }

    const result = await response.json();
    const scoreStr = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "50";
    const numMatch = scoreStr.match(/\d+/);
    return numMatch ? Math.max(1, Math.min(100, parseInt(numMatch[0], 10))) : 50;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.message.startsWith("AUTH_FAILED:")) throw err;
    return 50;
  }
}
