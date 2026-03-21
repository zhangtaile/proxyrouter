import asyncio
import json
import httpx
import os
import sys
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

# ================= 配置区 =================
# 优先级：Cherry Studio 传入的 Key > 环境变量 GEMINI_API_KEY
DEFAULT_GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# 模型配置
LITE_MODEL = "gemini-3.1-flash-lite-preview"     # 用于判断复杂度
SIMPLE_MODEL = "gemini-3-flash-preview"          # 简单任务模型
COMPLEX_MODEL = "gemini-3.1-pro-preview"         # 复杂任务模型

# Google Gemini 原生接口路径
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# 监听配置
HOST = "127.0.0.1"
PORT = 1234
# ==========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """管理 HTTP 客户端生命周期"""
    app.state.client = httpx.AsyncClient(timeout=60.0)
    yield
    await app.state.client.aclose()
    print("Proxy server shut down and client closed.")

app = FastAPI(lifespan=lifespan)

# 添加 CORS 支持，确保 Cherry Studio 等工具在各种环境下都能顺利访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def get_complexity_score(prompt: str, api_key: str) -> int:
    """
    使用 Lite 模型对用户问题进行复杂度评分。返回 1-100 的分数。
    70 分以上使用 Pro 模型，0-69 分使用 Flash 模型。
    """
    if not prompt:
        return 30 # 太短的默认低分

    try:
        payload = {
            "systemInstruction": {
                "parts": [
                    {
                        "text": "You are a routing assistant. Rate the complexity of the user's prompt on a scale of 1-100.\n\nScoring guide:\n- 1-30: Simple greetings, basic facts, yes/no questions, short translations\n- 31-50: Basic code tasks, simple explanations, straightforward requests\n- 51-70: Moderate reasoning, multi-step tasks, detailed explanations\n- 71-90: Complex reasoning, architecture design, complex debugging, creative writing\n- 91-100: Advanced research, system design, long-form content, deep analysis\n\nReply ONLY with a number (1-100)."
                    }
                ]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "maxOutputTokens": 20,
                "temperature": 0.1
            }
        }
        
        headers = {
            "x-goog-api-key": api_key,
            "Content-Type": "application/json"
        }
        
        # print(f"[LITE] Sending complexity check | Model: {LITE_MODEL} | Prompt: \"{prompt[:50]}...\"")
        
        url = f"{GEMINI_BASE_URL}/{LITE_MODEL}:generateContent"
        response = await app.state.client.post(
            url,
            json=payload,
            headers=headers
        )
        
        if response.status_code != 200:
            print(f"Complexity check API error: {response.status_code}")
            return 30

        result = response.json()
        try:
            score_str = result['candidates'][0]['content']['parts'][0]['text'].strip()
        except (KeyError, IndexError):
            print(f"Complexity check failed to parse response: {result}")
            return 30
            
        # 提取数字
        score = int(''.join(filter(str.isdigit, score_str)) or '30')
        score = max(1, min(100, score)) # 限制在 1-100 范围
        
        if score >= 70:
            model_choice = "[PRO]"
        elif score >= 30:
            model_choice = "[FLASH]"
        else:
            model_choice = "[LITE]"
            
        print(f"Decision: {model_choice} | Score: {score}/100 (Lite output: {score_str})")
        return score
    except Exception as e:
        print(f"Complexity check failed: {e}, defaulting to score 30.")
        return 30

@app.post("/v1beta/models/{model}:{action}")
async def proxy_gemini(model: str, action: str, request: Request):
    """
    接管 Gemini 原生接口。
    action 支持 `generateContent` 和 `streamGenerateContent`。
    优先从请求头获取 API Key。
    """
    # 1. 提取 API Key
    api_key = request.headers.get("x-goog-api-key") or DEFAULT_GEMINI_API_KEY
    if not api_key:
        return Response(content=json.dumps({"error": "Missing API Key"}), status_code=401)

    try:
        body = await request.json()
        # 调试：打印完整请求体
        # print(f"[DEBUG] Received request body: {json.dumps(body, indent=2, ensure_ascii=False)}")
    except Exception:
        return Response(content="Invalid JSON", status_code=400)

    contents = body.get("contents", [])
    if not contents:
        return Response(content="No contents provided", status_code=400)

    # 2. 获取用户最后一个问题进行复杂度评估
    last_user_message = ""
    for c in reversed(contents):
        if c.get("role") in ["user", None]: # role 可能是 None 或 user
            parts = c.get("parts", [])
            last_user_message = " ".join([p.get("text", "") for p in parts if "text" in p])
            break

    if not last_user_message:
        last_user_message = "Hello" # 如果只有图片等无文本情况的 fallback
        
    complexity_score = await get_complexity_score(last_user_message, api_key)

    # 3. 根据评分结果切换模型 (>=70 用 Pro，30-69 用 Flash，<30 用 Lite)
    if complexity_score >= 70:
        target_model = COMPLEX_MODEL
    elif complexity_score >= 30:
        target_model = SIMPLE_MODEL
    else:
        target_model = LITE_MODEL
        
    print(f"Routing request to: {target_model} | Action: {action} | Score: {complexity_score}/100 | Prompt: \"{last_user_message[:40]}...\"")

    # 4. 准备转发请求
    headers = {
        "x-goog-api-key": api_key,
        "Content-Type": "application/json"
    }
    
    # 构建目标 URL，透传查询参数 (例如 ?alt=sse)
    query_string = request.url.query
    target_url = f"{GEMINI_BASE_URL}/{target_model}:{action}"
    if query_string:
        target_url += f"?{query_string}"

    # print(f"[DEBUG] Forwarding to URL: {target_url}")

    # 5. 根据不同的 action 处理流式或非流式
    if action == "streamGenerateContent":
        async def stream_generator():
            try:
                print(f"[STREAM] Forwarding to {target_model} | Streaming: true")
                async with app.state.client.stream(
                    "POST", 
                    target_url, 
                    json=body, 
                    headers=headers
                ) as resp:
                    if resp.status_code != 200:
                        error_detail = await resp.aread()
                        print(f"Upstream Error: {error_detail}")
                        yield error_detail
                        return

                    chunk_count = 0
                    async for chunk in resp.aiter_bytes():
                        chunk_count += 1
                        # if chunk_count <= 3:  # 只打印前3个数据块
                        #     print(f"[DEBUG] Stream chunk {chunk_count}: {chunk.decode(errors='ignore')[:200]}...")
                        yield chunk
            except Exception as e:
                print(f"Streaming error: {e}")
                yield json.dumps({'error': str(e)}).encode()
                
        # 原生 Gemini 接口如果附加了 ?alt=sse，则以 text/event-stream 响应
        media_type = "text/event-stream" if "alt=sse" in query_string else "application/json"
        return StreamingResponse(stream_generator(), media_type=media_type)
    else:
        # 非流式传输
        try:
            print(f"[REQUEST] Forwarding to {target_model} | Streaming: false")
            resp = await app.state.client.post(
                target_url, 
                json=body, 
                headers=headers
            )
            # 调试：打印响应内容
            response_text = resp.text
            # print(f"[DEBUG] Received response status: {resp.status_code}")
            # print(f"[DEBUG] Received response body (first 500 chars): {response_text[:500]}...")
            return Response(content=resp.content, status_code=resp.status_code, media_type="application/json")
        except Exception as e:
            print(f"Proxy error: {e}")
            return Response(content=json.dumps({"error": str(e)}), status_code=500, media_type="application/json")

if __name__ == "__main__":
    import uvicorn
    
    # Windows 兼容性处理：设置 ProactorEventLoopPolicy 以支持大量并发连接
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    print(f"Starting Smart Router on http://{HOST}:{PORT}")
    print(f"Configured Models: Lite={LITE_MODEL}, Simple={SIMPLE_MODEL}, Complex={COMPLEX_MODEL}")
    
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
