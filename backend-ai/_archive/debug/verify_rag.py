import asyncio
from api import search_barsha_catalog, clean_search_query

async def test_scenarios():
    scenarios = [
        "Trouve moi des jupes noires",
        "Et maintenant, je veux une robe rouge",
        "Je cherche une tenue de travail chic",
        "Chemise pour homme"
    ]
    
    for q in scenarios:
        print(f"\n--- TESTING QUERY: '{q}' ---")
        clean = clean_search_query(q)
        print(f"Cleaned: '{clean}'")
        results = await search_barsha_catalog(q, limit=3)
        print(f"RAG Results (First 3 lines):\n" + "\n".join(results.split('\n')[:3]))

if __name__ == "__main__":
    asyncio.run(test_scenarios())
