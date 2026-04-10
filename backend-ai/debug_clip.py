import torch
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import os
import json
import base64
from io import BytesIO
import numpy as np

# Mocking the constants from api.py
VECTOR_MODEL_NAME = "openai/clip-vit-base-patch32"
BASE_DIR = r"c:\Sunevit\Assistant\backend-ai"
VECTORS_PATH = os.path.join(BASE_DIR, "product_vectors.pt")
CATALOG_PATH = os.path.join(BASE_DIR, "barsha_products.json")

def test_clip_logic():
    print("--- Testing CLIP logic ---")
    
    # 1. Load Model
    try:
        print(f"Loading {VECTOR_MODEL_NAME}...")
        model = CLIPModel.from_pretrained(VECTOR_MODEL_NAME)
        processor = CLIPProcessor.from_pretrained(VECTOR_MODEL_NAME)
        model.eval()
        print("Model loaded.")
    except Exception as e:
        print(f"FAILED to load model: {e}")
        return

    # 2. Load Vectors
    try:
        print(f"Loading {VECTORS_PATH}...")
        data = torch.load(VECTORS_PATH, weights_only=False)
        product_ids = data["ids"]
        # In api.py: PRODUCT_VECS = torch.from_numpy(data["embeddings"]).float()
        # BUT let's check the type again
        embeddings = data["embeddings"]
        if isinstance(embeddings, np.ndarray):
            product_vecs = torch.from_numpy(embeddings).float()
        else:
            product_vecs = torch.tensor(embeddings).float()
        print(f"Vectors loaded: {len(product_ids)} items.")
    except Exception as e:
        print(f"FAILED to load vectors: {e}")
        return

    # 3. Simulate an image
    # Red dot image
    red_dot = Image.new('RGB', (100, 100), color = 'red')
    
    # 4. Process image
    try:
        print("Processing image...")
        inputs = processor(images=red_dot, return_tensors="pt")
        with torch.no_grad():
            outputs = model.get_image_features(**inputs)
        query_vec = torch.nn.functional.normalize(outputs, p=2, dim=-1).float()
        print(f"Query vector shape: {query_vec.shape}")
    except Exception as e:
        print(f"FAILED to process image: {e}")
        return

    # 5. Search
    try:
        print("Searching...")
        cos_scores = torch.matmul(product_vecs, query_vec.T).squeeze()
        top_results = torch.topk(cos_scores, k=min(5, len(product_ids)))
        print(f"Top scores: {top_results[0]}")
    except Exception as e:
        print(f"FAILED search: {e}")
        return

    print("--- SUCCESS ---")

if __name__ == "__main__":
    test_clip_logic()
