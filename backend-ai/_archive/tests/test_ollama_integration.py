import httpx
import json
import asyncio

async def test():
    url = "http://localhost:8000/api/chat"
    payload = {
        "messages": [
            {"role": "user", "content": "Bonjour, est-ce que tu fonctionnes en local avec Ollama ?"}
        ],
        "user_context": {"isLoggedIn": False}
    }
    
    print("Test de la connexion Ollama via l'API...")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=60.0)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                print(f"\n--- RÉPONSE DU CHATBOT ---\n{content}\n")
            else:
                print(f"Erreur HTTP {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"Erreur de connexion: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test())
