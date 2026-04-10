import torch
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import os
import json
import base64
from io import BytesIO
import numpy as np
import traceback

# Simulate api.py global state
VECTOR_MODEL_NAME = "openai/clip-vit-base-patch32"
BASE_DIR = r"c:\Sunevit\Assistant\backend-ai"
VECTORS_PATH = os.path.join(BASE_DIR, "product_vectors.pt")

def simulate_like_this():
    try:
        model = CLIPModel.from_pretrained(VECTOR_MODEL_NAME).to("cpu")
        processor = CLIPProcessor.from_pretrained(VECTOR_MODEL_NAME)
        model.eval()
        
        data = torch.load(VECTORS_PATH, weights_only=False, map_location="cpu")
        PRODUCT_VECS = torch.from_numpy(data["embeddings"]).float()
        PRODUCT_VECS = torch.nn.functional.normalize(PRODUCT_VECS, p=2, dim=-1)
        
        img = Image.new('RGB', (224, 224), color = 'red')
        inputs = processor(images=img, return_tensors="pt")
        
        with torch.no_grad():
            outputs = model.get_image_features(**inputs)
            
        print(f"Outputs type: {type(outputs)}")
        print(f"Outputs shape/length: {getattr(outputs, 'shape', len(outputs))}")
        
        # This is where it failed
        query_vec = torch.nn.functional.normalize(outputs, p=2, dim=-1).to("cpu").float()
        print(f"Query vec type: {type(query_vec)}")
        
    except Exception as e:
        traceback.print_exc()

if __name__ == "__main__":
    simulate_like_this()
