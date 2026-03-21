// ================= 配置区 =================
const LITE_MODEL = "gemini-3.1-flash-lite-preview";
const SIMPLE_MODEL = "gemini-3-flash-preview";
const COMPLEX_MODEL = "gemini-3.1-pro-preview";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// 如果你在 Worker 的环境变量中配置了 GEMINI_API_KEY，这里可以作为后备
// 但由于 Cherry Studio 默认通过 Header 传 Key，这里保持为空即可。
// ==========================================

export default {
  async fetch(request, env, ctx) {
    // 1. 处理 CORS (跨域请求)，供 Cherry Studio 等工具使用
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

    // 解析请求路径，提取 action (例如 :streamGenerateContent)
    const match = url.pathname.match(/\/v1beta\/models\/([^:]+):(.+)/);
    if (!match) {
      return new Response("Invalid URL format", { status: 400 });
    }
    const action = match[2];

    // 2. 提取 API Key
    const apiKey = request.headers.get("x-goog-api-key") || env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing API Key" }), { 
        status: 401, 
        headers: { "Content-Type": "application/json" } 
      });
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

    // 3. 提取用户最后一个问题进行复杂度评估
    let lastUserMessage = "Hello";
    for (let i = contents.length - 1; i >= 0; i--) {
      const c = contents[i];
      if (c.role === "user" || !c.role) {
        lastUserMessage = (c.parts || []).map(p => p.text || "").join(" ");
        break;
      }
    }

    // 4. 获取复杂度评分
    const score = await getComplexityScore(lastUserMessage, apiKey);

    // 5. 模型路由
    let targetModel = LITE_MODEL;
    if (score >= 70) {
      targetModel = COMPLEX_MODEL;
    } else if (score >= 30) {
      targetModel = SIMPLE_MODEL;
    }

    console.log(`Routing to: ${targetModel} | Score: ${score} | Prompt: ${lastUserMessage.substring(0, 40)}`);

    // 6. 构造目标请求
    const targetUrl = new URL(`${GEMINI_BASE_URL}/${targetModel}:${action}`);
    // 透传 URL 上的 query 参数 (例如 ?alt=sse)
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

    // 7. 转发请求并透传响应 (Cloudflare Worker 默认支持流式转发)
    try {
      let response = await fetch(targetRequest);
      
      // 添加 CORS 响应头
      let newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  },
};

// --- 辅助函数：评估复杂度 ---
async function getComplexityScore(prompt, apiKey) {
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

  try {
    const url = `${GEMINI_BASE_URL}/${LITE_MODEL}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return 30;

    const result = await response.json();
    const scoreStr = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "30";
    
    // 提取数字
    const numMatch = scoreStr.match(/\d+/);
    let score = numMatch ? parseInt(numMatch[0], 10) : 30;
    
    // 限制范围
    return Math.max(1, Math.min(100, score));
  } catch (err) {
    console.error("Score check failed:", err);
    return 30;
  }
}
