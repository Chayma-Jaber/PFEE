import httpx
import json

response = httpx.get("https://openrouter.ai/api/v1/models")
data = response.json()
models = data.get("data", [])

free_models = []
for m in models:
    name = m.get("id", "")
    if ":free" in name.lower() or "free" in name.lower():
        free_models.append(name)

with open("free_models.json", "w", encoding="utf-8") as f:
    json.dump(free_models, f, indent=2)
