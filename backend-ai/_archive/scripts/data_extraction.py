"""
Extraction COMPRESSÉE des données Barsha pour Rapidité Maximale & Intelligence Fix
"""

import requests
import json
import time
import os
import re

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────
BASE_API_URL = "https://cache-data.barsha.com.tn"
API_TOKEN    = "Bearer 660ac272a4c62f4138f96bc52d33f1d6de8a182712321c667f516312f2db200c"
OUTPUT_TXT   = "barsha_context.txt"

ID_FEMME = 1
ID_HOMME = 2

HEADERS = {
    "Authorization": API_TOKEN,
    "Content-Type": "application/json"
}

# ─────────────────────────────────────────────
# EXTRACTION
# ─────────────────────────────────────────────

def extract_products(limit=1000) -> list:
    url = f"{BASE_API_URL}/indexes/products/search"
    payload = {"limit": limit, "sort": ["dateActivation:desc"]}
    try:
        response = requests.post(url, headers=HEADERS, json=payload, timeout=15)
        return response.json().get("hits", [])
    except: return []

def extract_index(index_name: str) -> list:
    url = f"{BASE_API_URL}/indexes/{index_name}/search"
    try:
        response = requests.post(url, headers=HEADERS, json={"limit": 100}, timeout=10)
        return response.json().get("hits", [])
    except: return []

# ─────────────────────────────────────────────
# FORMATTAGE (ULTRA-LÉGER POUR ÉVITER LE TIMEOUT)
# ─────────────────────────────────────────────

def format_p_line(p: dict) -> str:
    # Récupération image sécurisée avec slash
    img_val = p.get("firstImg", "")
    img_url = ""
    if isinstance(img_val, str): img_url = img_val
    elif isinstance(img_val, dict): img_url = img_val.get("url") or img_val.get("path") or ""
    
    if img_url and isinstance(img_url, str) and not img_url.startswith("http"):
        pfx = "/" if not img_url.startswith("/") else ""
        img_url = f"https://barsha.com.tn{pfx}{img_url}"

    # Variantes simplifiées
    vars = p.get("variants") or p.get("declinaisons", [])
    cols = ",".join(sorted(set(str(v.get("color","")).upper() for v in vars if v.get("color"))))
    sizes = ",".join(sorted(set(str(v.get("size","")).upper() for v in vars if v.get("size"))))
    
    prix = f"{p.get('price')} TND"
    cat = (p.get("categories") or [{}])[0].get("name", "")
    ref = p.get("reference") or "N/A"
    nom = p.get("name") or p.get("nom") or ""

    return f"- [{ref}] {nom} | {prix} | {cat} | Col: {cols} | T: {sizes} | Img: {img_url} | https://barsha.com.tn/fr/produit/{p['id']}"

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print(f"🚀 Re-Génération du contexte COMPRESSÉ...")
    
    hits = extract_products(1000)
    lines = [
        "=== À PROPOS DE BARSHA ===\nBarsha: Mode Tunisie.\n",
        "=== CATALOGUE (OBLIGATION: Proposer uniquement ces produits) ===\n"
    ]
    
    for h in hits:
        lines.append(format_p_line(h))
    
    # FAQ minimale
    faq = extract_index("faq")
    if faq:
        lines.append("\n=== FAQ ===\n")
        for f in faq[:5]:
            for q in f.get("questions", [])[:1]:
                lines.append(f"Q: {q.get('question')}\nR: {q.get('answer')}")

    final_context = "\n".join(lines)
    
    with open(OUTPUT_TXT, "w", encoding="utf-8") as f:
        f.write(final_context)
    
    assets_path = "../src/assets/barsha_context.txt"
    try:
        with open(assets_path, "w", encoding="utf-8") as f: f.write(final_context)
    except: pass

    print(f"✅ Contexte compressé généré ({len(final_context):,} caractères).")