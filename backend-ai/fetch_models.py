import httpx
import json

response = httpx.get("https://openrouter.ai/api/v1/models")
data = response.json()
models = data.get("data", [])
vision_models = []
free_vision = []
for m in models:
    if "vision" in m.get("architecture", {}).get("modality", "") or "image" in m.get("architecture", {}).get("modality", "") or "multi" in m.get("architecture", {}).get("modality", "") or "vision" in m["id"].lower():
        vision_models.append(m["id"])
        if getattr(m.get("pricing", {}), "get", lambda x: False)("prompt") == "0":
            free_vision.append(m["id"])
            
free_all = [m["id"] for m in models if m.get("pricing", {}).get("prompt") == "0" and "m" in m["id"]]

print("Free vision candidates:")
for id in models:
    if ":free" in id["id"]:
        print(id["id"])
        
print("All free models with gemini:")
for id in models:
    if ":free" in id["id"] and "gemini" in id["id"]:
        print(id["id"])
        
