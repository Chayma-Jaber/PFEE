import asyncio
import sys
import json
sys.path.insert(0, '.')
from api import call_meilisearch

async def test_meili():
    res = await call_meilisearch("robe noire", 10)
    for r in res[:2]:
        print(f"Meili ID: {r.get('id')} - Img: {r.get('image')} - FirstImg: {r.get('firstImg')}")

asyncio.run(test_meili())
