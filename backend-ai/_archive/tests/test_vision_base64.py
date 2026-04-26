import httpx
import base64
import json
import asyncio

# Exemple d'image factice base64 (format PNG, commence par 'i')
PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

API_URL = "http://localhost:8000/api/like-this"

async def test_mime_detection():
    print("--- Test de détection MIME backend ---")
    
    payload = {
        "image_base64": PNG_B64
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(API_URL, json=payload, timeout=40.0)
            print(f"Status Code: {response.status_code}")
            try:
                print(f"Response: {json.dumps(response.json(), indent=2)}")
            except:
                print(f"Raw Response: {response.text}")
        except Exception as e:
            print(f"Erreur: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_mime_detection())
