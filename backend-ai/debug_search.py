import asyncio
import sys
import traceback
from api import search_barsha_catalog, ChatMessage

async def debug():
    print("Debug: Appel direct de search_barsha_catalog...")
    history = [
        ChatMessage(role="user", content="je veux une robe noire")
    ]
    try:
        res = await search_barsha_catalog("robe noire", history=history)
        print("\n--- RESULTAT ---")
        print(res)
    except Exception:
        print("\n--- ERREUR DETECTEE ---")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug())
