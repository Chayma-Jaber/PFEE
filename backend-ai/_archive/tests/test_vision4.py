import asyncio
import httpx
import os
import json
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

VISION_MODELS = [
    "google/gemini-1.5-flash",
    "google/gemma-3-27b-it:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "openrouter/free"
]

VISION_PROMPT = "Tu es un expert. Reponds avec { 'title_guess': 'TEST', 'famille': 'TEEN WOMEN' }"

async def call_vision_ai(image_base64):
    image_content = {"type": "image_url", "image_url": {"url": image_base64}}
    messages = [{"role": "user", "content": [{"type": "text", "text": VISION_PROMPT}, image_content]}]
    headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}
    payload_base = {"messages": messages, "temperature": 0.1, "max_tokens": 400}

    results = {}
    async with httpx.AsyncClient() as client:
        for model in VISION_MODELS:
            payload = {**payload_base, "model": model}
            try:
                resp = await client.post(OPENROUTER_URL, headers=headers, json=payload, timeout=30.0)
                results[model] = {
                    "code": resp.status_code,
                    "body": resp.json() if resp.status_code == 200 else resp.text
                }
            except Exception as e:
                results[model] = {"error": str(e)}
                
    with open("vision_results2.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

async def main():
    b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    await call_vision_ai(b64)

asyncio.run(main())
