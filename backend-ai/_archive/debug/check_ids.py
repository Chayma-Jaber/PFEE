import torch
import os

VECTORS_PATH = r"c:\Sunevit\Assistant\backend-ai\product_vectors.pt"

if os.path.exists(VECTORS_PATH):
    try:
        data = torch.load(VECTORS_PATH, weights_only=False)
        print(f"First 10 IDs: {data['ids'][:10]}")
    except Exception as e:
        print(f"Error: {e}")
else:
    print("Not found")
