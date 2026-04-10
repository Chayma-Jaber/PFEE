import httpx
import base64
import json
import asyncio
from PIL import Image
from io import BytesIO

async def test_real_search():
    # Créer une image 224x224
    img = Image.new('RGB', (224, 224), color = 'blue')
    buffered = BytesIO()
    img.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode()

    payload = {"image_base64": img_str}
    
    print("Envoi de la requête au backend (CLIP Local)...")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post("http://localhost:8000/api/like-this", json=payload, timeout=60.0)
            data = resp.json()
            print(f"Status: {resp.status_code}")
            print(f"Méthode: {data.get('method')}")
            sims = data.get('similaires', [])
            print(f"Nombre de résultats: {len(sims)}")
            for i, s in enumerate(sims[:3]):
                print(f"Result {i+1}: {s[:120]}...")
        except Exception as e:
            print(f"Erreur: {e}")

if __name__ == "__main__":
    asyncio.run(test_real_search())
