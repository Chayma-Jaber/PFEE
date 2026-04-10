import json
import torch
import numpy as np
from PIL import Image
import requests
from io import BytesIO
from transformers import CLIPProcessor, CLIPModel
import os
import time
from tqdm import tqdm

# Configuration
CATALOG_FILE = "backend-ai/barsha_products.json"
OUTPUT_FILE = "backend-ai/product_vectors.pt"
MODEL_NAME = "openai/clip-vit-base-patch32"

def generate_embeddings():
    print(f"--- BARSHA VISUAL ENGINE : GÉNÉRATION DES EMBEDDINGS (NATIVE) ---")
    print(f"Chargement du processeur et du modèle {MODEL_NAME}...")
    
    try:
        model = CLIPModel.from_pretrained(MODEL_NAME)
        processor = CLIPProcessor.from_pretrained(MODEL_NAME)
        model.eval() # Mode inférence
    except Exception as e:
        print(f"ERREUR CHARGEMENT : {str(e)}")
        return
    
    if not os.path.exists(CATALOG_FILE):
        print(f"Erreur : Le fichier {CATALOG_FILE} est introuvable.")
        return

    print(f"Lecture du catalogue {CATALOG_FILE}...")
    with open(CATALOG_FILE, "r", encoding="utf-8") as f:
        products = json.load(f)
    
    products_with_image = [p for p in products if p.get("image")]
    print(f"Nombre d'articles à traiter : {len(products_with_image)}")
    
    embeddings = []
    product_ids = []
    
    # Prétraitement et encodage
    error_count = 0
    for p in tqdm(products_with_image, desc="Encodage"):
        img_url = p["image"]
        pid = p["id"]
        
        try:
            resp = requests.get(img_url, timeout=10)
            resp.raise_for_status()
            img = Image.open(BytesIO(resp.content)).convert("RGB")
            
            # Préparation de l'image pour CLIP
            inputs = processor(images=img, return_tensors="pt")
            
            # Calcul de l'embedding (Vector)
            with torch.no_grad():
                res = model.get_image_features(**inputs)
                # S'assurer que 'res' est un tenseur (pour certaines versions de transformers)
                outputs = res.pooler_output if hasattr(res, "pooler_output") else res
            
            # Normalisation (L2) pour la similarité cosinus
            image_features = torch.nn.functional.normalize(outputs, p=2, dim=-1)
            
            embeddings.append(image_features.cpu().numpy()[0])
            product_ids.append(pid)
                
        except Exception as e:
            if error_count < 5:
                print(f"DEBUG ERREUR {pid}: {str(e)}")
            error_count += 1
            continue
    
    if not embeddings:
        print("ERREUR : Aucun vecteur n'a pu être généré.")
        return

    # Sauvegarde finale
    data_to_save = {
        "ids": product_ids,
        "embeddings": np.array(embeddings),
        "model_name": MODEL_NAME,
        "timestamp": time.time()
    }
    
    torch.save(data_to_save, OUTPUT_FILE)
    print(f"\n--- SUCCÈS ! ---")
    print(f"{len(embeddings)} articles sauvegardés dans {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_embeddings()
