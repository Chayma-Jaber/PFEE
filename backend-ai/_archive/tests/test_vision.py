import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

VISION_MODELS = [
    "google/gemini-flash-1.5",
    "meta-llama/llama-3.2-11b-vision-instruct:free",
    "openai/gpt-4o-mini",
]

VISION_PROMPT = "TEST PROMPT"

async def call_vision_ai(image_base64: str, image_url: str = None):
    if image_url:
        image_content = {"type": "image_url", "image_url": {"url": image_url}}
    else:
        if not image_base64.startswith("data:"):
            image_base64 = f"data:image/jpeg;base64,{image_base64}"
        image_content = {"type": "image_url", "image_url": {"url": image_base64}}

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": VISION_PROMPT},
                image_content
            ]
        }
    ]

    headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}
    payload_base = {
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 400
    }

    async with httpx.AsyncClient() as client:
        for model in VISION_MODELS:
            payload = {**payload_base, "model": model}
            print(f"Trying model {model}...")
            try:
                resp = await client.post(OPENROUTER_URL, headers=headers, json=payload, timeout=30.0)
                print(f"Status Code for {model}: {resp.status_code}")
                try:
                    print(f"Body: {resp.text}")
                except:
                    pass
            except Exception as e:
                print(f"Exception for {model}: {e}")

async def main():
    b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    await call_vision_ai(b64)

asyncio.run(main())
