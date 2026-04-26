import httpx
import asyncio
import json

async def debug_response():
    url = "http://localhost:8000/api/chat"
    payload = {
        "messages": [
            {"role": "user", "content": "robe noire pour femme"}
        ],
        "user_context": {"isLoggedIn": False}
    }
    
    print(f"Envoi de la requête à {url}...")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, timeout=60.0)
            print(f"Status: {resp.status_code}")
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            print("\n--- CONTENU BRUT DU CHAT ---")
            print(content)
            print("\n--- ANALYSE LIGNES PRODUITS ---")
            lines = content.split('\n')
            for line in lines:
                if '[ID:' in line:
                    print(f"LIGNE: {line}")
        except Exception as e:
            print(f"Erreur: {str(e)}")

if __name__ == "__main__":
    asyncio.run(debug_response())
