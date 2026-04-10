import asyncio
import httpx

async def test():
    url = "http://localhost:8000/api/chat"
    payload = {"messages": [{"role": "user", "content": "robe noire"}]}
    async with httpx.AsyncClient() as c:
        r = await c.post(url, json=payload, timeout=60.0)
        print(r.json()["choices"][0]["message"]["content"])

asyncio.run(test())
