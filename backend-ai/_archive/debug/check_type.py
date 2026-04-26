import torch
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import os

VECTOR_MODEL_NAME = "openai/clip-vit-base-patch32"

def test_type():
    model = CLIPModel.from_pretrained(VECTOR_MODEL_NAME).to("cpu")
    processor = CLIPProcessor.from_pretrained(VECTOR_MODEL_NAME)
    img = Image.new('RGB', (100, 100), color = 'red')
    inputs = processor(images=img, return_tensors="pt")
    
    with torch.no_grad():
        outputs = model.get_image_features(**inputs)
    
    print(f"DEBUG: outputs type: {type(outputs)}")
    if isinstance(outputs, torch.Tensor):
        print(f"DEBUG: outputs is a tensor with shape {outputs.shape}")
    else:
        print(f"DEBUG: outputs is not a tensor, it is a {type(outputs)}")
        if isinstance(outputs, (list, tuple)):
            print(f"DEBUG: first element type: {type(outputs[0])}")

if __name__ == "__main__":
    test_type()
