import asyncio
import json
import httpx
import os
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
from contextlib import asynccontextmanager

# ================= 配置区 =================
# 建议通过环境变量设置: set GEMINI_API_KEY=your_key
# 如果不设置环境变量，请将 "YOUR_GEMINI_API_KEY" 替换为真实的 Key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY")

# 模型配置
LITE_MODEL = "gemini-3.1-flash-lite-preview"     # 用于判断复杂度
SIMPLE_MODEL = "gemini-3-flash-preview"          # 简单任务模型
COMPLEX_MODEL = "gemini-3.1-pro-preview"         # 复杂任务模型

# 重要：修正后的 Google OpenAI 兼容路径 (增加 /openai/)
GOOGLE_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

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

async def get_complexity_score(prompt: str) -> int:
    """
    使用 Lite 模型对用户问题进行复杂度评分。返回 1-100 的分数。
    70 分以上使用 Pro 模型，0-69 分使用 Flash 模型。
    """
    if not prompt:
        return 30 # 太短的默认低分

    try:
        payload = {
            "model": LITE_MODEL,
            "messages": [
                {
                    "role": "system", 
                    "content": "You are a routing assistant. Rate the complexity of the user's prompt on a scale of 1-100.\n\nScoring guide:\n- 1-30: Simple greetings, basic facts, yes/no questions, short translations\n- 31-50: Basic code tasks, simple explanations, straightforward requests\n- 51-70: Moderate reasoning, multi-step tasks, detailed explanations\n- 71-90: Complex reasoning, architecture design, complex debugging, creative writing\n- 91-100: Advanced research, system design, long-form content, deep analysis\n\nReply ONLY with a number (1-100)."
                },
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 20,
            "temperature": 0.1
        }
        
        headers = {"Authorization": f"Bearer {GEMINI_API_KEY}"}
        
        print(f"[LITE] Sending complexity check | Model: {LITE_MODEL} | Prompt: \"{prompt[:50]}...\" | Max tokens: {payload['max_tokens']}")
        
        response = await app.state.client.post(
            GOOGLE_ENDPOINT,
            json=payload,
            headers=headers
        )
        
        if response.status_code != 200:
            print(f"Complexity check API error: {response.status_code} - {response.text}")
            return 30

        result = response.json()
        score_str = result['choices'][0]['message']['content'].strip()
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

@app.post("/v1/chat/completions")
async def proxy_chat(request: Request):
    try:
        body = await request.json()
    except Exception:
        return Response(content="Invalid JSON", status_code=400)

    messages = body.get("messages", [])
    if not messages:
        return Response(content="No messages provided", status_code=400)

    # 1. 获取用户最后一个问题进行复杂度评估
    last_user_message = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            content = m.get("content", "")
            if isinstance(content, list): # 处理多模态/复杂输入
                last_user_message = " ".join([item.get("text", "") for item in content if isinstance(item, dict) and item.get("type") == "text"])
            else:
                last_user_message = str(content)
            break

    complexity_score = await get_complexity_score(last_user_message)

    # 2. 根据评分结果切换模型 (>=70 用 Pro，30-69 用 Flash，<30 用 Lite)
    if complexity_score >= 70:
        target_model = COMPLEX_MODEL
    elif complexity_score >= 30:
        target_model = SIMPLE_MODEL
    else:
        target_model = LITE_MODEL
    body["model"] = target_model
    print(f"Routing request to: {target_model} | Score: {complexity_score}/100 | Prompt: \"{last_user_message[:40]}...\"")

    # 3. 准备转发请求
    headers = {
        "Authorization": f"Bearer {GEMINI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # 支持流式传输 (Streaming)
    if body.get("stream", False):
        async def stream_generator():
            try:
                print(f"[STREAM] Forwarding to {target_model} | Messages: {len(messages)} | Streaming: true | Prompt: \"{last_user_message[:50]}...\"")
                async with app.state.client.stream(
                    "POST", 
                    GOOGLE_ENDPOINT, 
                    json=body, 
                    headers=headers
                ) as resp:
                    if resp.status_code != 200:
                        error_detail = await resp.aread()
                        print(f"Upstream Error: {error_detail}")
                        yield f"data: {json.dumps({'error': 'Upstream error', 'details': error_detail.decode()})}\n\n".encode()
                        return

                    async for chunk in resp.aiter_bytes():
                        yield chunk
            except Exception as e:
                print(f"Streaming error: {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n".encode()

        return StreamingResponse(stream_generator(), media_type="text/event-stream")
    else:
        # 非流式传输
        try:
            print(f"[REQUEST] Forwarding to {target_model} | Messages: {len(messages)} | Streaming: false | Prompt: \"{last_user_message[:50]}...\"")
            resp = await app.state.client.post(
                GOOGLE_ENDPOINT, 
                json=body, 
                headers=headers
            )
            return Response(content=resp.content, status_code=resp.status_code, media_type="application/json")
        except Exception as e:
            print(f"Proxy error: {e}")
            return Response(content=json.dumps({"error": str(e)}), status_code=500, media_type="application/json")

if __name__ == "__main__":
    import uvicorn
    print(f"Starting Smart Router on http://localhost:{PORT}")
    print(f"Configured Models: Lite={LITE_MODEL}, Simple={SIMPLE_MODEL}, Complex={COMPLEX_MODEL}")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
