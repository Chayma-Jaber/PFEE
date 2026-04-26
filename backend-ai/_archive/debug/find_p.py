import json
import os

CATALOG_PATH = r"c:\Sunevit\Assistant\backend-ai\barsha_products.json"

def find_product(pid):
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)
    for p in catalog:
        if str(p.get("id")) == str(pid):
            print(json.dumps(p, indent=2))
            return
    print("Not found")

if __name__ == "__main__":
    find_product(557)
