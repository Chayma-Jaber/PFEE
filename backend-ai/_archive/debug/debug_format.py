import asyncio
import sys
sys.path.insert(0, '.')
from api import search_barsha_catalog, ChatMessage

async def debug():
    history = [ChatMessage(role="user", content="je veux une robe noire")]
    result = await search_barsha_catalog("robe noire", history)
    print("=== CATALOG OUTPUT (3 lines) ===")
    lines = [l for l in result.split('\n') if l.startswith('- [ID:')]
    for l in lines[:3]:
        print(repr(l))
        print()

asyncio.run(debug())
