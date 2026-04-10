import httpx
import base64
import json
import asyncio
from PIL import Image
from io import BytesIO

async def test_real_search():
    # Créer une image 224x224 (taille standard CLIP)
    img = Image.new('RGB', (224, 224), color = 'blue')
    buffered = BytesIO()
    img.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode()

    payload = {"image_base64": img_str}
    
    print("Envoi de la requête au backend (CLIP Local)...")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post("http://localhost:8000/api/like-this", json=payload, timeout=60.0)
            print(f"Status: {resp.status_code}")
            data = resp.json()
            print(f"Méthode utilisée: {data.get('method', 'N/A')}")
            print(f"Nombre de résultats: {len(data.get('similaires', []))}")
            if data.get('similaires'):
                print(f"Premier résultat: {data.get('similaires')[0][:100]}...")
        except Exception as e:
            print(f"Erreur test: {e}")

if __name__ == "__main__":
    asyncio.run(test_real_search())
