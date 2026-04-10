import torch
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import os
import json
import base64
from io import BytesIO
import numpy as np

# Simulate api.py global state
VECTOR_MODEL_NAME = "openai/clip-vit-base-patch32"
BASE_DIR = r"c:\Sunevit\Assistant\backend-ai"
VECTORS_PATH = os.path.join(BASE_DIR, "product_vectors.pt")
CATALOG_PATH = os.path.join(BASE_DIR, "barsha_products.json")

def simulate_like_this():
    print("--- Simulating like_this implementation ---")
    
    # Initialization (like startup_event)
    try:
        CLIP_MODEL = CLIPModel.from_pretrained(VECTOR_MODEL_NAME).to("cpu")
        CLIP_PROCESSOR = CLIPProcessor.from_pretrained(VECTOR_MODEL_NAME)
        CLIP_MODEL.eval()
        
        data = torch.load(VECTORS_PATH, weights_only=False, map_location="cpu")
        PRODUCT_IDS = data["ids"]
        embeddings_raw = data["embeddings"]
        if isinstance(embeddings_raw, np.ndarray):
            PRODUCT_VECS = torch.from_numpy(embeddings_raw).float()
        else:
            PRODUCT_VECS = torch.tensor(embeddings_raw).float()
        PRODUCT_VECS = torch.nn.functional.normalize(PRODUCT_VECS, p=2, dim=-1)
        print("Initialization OK.")
    except Exception as e:
        print(f"Init Error: {e}")
        return

    # Request simulation
    try:
        # Create a red 224x224 image
        img = Image.new('RGB', (224, 224), color = 'red')
        
        # Like this logic
        inputs = CLIP_PROCESSOR(images=img, return_tensors="pt")
        with torch.no_grad():
            outputs = CLIP_MODEL.get_image_features(**inputs)
        
        query_vec = torch.nn.functional.normalize(outputs, p=2, dim=-1).to("cpu").float()
        cos_scores = torch.matmul(PRODUCT_VECS, query_vec.T).squeeze()
        
        top_results = torch.topk(cos_scores, k=min(5, len(PRODUCT_IDS)))
        print(f"Top scores: {top_results[0]}")
        
        with open(CATALOG_PATH, "r", encoding="utf-8") as f:
            full_catalog = json.load(f)
        catalog_map = {str(p["id"]): p for p in full_catalog}
        
        final_lines = []
        for score, idx in zip(top_results[0], top_results[1]):
            pid = str(PRODUCT_IDS[idx.item()])
            if pid in catalog_map:
                product = catalog_map[pid]
                # Simulate format_product_line
                name = product.get("nom", "N/A")
                final_lines.append(f"- [ID:{pid}] {name}")
                
        print(f"SUCCESS: {len(final_lines)} results found.")
    except Exception as e:
        print(f"Runtime Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    simulate_like_this()
