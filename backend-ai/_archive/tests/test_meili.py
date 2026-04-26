import httpx
import asyncio

MEILI_URL = "https://cache-data.barsha.com.tn/indexes/products/search"
MEILI_TOKEN = "Bearer 660ac272a4c62f4138f96bc52d33f1d6de8a182712321c667f516312f2db200c"

async def test_search(query: str):
    headers = {"Authorization": MEILI_TOKEN, "Content-Type": "application/json"}
    payload = {"q": query, "limit": 20}
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(MEILI_URL, headers=headers, json=payload, timeout=10.0)
            data = resp.json()
            hits = data.get("hits", [])
            print(f"Query: '{query}' -> Found {len(hits)} hits.")
            for hit in hits[:3]:
                print(f" - {hit.get('name')} | {hit.get('id')}")
        except Exception as e:
            print(f"Error for '{query}': {e}")

async def main():
    queries = ["robe", "jupe", "robe rouge", "tenue travail", "chemise homme"]
    for q in queries:
        await test_search(q)

if __name__ == "__main__":
    asyncio.run(main())
