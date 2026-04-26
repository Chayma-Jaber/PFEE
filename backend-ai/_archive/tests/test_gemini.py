import httpx
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

def list_models():
    print(f"Test Gemini avec la clé: {api_key[:5]}...")
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    resp = httpx.get(url)
    if resp.status_code == 200:
        models = resp.json().get('models', [])
        print("Modèles disponibles :")
        for m in models:
            print(f" - {m['name']}")
    else:
        print(f"Erreur {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    list_models()
