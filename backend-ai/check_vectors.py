import torch
import os

VECTORS_PATH = r"c:\Sunevit\Assistant\backend-ai\product_vectors.pt"

if os.path.exists(VECTORS_PATH):
    try:
        data = torch.load(VECTORS_PATH, weights_only=False)
        print(f"Keys in pt file: {data.keys()}")
        print(f"Number of IDs: {len(data['ids'])}")
        print(f"Embedding shape: {data['embeddings'].shape}")
        print(f"Embedding type: {type(data['embeddings'])}")
        print(f"Sample ID: {data['ids'][0]}")
    except Exception as e:
        print(f"Error loading vectors: {e}")
else:
    print("Vectors file not found")
