import httpx
import json
import asyncio
import traceback

async def test():
    url = "http://localhost:8000/api/chat"
    payload = {
        "messages": [
            {"role": "user", "content": "robe noire"}
        ],
        "user_context": {"isLoggedIn": False}
    }
    
    print("Testing API...")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=30.0)
            print(f"Status Code: {resp.status_code}")
            if resp.status_code == 200:
                print("Success!")
                print(resp.json()["choices"][0]["message"]["content"][:200])
            else:
                print("Error Body:")
                print(resp.text)
    except Exception as e:
        print(f"Exception: {str(e)}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
