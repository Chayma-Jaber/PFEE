from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import os
import json
import re
import base64
import sys
import asyncio

# ─── MODE HUGGINGFACE ───
# Permettre le téléchargement du modèle CLIP si non présent en cache
# os.environ["HF_HUB_OFFLINE"] = "1"  # Désactivé pour permettre le premier téléchargement
# os.environ["TRANSFORMERS_OFFLINE"] = "1"
# os.environ["HF_DATASETS_OFFLINE"] = "1"
# ────────────────────────────────────────────────────────────────────────────────

from dotenv import load_dotenv
import numpy as np
import torch
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
from io import BytesIO

# Charger les variables d'environnement
# Charger les variables d'environnement (avec override pour forcer les nouvelles clés)
from dotenv import load_dotenv as load_env_override
load_env_override(override=True)

# Logging pour débogage
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Barsha AI API")

# Configuration CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Configuration de l'IA & Meilisearch (Nettoyage automatique des clés)
def get_clean_env(key: str):
    val = os.getenv(key)
    return val.strip("'\" ") if val else None

OPENROUTER_API_KEY = get_clean_env("OPENROUTER_API_KEY")
print(f"DEBUG STARTUP: OPENROUTER_API_KEY={'LOADED' if OPENROUTER_API_KEY else 'MISSING'}")
GEMINI_API_KEY = get_clean_env("GEMINI_API_KEY")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "qwen2.5:7b"

MEILI_URL = "https://cache-data.barsha.com.tn/indexes/products/search"
MEILI_TOKEN = "Bearer 660ac272a4c62f4138f96bc52d33f1d6de8a182712321c667f516312f2db200c"

# 'openrouter/auto' choisit automatiquement le meilleur modèle gratuit disponible
DEFAULT_MODEL = "openrouter/auto"
VECTOR_MODEL_NAME = "openai/clip-vit-base-patch32"

# Chemins absolus par rapport au script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
VECTORS_PATH = os.path.join(DATA_DIR, "product_vectors.pt")
CATALOG_PATH = os.path.join(DATA_DIR, "barsha_products.json")
STORES_PATH = os.path.join(DATA_DIR, "barsha_stores.json")

def clean_search_query(query: str) -> str:
    """Nettoyage poussé pour Meilisearch basé sur les intentions shopping."""
    q = query.lower()
    semantic_map = {
        r'entretien|travail|bureau|chic|bank|banque': 'chic élégant chemise pantalon classique veste chaussure',
        r'mariage|fête|soirée|ceremonie': 'robe soirée élégant chic brillant satin chaussure',
        r'sport|jogging|quotidien|confortable': 'jogging t-shirt basket sport sweat chaussure',
        r'été|plage|vacances|maillot|bain': 'short robe légère t-shirt cotton plage maillot',
        r'sac|sacoche|bag|valise|bagage': 'sac sacoche bandoulière accessoire bag',
        r'froid|hiver|manteau|pull': 'pull sweat veste manteau cotton chaud'
    }
    
    for pattern, substitution in semantic_map.items():
        if re.search(pattern, q):
            return substitution
    return query

# Variables globales pour le moteur vectoriel
CLIP_MODEL = None
CLIP_PROCESSOR = None
PRODUCT_IDS = None
PRODUCT_VECS = None

LOCAL_CATALOG_IMAGES = {}
try:
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        _cat_data = json.load(f)
        LOCAL_CATALOG_IMAGES = { str(p.get("id")): p.get("image") or p.get("firstImg") or "" for p in _cat_data if p.get("id") }
    print(f"DEBUG STARTUP: Loaded {len(LOCAL_CATALOG_IMAGES)} images from local catalog.")
except Exception as e:
    print(f"DEBUG STARTUP: Error loading local catalog images: {str(e)}")


# Diagnostic des clés (Simplifié)
@app.on_event("startup")
async def startup_event():
    global CLIP_MODEL, CLIP_PROCESSOR, PRODUCT_IDS, PRODUCT_VECS
    
    print("=== BARSHA AI: SYSTÈME PRÊT ===")
    print(f"Gemini Key Length: {len(os.getenv('GEMINI_API_KEY',''))}")
    
    # Tentative de chargement du moteur vectoriel
    if os.path.exists(VECTORS_PATH):
        try:
            print(f"Chargement du moteur visuel ({VECTOR_MODEL_NAME})...")
            # Forcer le chargement sur CPU pour une compatibilité maximale
            CLIP_MODEL = CLIPModel.from_pretrained(VECTOR_MODEL_NAME).to("cpu")
            CLIP_PROCESSOR = CLIPProcessor.from_pretrained(VECTOR_MODEL_NAME)
            CLIP_MODEL.eval()
            
            data = torch.load(VECTORS_PATH, weights_only=False, map_location="cpu")
            PRODUCT_IDS = data["ids"]
            
            # Conversion plus robuste des embeddings vers un tenseur Float32
            embeddings_raw = data["embeddings"]
            if isinstance(embeddings_raw, np.ndarray):
                PRODUCT_VECS = torch.from_numpy(embeddings_raw).float()
            else:
                PRODUCT_VECS = torch.tensor(embeddings_raw).float()
                
            # Normalisation préalable des vecteurs du catalogue pour accélérer la recherche
            PRODUCT_VECS = torch.nn.functional.normalize(PRODUCT_VECS, p=2, dim=-1)
            
            print(f"MOTEUR VISUEL: OK ! ({len(PRODUCT_IDS)} articles indexés)")
        except Exception as e:
            print(f"MOTEUR VISUEL: ÉCHEC ({str(e)})")
            CLIP_MODEL = None
            PRODUCT_VECS = None
    else:
        print("MOTEUR VISUEL: Indisponible (Fichier vectors.pt manquant)")
    
    print("===============================")


class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_context: Optional[dict] = None
    model: Optional[str] = DEFAULT_MODEL

GENDER_MALE_PATTERNS   = r'\b(homme|hommes|masculin|masculins|mec|gars|garçon|garçons|boy|boys|man|men|caleçon|boxer|slip)\b'
GENDER_FEMALE_PATTERNS = r'\b(femme|femmes|féminin|féminins|fille|filles|dame|dames|woman|women|girl|girls|robe|jupe|balerine|talon|talons|escarpin|chemisier|sac à main)\b'
GENDER_KID_PATTERNS    = r'\b(enfant|enfants|kid|kids|bébé|bebe|junior|garçonnet|fillette)\b'

# Couleurs connues (libellet Barsha)
COLOR_KEYWORDS = [
    'fushia','fuschia','fuchsia','rose','rouge','noir','blanc','bleu','vert','marron',
    'orange','jaune','violet','gris','beige','creme','crème','kaki','turquoise',
    'bordeaux','marine','caramel','corail','doré','dore','argent','naturel',
    'rouille','ecru','écru','nude','camel','saumon','lavande','menthe',
]

# Mappage des variations (féminin, pluriel) vers la couleur canonique du catalogue
COLOR_VARIATIONS = {
    'noire': 'noir', 'noires': 'noir', 'noirs': 'noir',
    'blanche': 'blanc', 'blanches': 'blanc', 'blancs': 'blanc',
    'grise': 'gris', 'grises': 'gris',
    'verte': 'vert', 'vertes': 'vert', 'verts': 'vert',
    'bleue': 'bleu', 'bleues': 'bleu', 'bleus': 'bleu',
    'violette': 'violet', 'violettes': 'violet', 'violets': 'violet',
    'dorée': 'doré', 'doree': 'doré',
}

def detect_gender(query: str):
    """Retourne 'homme', 'femme', 'enfant' ou None selon la requête."""
    q = query.lower()
    if re.search(GENDER_MALE_PATTERNS, q):   return 'homme'
    if re.search(GENDER_FEMALE_PATTERNS, q): return 'femme'
    if re.search(GENDER_KID_PATTERNS, q):    return 'enfant'
    return None

def detect_color(query: str):
    """Retourne la couleur mentionnée dans la requête (libellet normalisé) ou None."""
    q = query.lower()
    # On teste d'abord les variations spécifiques
    for var, canonical in COLOR_VARIATIONS.items():
        if re.search(r'\b' + var + r'\b', q):
            return canonical.upper()
    # Puis les mots-clés de base
    for color in COLOR_KEYWORDS:
        if re.search(r'\b' + color + r'\b', q):
            return color.upper()
    return None

def detect_budget(query: str):
    """Extrait un montant maximum de la requête (ex: 'moins de 60.000')."""
    q = query.lower()
    # On cherche un chiffre suivi de DT, TND ou juste un gros chiffre (millimes)
    # Pattern pour 60.000, 60.00, 60, 60dt, 60 tnd
    match = re.search(r'(\d+[\.,]?\d*)\s*(?:dt|tnd|dinars?|tn)?', q)
    if match:
        try:
            raw_val = match.group(1).replace(',', '.')
            val = float(raw_val)
            # Correction millimes : si > 1000 sans séparateur décimal, c'est probablement 60000 millimes = 60 DT
            if val >= 1000 and '.' not in raw_val:
                val = val / 1000
            return val
        except: return None
    return None

def clean_search_query(query: str) -> str:
    """Nettoyage poussé pour Meilisearch."""
    q = query.lower()
    semantic_map = {
        r'entretien|travail|bureau|chic|bank|banque': 'chic élégant chemise pantalon classique veste chaussure',
        r'mariage|fête|soirée|ceremonie': 'robe soirée élégant chic brillant satin chaussure',
        r'sport|jogging|quotidien|confortable': 'jogging t-shirt basket sport sweat chaussure',
        r'été|plage|vacances|maillot|bain': 'short robe légère t-shirt cotton plage maillot',
        r'sac|sacoche|bag|valise|bagage': 'sac sacoche bandoulière accessoire bag',
        r'froid|hiver|manteau|pull': 'pull sweat veste manteau cotton chaud',
        r'chaussure|basket|ballerine|talon|sabot|escarpin|pied': 'chaussure basket ballerine sabot basket'
    }
    extra_keywords = ""
    for pattern, keywords in semantic_map.items():
        if re.search(pattern, q): extra_keywords += " " + keywords
    stop_words = ['trouve','moi','des','un','une','cherche','montre','donne','quelques','et','maintenant','je','veux','peux','me','donner','pour','avec','dans','notre','boutique','les','la','le','l','quelque','chose','comme', 'est', 'ce', 'qu', 'il', 'existe', 'cette', 'cet', 'ces', 'avez', 'vous', 'as', 'tu', 'ou', 'qui', 'que', 'quoi', 'disponible', 'article', 'produit', 'modele', 'ton', 'ta', 'tes', 'mon', 'ma', 'mes', 'son', 'sa', 'ses']
    q = re.sub(r'[^\w\s]', ' ', q)
    words = q.split()
    meaningful_words = [w for w in words if w not in stop_words and len(w) > 2]
    
    final_query = " ".join(meaningful_words)
    if extra_keywords:
        # On ne rajoute les synonymes que si la requête est courte pour ne pas noyer le moteur
        final_query = f"{final_query} {extra_keywords}".strip()
    
    return final_query

# Mapping genre → valeurs Famille pour le filtre natif Meilisearch
GENRE_TO_FAMILLE = {
    'homme':  ['MEN', 'TEEN MEN', 'BOYS', 'TEEN BOYS'],
    'femme':  ['WOMEN', 'TEEN WOMEN', 'GIRLS', 'TEEN GIRLS'],
    'enfant': ['KIDS', 'BABY', 'JUNIOR'],
}

async def call_meilisearch(q: str, limit: int = 40, famille_filter: list = None, custom_filter: str = None):
    headers = {"Authorization": MEILI_TOKEN, "Content-Type": "application/json"}
    payload = {"q": q, "limit": limit}
    
    filters = []
    if famille_filter:
        vals = ', '.join(f"'{v}'" for v in famille_filter)
        filters.append(f"Famille IN [{vals}]")
    if custom_filter:
        filters.append(f"({custom_filter})")
        
    if filters:
        payload["filter"] = " AND ".join(filters)
        
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(MEILI_URL, headers=headers, json=payload, timeout=10.0)
            data = resp.json()
            return data.get("hits", [])
        except: return []

# Mapping des valeurs du champ "Famille" vers un genre normalisé
FAMILLE_HOMME   = {'men', 'teen men', 'boys', 'teen boys', 'homme', 'hommes', 'garcon', 'garcons'}
FAMILLE_FEMME   = {'women', 'teen women', 'girls', 'teen girls', 'femme', 'femmes', 'fille', 'filles'}
FAMILLE_ENFANT  = {'kids', 'enfants', 'baby', 'bebe', 'junior'}

def _get_famille_gender(product: dict):
    """Retourne 'homme', 'femme', 'enfant' ou None à partir des champs Famille ou Genre."""
    famille_raw = (
        product.get("famille") or product.get("Famille") or
        product.get("family") or product.get("Family") or ""
    )
    famille = str(famille_raw).strip().lower()
    
    # Matching strict Famille
    if famille in FAMILLE_HOMME:   return 'homme'
    if famille in FAMILLE_FEMME:   return 'femme'
    if famille in FAMILLE_ENFANT:  return 'enfant'
    
    # Fallback sur le champ Genre (souvent présent sur les accessoires)
    genre_raw = product.get("genre") or product.get("Genre") or ""
    genre = str(genre_raw).lower()
    if 'homme' in genre or 'men' in genre: return 'homme'
    if 'femme' in genre or 'women' in genre: return 'femme'
    if 'enfant' in genre or 'kid' in genre: return 'enfant'

    # Matching partiel Famille
    if re.search(r'\b(men|boys|homme|masculin)\b', famille): return 'homme'
    if re.search(r'\b(women|girls|femme|féminin)\b', famille): return 'femme'
    return None

def _gender_filter(product: dict, requested_gender: str) -> bool:
    """Retourne True si le produit est compatible avec le genre demandé.
       Priorité : champ Famille > champs textuels nom/catégorie.
    """
    # --- 1. Vérification via le champ Famille (prioritaire) ---
    famille_gender = _get_famille_gender(product)
    if famille_gender is not None:
        return famille_gender == requested_gender  # Si on sait le genre exact, on filtre strictement

    # --- 2. Fallback : inspection des champs textuels ---
    candidate_fields = " ".join(filter(None, [
        str(product.get("name") or ""),
        str(product.get("nom") or ""),
        str(product.get("category") or ""),
        str(product.get("categorie") or ""),
        str(product.get("gender") or ""),
        str(product.get("genre") or ""),
        str(product.get("tags") or ""),
    ])).lower()

    opposite = {'homme': GENDER_FEMALE_PATTERNS, 'femme': GENDER_MALE_PATTERNS, 'enfant': None}
    opp_pattern = opposite.get(requested_gender)
    if opp_pattern and re.search(opp_pattern, candidate_fields):
        return False  # Exclure les produits clairement pour le genre opposé
    return True

async def _fetch_stock_for_declinaison(client, did):
    try:
        resp = await client.get(f"https://main.barsha.com.tn/api/getDeclinaisonStock/{did}", timeout=2.0)
        data = resp.json().get("data", [])
        sizes = [f"{s.get('size')}:{s.get('qte')}" for s in data if s.get("qte", 0) > 0]
        return did, ",".join(sizes) if sizes else "Rupture"
    except:
        return did, ""

async def search_barsha_catalog(query: str, history: List[ChatMessage] = [], limit: int = 30):
    effective_query = query
    
    recent_ids = set()
    if history:
        for msg in reversed(history[-6:]):
            if msg.role in ["assistant", "user"]:
                for match in re.finditer(r'\[ID:(\d+)\]', msg.content):
                    recent_ids.add(match.group(1))

    if len(query.strip()) < 5 and history:
        for msg in reversed(history[:-1]):
            if msg.role == "user" and len(msg.content) > 5:
                effective_query = msg.content
                break

    requested_gender = detect_gender(effective_query)
    requested_color  = detect_color(effective_query)
    requested_budget = detect_budget(effective_query)
    clean_q = clean_search_query(effective_query)

    # Retirer la couleur et le budget de la requête Meilisearch textuelle
    if requested_color:
        color_pattern = requested_color.lower()
        clean_q = re.sub(r'\b' + re.escape(color_pattern) + r'\b', '', clean_q).strip()
    
    if requested_budget:
        # On retire le chiffre de la requête pour ne pas polluer Meilisearch
        clean_q = re.sub(r'\d+[\.,]?\d*', '', clean_q).strip()

    if not clean_q: clean_q = effective_query.lower().split()[0]  # garder au moins le type produit

    famille_filter = GENRE_TO_FAMILLE.get(requested_gender) if requested_gender else None

    # 1. Fetch recent IDs first to maintain context (mais on les ajoutera à la fin)
    recent_hits = []
    if recent_ids:
        ids_str = ", ".join(recent_ids)
        recent_hits = await call_meilisearch("", limit=10, custom_filter=f"id IN [{ids_str}]")

    # 2. Tentative avec filtre Meilisearch natif
    # On augmente la limite (x5) pour être sûr de trouver la bonne couleur après filtrage manuel
    search_hits = await call_meilisearch(clean_q, limit * 5, famille_filter=famille_filter)

    # 2b. Filtrage Budget (Post-filtrage)
    if requested_budget and search_hits:
        def _get_price(p):
            try: return float(p.get('currentPrice') or p.get('price') or 999999)
            except: return 999999
        search_hits = [p for p in search_hits if _get_price(p) <= (requested_budget + 1.0)] # +1 de marge

    # 3. Post-filtrage STRICT par Famille OU Genre (fiable)
    hits = []
    if requested_gender and search_hits:
        filtered = [p for p in search_hits if _gender_filter(p, requested_gender)]
        if filtered:
            hits.extend(filtered)
        else:
            # 3b. Aucun produit du bon genre trouvé avec filtre natif → 
            # Chercher le mot-clef SANS le filtre Famille natif (pour les sacs/accessoires)
            all_hits = await call_meilisearch(clean_q, limit * 2)
            filtered2 = [p for p in all_hits if _gender_filter(p, requested_gender)]
            hits.extend(filtered2)
    elif requested_gender and not search_hits:
        # Si on n'a rien du tout avec le filtre natif, on essaye sans le filtre natif
        all_hits = await call_meilisearch(clean_q, limit * 2)
        filtered_q = [p for p in all_hits if _gender_filter(p, requested_gender)]
        hits.extend(filtered_q)
    else:
        hits.extend(search_hits)

    # 4. Ajouter les éléments de l'historique (recent_hits) A LA FIN pour le contexte long-terme
    if recent_hits:
        hits.extend(recent_hits)

    # Dedup hits
    unique_hits = []
    seen = set()
    for h in hits:
        if h.get('id') not in seen:
            seen.add(h.get('id'))
            unique_hits.append(h)
    hits = unique_hits

    # 3. Fallback sur mots-clés individuels si toujours vide
    if not hits and " " in clean_q:
        keywords = clean_q.split()
        for kw in keywords[:2]:
            if len(kw) < 3: continue
            fallback = await call_meilisearch(kw, 20)
            filtered_fb = [p for p in fallback if _gender_filter(p, requested_gender)] if requested_gender else fallback
            if filtered_fb:
                hits.extend(filtered_fb)
                break

    if not hits:
        raw_fallback = await call_meilisearch("", 40)
        hits = [p for p in raw_fallback if _gender_filter(p, requested_gender)] if requested_gender else raw_fallback
        hits = hits[:20]
        note = "NOTE: Je n'ai pas trouvé exactement l'article demandé. Voici quelques articles phares de notre collection qui pourraient vous plaire :\n"
    else:
        note = ""

    # Filtrage final de sécurité : si on cherche pour un homme, on vire TOUT ce qui ressemble à une robe
    if requested_gender == 'homme':
        hits = [p for p in hits if not re.search(r'\b(robe|jupe|talon|balerine|sac à main|escarpin)\b', (str(p.get('nom','')) + " " + str(p.get('category',''))).lower())]
    elif requested_gender == 'femme':
         hits = [p for p in hits if not re.search(r'\b(caleçon|boxer|slip)\b', (str(p.get('nom','')) + " " + str(p.get('category',''))).lower())]

    hits = hits[:limit] # Truncate avant de fetcher les stocks pour limiter les requêtes
    stock_map = {}
    decl_ids = []
    for p in hits:
        for d in (p.get("declinaisons") or []):
            if d.get("id"): decl_ids.append(d.get("id"))
    if decl_ids:
        async with httpx.AsyncClient() as stock_client:
            tasks = [_fetch_stock_for_declinaison(stock_client, did) for did in decl_ids]
            results = await asyncio.gather(*tasks)
            stock_map = {did: v for did, v in results if v}

    lines = []
    clean_hits = []
    seen_ids = set()
    for p in hits:
        pid = p.get('id')
        if not pid or pid in seen_ids: continue
        seen_ids.add(pid)
        nom   = str(p.get("nom") or p.get("title") or p.get("name") or p.get("sku") or "Article Barsha").split('|')[0].strip()
        prix  = f"{p.get('prix') or p.get('currentPrice') or p.get('price')} TND"
        ref   = p.get("sku") or p.get("reference") or "N/A"
        famille = p.get("genre") or p.get("Famille") or ""

        # Extraire les variantes couleur depuis declinaisons (format simplifié)
        declinaisons = p.get("declinaisons") or []
        variants_parts = []
        
        def ensure_abs_url(url_val):
            if not url_val: return ""
            # Si c'est un dictionnaire, on cherche une URL à l'intérieur
            if isinstance(url_val, dict):
                url = (url_val.get("medium") or {}).get("url") or url_val.get("url") or ""
            else:
                url = str(url_val)
            
            if not url: return ""
            if url.startswith("http"): return url
            return f"https://barsha.com.tn/{url.lstrip('/')}"

        highlighted_img = ""  # Note: le catalogue actuel n'a pas d'images par variante

        for d in declinaisons:
            libellet = str(d.get("couleur") or "").upper()
            did = d.get("id")
            stock_str = stock_map.get(did, "")
            
            val = libellet
            if stock_str: val = f"{val} ({stock_str})" if val else stock_str
            
            if val:
                variants_parts.append(val)
            
            # Pas d'image par déclinaison dans ce JSON, donc on garde l'image principale
            # mais on valide si la couleur demandée existe
            if requested_color and libellet == requested_color:
                # On utilise l'image globale comme highlighted si la couleur existe
                highlighted_img = p.get("image")

        # Si une couleur est demandée et que ce produit ne l'a pas en déclinaison, skip
        if requested_color and variants_parts:
            has_color = any(requested_color in str(v).upper() for v in declinaisons if "couleur" in v)
            if not has_color:
                continue

        # Image principale (Priorité au JSON local qui a les bonnes URLs Zen)
        img_val = LOCAL_CATALOG_IMAGES.get(str(pid)) or p.get("image") or p.get("firstImg") or ""
        main_img = ensure_abs_url(img_val)

        # Utiliser une virgule au lieu d'un pipe pour ne pas casser la regex frontend
        color_note = f" , COULEUR DEMANDÉE: {requested_color} → IMG: {highlighted_img}" if highlighted_img else ""
        variants_str = ", ".join(variants_parts) if variants_parts else "N/A"
        
        # Format STRICT pour match le regex du frontend
        lines.append(
            f"- [ID:{pid}] [{ref}] {nom} | {prix} | Famille:{famille} | "
            f"Couleurs+Images: {variants_str}{color_note} | "
            f"ImgPrincipale: {main_img} | "
            f"https://barsha.com.tn/fr/produit/{pid}"
        )
        
        clean_hits.append({
            "id": pid,
            "reference": ref,
            "nom": nom,
            "prix": prix,
            "image": main_img,
            "url": f"https://barsha.com.tn/fr/produit/{pid}"
        })

    return note + "\n".join(lines[:limit]), clean_hits

def scrub_history(messages: List[ChatMessage]) -> List[dict]:
    clean_history = []
    for msg in messages:
        if msg.role == "system": continue
        clean_history.append({"role": msg.role, "content": msg.content})
    return clean_history

@app.get("/")
async def root(): return {"status": "Barsha AI API Online"}

@app.get("/debug/clip")
async def debug_clip():
    """Vérifie l'état actuel du moteur CLIP."""
    status = {
        "model_loaded": CLIP_MODEL is not None,
        "processor_loaded": CLIP_PROCESSOR is not None,
        "vectors_loaded": PRODUCT_VECS is not None,
        "num_vectors": len(PRODUCT_IDS) if PRODUCT_IDS is not None else 0,
        "vector_shape": list(PRODUCT_VECS.shape) if PRODUCT_VECS is not None else None,
        "vectors_path_exists": os.path.exists(VECTORS_PATH),
        "device": str(next(CLIP_MODEL.parameters()).device) if CLIP_MODEL else "N/A"
    }
    return status

@app.get("/debug/search")
async def debug_search(q: str = "maillot de bain"):
    """Debug: retourne les champs bruts des 3 premiers produits trouvés."""
    hits = await call_meilisearch(q, 3)
    result = []
    for h in hits:
        result.append({
            "keys": list(h.keys()),
            "name": h.get("name") or h.get("nom"),
            "famille": h.get("famille") or h.get("Famille") or h.get("family") or h.get("Family"),
            "gender": h.get("gender") or h.get("genre"),
            "category": h.get("category") or h.get("categorie"),
            "all_fields": {k: v for k, v in h.items() if k.lower() in [
                'famille','family','gender','genre','category','categorie','tags','name','nom'
            ]},
        })
    return result

@app.get("/debug/orders")
async def debug_orders(token: str = ""):
    """Debug: récupère les commandes depuis l'API Barsha et affiche leur structure brute."""
    if not token:
        return {"error": "Passez ?token=VOTRE_JWT pour tester (ex: /debug/orders?token=eyJhbGc...)"}
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get("https://main.barsha.com.tn/api/getOrders", headers=headers, timeout=10.0)
            raw = resp.json()
            # Montrer la structure de façon lisible
            first_order = None
            if isinstance(raw, list) and raw:
                first_order = raw[0]
            elif isinstance(raw, dict):
                for key in ("data", "orders", "items", "results", "commandes"):
                    inner = raw.get(key)
                    if isinstance(inner, list) and inner:
                        first_order = inner[0]
                        break
                    if isinstance(inner, dict):
                        for sub in ("data", "items"):
                            sub_inner = inner.get(sub)
                            if isinstance(sub_inner, list) and sub_inner:
                                first_order = sub_inner[0]
                                break
            return {
                "http_status": resp.status_code,
                "response_type": type(raw).__name__,
                "top_level_keys": list(raw.keys()) if isinstance(raw, dict) else "N/A (list)",
                "total_orders": len(raw) if isinstance(raw, list) else "?",
                "first_order_keys": list(first_order.keys()) if first_order else "Aucune commande trouvée",
                "first_order_sample": first_order
            }
        except Exception as e:
            return {"error": str(e)}

async def call_ollama_chat(messages: list) -> dict:
    """Appel local asynchrone pour Ollama."""
    try:
        payload = {
            "model": OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.3}
        }
        async with httpx.AsyncClient() as client:
            print(f"DEBUG OLLAMA: Tentative avec {OLLAMA_MODEL}...")
            resp = await client.post(OLLAMA_URL, json=payload, timeout=90.0)
            if resp.status_code == 200:
                data = resp.json()
                # On reformate pour matcher la structure OpenRouter attendue par le frontend
                return {
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": data.get("message", {}).get("content", "")
                            }
                        }
                    ]
                }
            print(f"DEBUG OLLAMA: Erreur HTTP {resp.status_code}")
            return None
    except Exception as e:
        print(f"DEBUG OLLAMA: Non disponible ou erreur: {str(e)}")
        return None

@app.post("/api/chat")
async def chat_proxy(request: ChatRequest):
    """
    Point d'entrée principal pour le chat. 
    1. Analyse la requête et cherche des produits dans le catalogue.
    2. Prépare le prompt système.
    3. Tente l'IA locale (Ollama).
    4. Fallback sur OpenRouter (Cloud) si besoin.
    """
    try:
        user_query = request.messages[-1].content if request.messages else ""
        print(f"DEBUG CHAT: Requête reçue : '{user_query}'")
        
        # 1. Recherche catalogue
        catalog_subset, raw_hits = await search_barsha_catalog(user_query, request.messages)
        api_messages = scrub_history(request.messages)
        
        # 2. Contexte utilisateur
        ctx = request.user_context or {}
        is_logged = ctx.get("isLoggedIn", False)
        profile = ctx.get("profile", {})
        
        def _ensure_list(val):
            """Extrait une liste depuis tout type de réponse API (liste, dict imbriqué, etc.)"""
            if isinstance(val, list): return val
            if isinstance(val, dict):
                # Essayer toutes les clés d'enveloppe courantes
                for key in ("data", "orders", "items", "results", "commandes"):
                    inner = val.get(key)
                    if isinstance(inner, list): return inner
                    if isinstance(inner, dict):
                        for sub_key in ("data", "items", "results"):
                            sub = inner.get(sub_key)
                            if isinstance(sub, list): return sub
            return []

        orders_raw = ctx.get("orders", [])
        orders = _ensure_list(orders_raw)
        # Si toujours vide mais l'objet n'est pas None, log pour debug
        if not orders and orders_raw:
            logger.warning(f"DEBUG ORDERS: Impossible d'extraire la liste. Type={type(orders_raw)}, Aperçu={str(orders_raw)[:200]}")
        else:
            logger.info(f"DEBUG ORDERS: {len(orders)} commande(s) reçue(s).")

        coupons = _ensure_list(ctx.get("coupons", []))
        motifs = _ensure_list(ctx.get("motifs", []))
        wishlist = _ensure_list(ctx.get("wishlist", []))

        # Formatage des favoris pour que l'IA puisse les afficher
        wishlist_formatted = []
        for w in wishlist:
            # S'adapter aux possibles clés renvoyées par l'API (title/nom, firstImg dict vs string)
            w_prod = w.get("product") or w.get("produit") or w
            pid = w_prod.get("id") or w.get("produit_id") or w.get("productId") or "0"
            nom = w_prod.get("title") or w_prod.get("nom") or w_prod.get("name") or "Article Favori"
            
            prix_val = w_prod.get("currentPrice") or w_prod.get("prix") or w_prod.get("price") or ""
            prix = f"{prix_val} TND" if prix_val and "TND" not in str(prix_val).upper() else str(prix_val) if prix_val else "Sur site"
            ref = w_prod.get("sku") or w_prod.get("reference") or "FAV"
            
            img_obj = w_prod.get("image") or w_prod.get("firstImg") or LOCAL_CATALOG_IMAGES.get(str(pid), "")
            if isinstance(img_obj, dict):
                img = img_obj.get("url") or (img_obj.get("medium") or {}).get("url") or ""
            else:
                img = str(img_obj)
            if img and not img.startswith("http"): img = f"https://barsha.com.tn/{img.lstrip('/')}"
            if not img: img = "https://barsha.com.tn/assets/images/logo.png"
            
            wishlist_formatted.append(
                f"- [ID:{pid}] [{ref}] {nom} | {prix} | Famille:FAVORI | "
                f"Couleurs+Images: N/A | ImgPrincipale: {img} | "
                f"https://barsha.com.tn/fr/produit/{pid}"
            )
            raw_hits.append({
                "id": pid,
                "reference": ref,
                "nom": nom,
                "prix": prix,
                "image": img,
                "url": f"https://barsha.com.tn/fr/produit/{pid}"
            })
        
        wishlist_catalog = f"VOICI LA LISTE DÉTAILLÉE DE SES FAVORIS :\n" + "\n".join(wishlist_formatted) if wishlist_formatted else "Aucun favori enregistré."

        # ── Formatage détaillé des commandes ──────────────────────────────────────
        orders_formatted = []
        STATUS_MAP = {
            # Valeurs anglaises
            "pending": "En attente de confirmation",
            "confirmed": "Confirmée ✅",
            "processing": "En préparation 📦",
            "shipped": "Expédiée 🚚",
            "delivered": "Livrée ✅",
            "cancelled": "Annulée ❌",
            "returned": "Retournée 🔄",
            "refunded": "Remboursée 💳",
            # Valeurs françaises
            "en attente": "En attente de confirmation",
            "validée": "Confirmée ✅",
            "en cours": "En préparation 📦",
            "expédiée": "Expédiée 🚚",
            "livrée": "Livrée ✅",
            "annulée": "Annulée ❌",
        }
        for o in orders:
            # Référence/numéro de commande
            ref = (o.get("reference") or o.get("ref") or
                   o.get("orderNumber") or o.get("order_number") or
                   o.get("id") or "N/A")
            # Montant total
            amt = (o.get("totalAmount") or o.get("total") or
                   o.get("montant") or o.get("amount") or o.get("total_amount") or "?")
            total = f"{amt} TND"
            # Statut
            raw_statut = (o.get("status") or o.get("statut") or
                          o.get("etat") or o.get("state") or "en cours")
            statut = STATUS_MAP.get(str(raw_statut).lower().strip(), str(raw_statut).capitalize())
            # Date
            date_raw = (o.get("createdAt") or o.get("created_at") or
                        o.get("date") or o.get("orderDate") or o.get("order_date") or "Date inconnue")
            # Formatage date lisible (on garde juste les 10 premiers chars si ISO)
            date = str(date_raw)[:10] if date_raw and date_raw != "Date inconnue" else "Date inconnue"
            # Adresse de livraison
            addr_obj = o.get("shippingAddress") or o.get("address") or o.get("adresse") or {}
            if isinstance(addr_obj, dict):
                ville = addr_obj.get("city") or addr_obj.get("ville") or ""
                addr_str = f" | Livraison: {ville}" if ville else ""
            else:
                addr_str = f" | Livraison: {addr_obj}" if addr_obj else ""
            # Numéro de suivi
            tracking = (o.get("trackingNumber") or o.get("tracking") or
                        o.get("tracking_number") or o.get("numSuivi") or "")
            tracking_str = f" | N° Suivi: {tracking}" if tracking else ""
            # Articles commandés
            items = (o.get("items") or o.get("lignes") or o.get("products") or
                     o.get("orderItems") or o.get("order_items") or [])
            items_str = ""
            if isinstance(items, list) and items:
                item_parts = []
                for it in items[:5]:  # max 5 articles affichés
                    it_nom = (it.get("name") or it.get("nom") or it.get("title") or
                              it.get("productName") or it.get("product_name") or
                              (it.get("product") or {}).get("nom") or
                              (it.get("product") or {}).get("name") or "Article")
                    it_qty = it.get("quantity") or it.get("qte") or it.get("qty") or 1
                    it_taille = it.get("size") or it.get("taille") or ""
                    it_couleur = it.get("color") or it.get("couleur") or ""
                    details = "/".join(filter(None, [str(it_taille), str(it_couleur)]))
                    part = f"{it_nom} x{it_qty}"
                    if details: part += f" ({details})"
                    item_parts.append(part)
                if item_parts:
                    items_str = f"\n   Articles: {', '.join(item_parts)}"

            orders_formatted.append(
                f"- Commande #{ref} | Statut: {statut} | Total: {total} | Date: {date}{addr_str}{tracking_str}{items_str}"
            )

        if orders_formatted:
            orders_details = (
                f"HISTORIQUE DES COMMANDES DE L'UTILISATEUR ({len(orders_formatted)} commande(s)) :\n"
                + "\n".join(orders_formatted)
            )
        else:
            orders_details = "Aucune commande passée (utilisateur sans historique ou non connecté)."

        user_info = f"Utilisateur : {profile.get('firstName', 'Invite')} {profile.get('lastName', '')}" if is_logged else "Utilisateur GUEST"
        orders_info = f"{len(orders)} commande(s)" if is_logged else "Pas d'historique"
        wishlist_info = f"{len(wishlist)} articles en favoris" if is_logged else "0 favoris"
        
        # Réseaux sociaux intégrés directement
        social_links = "Réseaux sociaux : Facebook (https://www.facebook.com/barsha.tunisie), Instagram (https://www.instagram.com/barsha.tunisie/), Youtube (https://www.youtube.com/channel/UCOlzEAEfVUcn8sTh5OXV0-Q)"

        # 3. Prompt Système - Version enrichie avec expertise mode
        system_prompt = {
            "role": "system",
            "content": f"""Tu es le styliste personnel Barsha, un conseiller mode expert et chaleureux pour la marque de vêtements tunisienne Barsha.

CONTEXTE CLIENT: {user_info} | Commandes: {orders_info} | Favoris: {wishlist_info}
INFOS PRATIQUES: {social_links}

--- CATALOGUE BARSHA (PRODUITS DISPONIBLES) ---
{catalog_subset}

{wishlist_catalog}

{orders_details}

=== TES COMPÉTENCES DE STYLISTE ===

1. CONSEIL PERSONNALISÉ PAR OCCASION:
   - Entretien/Bureau: Suggère chemises, pantalons classiques, blazers sobres
   - Mariage/Soirée: Robes élégantes, tenues chics, accessoires raffinés
   - Casual/Quotidien: T-shirts, jeans, sneakers, pièces confortables
   - Été/Plage: Robes légères, shorts, sandales, couleurs vives
   - Hiver: Pulls, manteaux, boots, couches superposées

2. CONSEIL LOOK COMPLET:
   - Quand un client hésite, propose un ensemble cohérent (haut + bas + accessoire)
   - Mentionne les harmonies de couleurs (ex: "Le blanc s'accorde parfaitement avec le marine")
   - Suggère des compléments ("Pour parfaire ce look, je vous conseille...")

3. GESTION DU BUDGET:
   - Si le client mentionne un budget, respecte-le strictement
   - Propose des alternatives si les articles sont au-dessus du budget
   - "Pour ce budget, je vous suggère..." plutôt que "C'est trop cher"

=== RÈGLES ABSOLUES ===

1. MODE UNIQUEMENT: Refuse poliment tout sujet hors-mode (code, recettes, etc.)

2. COMMANDES: Les infos sont CI-DESSUS. Affiche-les DIRECTEMENT si demandé. Ne dis JAMAIS que tu n'y as pas accès.

3. GENRE STRICT: Homme → articles homme UNIQUEMENT. Ne suggère JAMAIS de robes à un homme.

4. FAVORIS: Pour ajouter/retirer, dire de cliquer sur le coeur. Pour VOIR, affiche les lignes brutes.

5. STOCKS: Utilise les infos entre parenthèses (ex: M:2, L:1). Taille absente = rupture.

6. PRODUITS RÉELS: Ne propose QUE les produits listés ci-dessus.

7. FORMAT STRICT: Copie EXACTEMENT les lignes produit (commençant par - [ID:...)

=== STYLE DE COMMUNICATION ===

- Sois chaleureux mais professionnel
- Utilise "vous" par défaut
- Ajoute une touche d'enthousiasme pour les belles pièces
- Termine par une question pour guider ("Qu'en pensez-vous?" / "Souhaitez-vous voir d'autres options?")

--- EXEMPLE DE RÉPONSE PARFAITE ---

J'ai trouvé quelques pièces qui correspondent parfaitement à votre style :

- [ID:123] [REF456] CHEMISE SLIM FIT | 59.900 TND | Famille:MEN | Couleurs+Images: BLEU | ImgPrincipale: https://... | https://barsha...

Cette chemise se marierait très bien avec un pantalon chino pour un look smart casual. Souhaitez-vous que je vous suggère un bas assorti ?"""
        }
        
        final_messages = [system_prompt] + api_messages
        
        # ── Étape A : OLLAMA (LOCAL) ──
        if not request.model or request.model == "openrouter/auto":
            print("DEBUG CHAT: Tentative OLLAMA Local...")
            ollama_resp = await call_ollama_chat(final_messages)
            if ollama_resp:
                ollama_resp["catalog_hits"] = raw_hits
                return ollama_resp

        # ── Étape B : GEMINI (CLOUD - Google) ──
        if GEMINI_API_KEY:
            print("DEBUG CHAT: Tentative Gemini Cloud...")
            try:
                gemini_resp = await call_gemini_native_chat(final_messages, max_tokens=600)
                if gemini_resp and "choices" in gemini_resp:
                    gemini_resp["catalog_hits"] = raw_hits
                    return gemini_resp
            except Exception as e:
                print(f"DEBUG CHAT: Gemini échoué: {str(e)}")

        # ── Étape C : OPENROUTER (CLOUD) ──
        print("DEBUG CHAT: Basculement OpenRouter Cloud...")
        if not OPENROUTER_API_KEY and not GEMINI_API_KEY:
            raise Exception("Aucune clé API configurée (Gemini ou OpenRouter).")

        models_to_try = [request.model] if request.model and request.model != "openrouter/auto" else [
            "mistralai/mistral-7b-instruct:free",
            "google/gemma-3-27b-it:free",
            "meta-llama/llama-3.3-70b-instruct:free"
        ]

        async with httpx.AsyncClient() as client:
            for model_name in models_to_try:
                print(f"DEBUG CHAT: Essai modèle cloud {model_name}...")
                try:
                    resp = await client.post(
                        OPENROUTER_URL,
                        headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"},
                        json={
                            "model": model_name,
                            "messages": final_messages,
                            "temperature": 0.3,
                            "max_tokens": 600
                        },
                        timeout=45.0
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        data["catalog_hits"] = raw_hits
                        return data
                except Exception as e:
                    print(f"DEBUG CHAT: Erreur {model_name}: {str(e)}")
                    continue
            
        raise Exception("Aucun modèle IA n'a répondu.")

    except Exception as err:
        import traceback
        trace = traceback.format_exc()
        print(f"DEBUG CHAT ERROR:\n{trace}")
        return {
            "choices": [{"message": {"role": "assistant", "content": f"Désolé, j'ai rencontré un problème technique.\n\nErreur : {str(err)}"}}],
            "debug": trace
        }

async def call_gemini_native_chat(messages: List[Dict[str, str]], max_tokens: int = 500) -> Dict:
    """Fallback via REST API Google Gemini (plus robuste que le SDK)."""
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY non configurée.")
    
    # Préparation du contenu au format Gemini REST
    contents = []
    system_instr = ""
    for m in messages:
        if m["role"] == "system":
            system_instr = m["content"]
            continue
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})

    models = ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro-latest", "gemini-pro"]
    
    async with httpx.AsyncClient() as client:
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": contents,
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": max_tokens
                }
            }
            if system_instr:
                payload["system_instruction"] = {"parts": [{"text": system_instr}]}

            try:
                print(f"DEBUG CHAT NATIVE REST: Essai {model}...")
                resp = await client.post(url, json=payload, timeout=30.0)
                if resp.status_code == 200:
                    data = resp.json()
                    text = data['candidates'][0]['content']['parts'][0]['text']
                    print(f"DEBUG CHAT NATIVE REST: Succès avec {model}")
                    return {"choices": [{"message": {"role": "assistant", "content": text}}]}
                print(f"DEBUG CHAT NATIVE REST: Échec {model} ({resp.status_code})")
            except Exception as e:
                print(f"DEBUG CHAT NATIVE REST: Erreur {model}: {str(e)}")
                continue
                
    raise Exception("Tous les modèles Gemini REST ont échoué.")

# ─────────────────────────────────────────────
#   LIKE THIS — Recherche Visuelle Assistée IA
# ─────────────────────────────────────────────

class LikeThisRequest(BaseModel):
    image_base64: str            # data:image/jpeg;base64,... ou juste le base64 brut
    image_url: Optional[str] = None  # Alternative si URL distante

VISION_MODELS = [
    "google/gemini-2.0-flash-001",
    "google/gemini-2.0-flash-lite-001",
    "meta-llama/llama-3.2-11b-vision-instruct:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
]

# Mapping des termes de mode génériques vers les termes Barsha
FASHION_SYNONYMS = {
    'TOTE BAG': 'SAC',
    'MESSENGER BAG': 'SACOCHE',
    'BACKPACK': 'SAC A DOS',
    'SNEAKERS': 'BASKET',
    'HOODIE': 'SWEAT CAPUCHE',
    'SWEATSHIRT': 'SWEAT',
    'JEANS': 'JEAN',
    'T-SHIRT': 'T SHIRT',
    'DRESS': 'ROBE',
    'JACKET': 'VESTE',
    'COAT': 'MANTEAU',
    'SKIRT': 'JUPE',
    'SHIRT': 'CHEMISE',
    'POLO SHIRT': 'POLO',
    'SHORTS': 'SHORT',
    'TROUSERS': 'PANTALON',
    'PANTS': 'PANTALON',
}


VISION_PROMPT = """Tu es un expert en mode et classification produit pour une boutique de vêtements.
Analyse cette image de vêtement et retourne UNIQUEMENT un JSON valide (sans commentaires, sans code blocks) avec ces champs :

{
  "title_guess": "NOM_PRODUIT_EN_MAJUSCULES",
  "famille": "TEEN WOMEN | TEEN MEN | WOMEN | MEN | KIDS | BABY",
  "colors": ["COULEUR1", "COULEUR2"],
  "categories_hint": [],
  "style_keywords": ["casual", "chic", "sport"],
  "confidence": 0.85
}

Règles :
- title_guess : type de vêtement générique (T SHIRT, ROBE, PANTALON, VESTE, CHEMISE, SHORT, etc.)
- famille : choisis parmi EXACTEMENT ces valeurs : TEEN WOMEN, TEEN MEN, WOMEN, MEN, KIDS, BABY, GIRLS, BOYS
- colors : liste des couleurs dominantes en majuscules (NOIR, BLANC, BLEU, ROUGE, ROSE, BEIGE, MARRON, VERT, GRIS, etc.)
- style_keywords : 2-4 mots décrivant le style
- confidence : ta confiance de 0 à 1

Réponds UNIQUEMENT avec le JSON, pas d'introduction, pas de conclusion, SOIS ULTRA-CONCIS (max 100 tokens)."""

async def call_vision_ai(image_base64: str, image_url: Optional[str] = None) -> dict:
    """Appelle un modèle vision via OpenRouter ou Gemini pour extraire les attributs produit."""
    # Si pas d'OpenRouter, essayer directement Gemini
    if not OPENROUTER_API_KEY:
        if GEMINI_API_KEY:
            print("DEBUG VISION: Pas d'OpenRouter, utilisation directe de Gemini...")
            return await call_gemini_native_vision(image_base64)
        else:
            raise HTTPException(status_code=500, detail="Aucune clé API vision configurée (OpenRouter ou Gemini)")

    import base64
    if image_url:
        try:
            async with httpx.AsyncClient() as dl_client:
                dl_resp = await dl_client.get(image_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10.0)
                dl_resp.raise_for_status()
                # Conversion en base64
                mime_type = dl_resp.headers.get("content-type", "image/jpeg")
                b64_data = base64.b64encode(dl_resp.content).decode("utf-8")
                image_base64 = f"data:{mime_type};base64,{b64_data}"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Impossible de télécharger l'image: {str(e)}")

    # S'assurer que le préfixe data: est présent et correct
    if not image_base64.startswith("data:"):
        # Détection basique du MIME type via le premier caractère du base64
        # '/' -> JPEG, 'i' -> PNG, 'R' -> GIF, 'U' -> WebP
        first_char = image_base64[0] if image_base64 else ""
        mime = "image/jpeg"
        if first_char == "i": mime = "image/png"
        elif first_char == "R": mime = "image/gif"
        elif first_char == "U": mime = "image/webp"
        
        image_base64 = f"data:{mime};base64,{image_base64}"
    
    image_content = {"type": "image_url", "image_url": {"url": image_base64}}

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": VISION_PROMPT},
                image_content
            ]
        }
    ]

    headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}
    payload_base = {
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 500
    }

    async with httpx.AsyncClient() as client:
        last_error = "No models available or all failed."
        for model in VISION_MODELS:
            try:
                print(f"DEBUG VISION: Essai avec le modèle {model}...")
                payload = {**payload_base, "model": model}
                resp = await client.post(OPENROUTER_URL, headers=headers, json=payload, timeout=40.0)
                data = resp.json()
                
                if resp.status_code == 200 and "choices" in data:
                    raw = data["choices"][0]["message"]["content"]
                    if not raw:
                        print(f"DEBUG VISION: {model} a renvoyé un contenu vide.")
                        continue
                    raw = raw.strip()
                    # Nettoyer les backticks markdown si présents
                    raw = re.sub(r"^```(?:json)?\s*", "", raw)
                    raw = re.sub(r"\s*```$", "", raw)
                    try:
                        parsed = json.loads(raw)
                        # Si la confiance est trop basse ou le résultat vide, on tente le modèle suivant
                        if (parsed.get("confidence") or 0) < 0.1 or not parsed.get("title_guess"):
                            last_error = f"Low confidence result from {model}: {parsed.get('confidence')}"
                            print(f"DEBUG VISION: {model} - résultat ignoré (confiance trop basse: {parsed.get('confidence')})")
                            continue
                        print(f"DEBUG VISION: {model} a réussi avec succès !")
                        return parsed
                    except json.JSONDecodeError:
                        last_error = f"JSONDecodeError on model {model}"
                        print(f"DEBUG VISION: {model} - erreur JSON: {raw}")
                        continue
                else:
                    err_msg = data.get('error', {}).get('message', 'Unknown error')
                    last_error = f"HTTP {resp.status_code}: {err_msg}"
                    print(f"DEBUG VISION: {model} a échoué (HTTP {resp.status_code}: {err_msg})")
            except Exception as e:
                last_error = str(e)
                print(f"DEBUG VISION: Erreur d'exception avec {model}: {str(e)}")
                continue
                
    # --- FALLBACK 1 : NATIVE GEMINI (SI DISPONIBLE) ---
    if GEMINI_API_KEY:
        print(f"DEBUG VISION: Tentative FALLBACK NATIVE GEMINI...")
        try:
            native_val = await call_gemini_native_vision(image_base64)
            return native_val
        except Exception as gem_e:
            print(f"DEBUG VISION NATIVE: Échec: {str(gem_e)}")

    # Mode Survie - ne pas planter, retourner un objet vide pour laisser le moteur local décider
    return {"title_guess": "ARTICLE", "famille": None, "colors": [], "confidence": 0.1, "is_survival": True}

async def call_gemini_native_vision(image_base64: str) -> dict:
    """Analyse d'image via l'API Google Gemini REST (Direct)."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise Exception("GEMINI_API_KEY non configurée.")
    
    if "," in image_base64:
        image_data = image_base64.split(",")[1]
    else:
        image_data = image_base64

    # On utilise les modèles détectés comme étant disponibles
    models = ["gemini-2.0-flash", "gemini-2.0-flash-lite-001", "gemini-1.5-flash"]
    
    async with httpx.AsyncClient() as client:
        for model in models:
            for api_v in ["v1beta", "v1"]:
                url = f"https://generativelanguage.googleapis.com/{api_v}/models/{model}:generateContent?key={api_key}"
                gen_config = {"temperature": 0.1, "maxOutputTokens": 400}
                if api_v == "v1beta":
                    gen_config["responseMimeType"] = "application/json"
                
                payload = {
                    "contents": [{"parts": [{"text": VISION_PROMPT}, {"inline_data": {"mime_type": "image/jpeg", "data": image_data}}]}],
                    "generationConfig": gen_config
                }
                
                try:
                    print(f"DEBUG VISION NATIVE REST: Essai {model} ({api_v})...")
                    resp = await client.post(url, json=payload, timeout=30.0)
                    
                    if resp.status_code == 429:
                        print(f"DEBUG VISION: Rate limit (429) sur {model}. Pause de 2s...")
                        await asyncio.sleep(2) # Petite attente
                        resp = await client.post(url, json=payload, timeout=30.0)

                    if resp.status_code == 200:
                        data = resp.json()
                        raw = data['candidates'][0]['content']['parts'][0]['text']
                        # Nettoyage JSON
                        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE|re.IGNORECASE)
                        raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
                        return json.loads(raw)
                    else:
                        print(f"DEBUG VISION: {model} {api_v} a échoué ({resp.status_code})")
                except Exception as e:
                    print(f"DEBUG VISION: Exception {model}: {str(e)}")
                    continue
                
    raise Exception("Tous les modèles Gemini Vision REST ont échoué (404/400).")

def score_product(product: dict, detected: dict) -> int:
    """Calcule un score de similarité métier sans moteur vectoriel."""
    score = 0
    title_d = (detected.get("title_guess") or "").upper()
    famille_d = (detected.get("famille") or "").upper()
    colors_d = [c.upper() for c in (detected.get("colors") or [])]
    cats_d = set(c.get("id") for c in (detected.get("categories_hint") or []) if isinstance(c, dict))
    if not cats_d and detected.get("categories_hint"):
        cats_d = set(detected["categories_hint"]) if all(isinstance(x, int) for x in detected["categories_hint"]) else set()

    # +40 : même type de vêtement dans le titre
    prod_title = (product.get("title") or product.get("nom") or "").upper()
    
    # On vérifie le titre direct ou son synonyme Barsha
    normalized_title = FASHION_SYNONYMS.get(title_d, title_d)
    
    if title_d and (title_d in prod_title or normalized_title in prod_title):
        score += 40
    elif title_d and any(w in prod_title for w in title_d.split()):
        score += 20
    elif normalized_title and any(w in prod_title for w in normalized_title.split()):
        score += 20

    # +30 : même Famille
    prod_famille = (product.get("Famille") or product.get("famille") or "").upper()
    if famille_d and famille_d == prod_famille:
        score += 30
    elif famille_d and famille_d in prod_famille:
        score += 15

    # +20 : couleur détectée disponible dans les déclinaisons
    declinaisons = product.get("declinaisons") or []
    prod_colors = {(d.get("couleur") or d.get("libellet") or "").upper() for d in declinaisons}
    for c in colors_d:
        if c in prod_colors:
            score += 20
            break

    # +10 : catégories communes
    prod_cats = set(c.get("id") for c in (product.get("categories") or []) if isinstance(c, dict))
    shared_cats = prod_cats & cats_d
    if shared_cats:
        score += min(len(shared_cats) * 5, 10)

    return score

def format_product_line(p: dict) -> str:
    """Formate un produit en supportant les formats Meilisearch et Catalogue JSON."""
    pid = p.get("id")
    
    # 1. Nom/Titre
    nom = str(p.get("title") or p.get("name") or p.get("nom") or "Article Barsha").split("|")[0].strip()
    
    # 2. Prix (Supporte price, currentPrice, prix)
    raw_price = p.get('currentPrice') or p.get('price') or p.get('prix')
    prix = f"{raw_price} TND" if raw_price else "Prix N/A"
    
    # 3. Référence
    ref = p.get("sku") or p.get("reference") or "N/A"
    
    famille = p.get("Famille") or p.get("famille") or ""

    def ensure_abs_url(url: str):
        if not url: return ""
        if isinstance(url, dict): 
            url = url.get("url") or ""
        if not url: return ""
        return url if url.startswith("http") else f"https://barsha.com.tn/{url.lstrip('/')}"

    # 4. Variantes
    declinaisons = p.get("declinaisons") or []
    variants_parts = []
    for d in declinaisons:
        if not d.get("active", True): continue
        libellet = str(d.get("libellet") or d.get("couleur") or "").upper()
        imgs = d.get("images") or []
        img_d = ""
        if imgs:
            first = imgs[0]
            img_d = (first.get("medium") or {}).get("url") or first.get("url") or ""
        elif d.get("texture"):
            img_d = (d["texture"].get("medium") or {}).get("url") or d["texture"].get("url") or ""
        
        img_d = ensure_abs_url(img_d)
        if libellet:
            variants_parts.append(f"{libellet}:{img_d}" if img_d else libellet)

    # 5. Image Principale (Supporte firstImg et image)
    img_val = p.get("firstImg") or p.get("image") or ""
    main_img = ensure_abs_url(img_val)
    
    variants_str = ", ".join(variants_parts) if variants_parts else "N/A"

    return (
        f"- [ID:{pid}] [{ref}] {nom} | {prix} | Famille:{famille} | "
        f"Couleurs+Images: {variants_str} | "
        f"ImgPrincipale: {main_img} | "
        f"https://barsha.com.tn/fr/produit/{pid}"
    )

@app.post("/api/like-this")
async def like_this(request: LikeThisRequest):
    """
    Recherche visuelle assistée par IA (Vectorielle + LLM Fallback).
    1. Tente la recherche vectorielle locale (CLIP)
    2. Si échec ou pas de vecteurs, utilise le modèle vision LLM
    3. Score et retourne les produits similaires
    """
    image_base64 = request.image_base64
    detected = None
    
    # --- PRIORITÉ : MOTEUR VECTORIEL LOCAL ---
    if CLIP_MODEL is not None and PRODUCT_VECS is not None:
        try:
            print("DEBUG VISION: Recherche vectorielle locale...")
            if "," in image_base64:
                img_clean = image_base64.split(",")[1]
            else:
                img_clean = image_base64
            
            # Nettoyage de l'image base64
            img_data = base64.b64decode(img_clean)
            query_img = Image.open(BytesIO(img_data)).convert("RGB")
            
            # Encoder l'image utilisateur en mode NATIVE (Float32 par défaut)
            inputs = CLIP_PROCESSOR(images=query_img, return_tensors="pt")
            with torch.no_grad():
                outputs = CLIP_MODEL.get_image_features(**inputs)
                # S'assurer que outputs est un tenseur (objet de sortie Transformers)
                if not isinstance(outputs, torch.Tensor):
                    # Dans certaines versions de transformers, get_image_features renvoie un objet
                    # ATTENTION : on ne peut pas utiliser 'or' sur un Tenseur (ambigu)
                    pooler = getattr(outputs, "pooler_output", None)
                    outputs = pooler if pooler is not None else outputs[0]
            
            # Normalisation et calcul de similarité (Tout en Float32)
            # Puisque PRODUCT_VECS est déjà normalisé, on ne normalise que la requête
            query_vec = torch.nn.functional.normalize(outputs, p=2, dim=-1).to("cpu").float()
            
            # Similarité cosinus (produit scalaire)
            cos_scores = torch.matmul(PRODUCT_VECS, query_vec.T).squeeze()
            
            # Récupérer les 25 meilleurs candidats pour filtrage
            top_val, top_idx = torch.topk(cos_scores, k=min(25, len(PRODUCT_IDS)))
            
            # MODE HAUTE PRÉCISION (Ajusté de 0.75 à 0.70 pour plus de tolérance)
            THRESHOLD = 0.70
            top_score = top_val[0].item()
            
            # Écart ultra-serré pour la perfection visuelle
            ADAPTIVE_GAP = 0.05
            MIN_REQUIRED = max(THRESHOLD, top_score - ADAPTIVE_GAP)
            
            # Charger le catalogue pour récupérer les détails
            with open(CATALOG_PATH, "r", encoding="utf-8") as f:
                full_catalog = json.load(f)
            catalog_map = {str(p["id"]): p for p in full_catalog}
            
            final_lines = []
            scores_log = []
            main_group = None
            
            # Groupes sémantiques pour une cohérence accrue
            GROUPS = {
                "BAGS": ["SAC", "SACOCHE", "POCHETTE", "CABAS", "BANDOULIERE", "VALISE", "SAC-A-MAIN", "SAC-A-DOS"],
                "FOOTWEAR": ["BALLERINE", "CHAUSSURE", "SABOT", "BASKET", "DERBI", "MOCASSIN", "SANDALE", "ESCARPIN", "TALON", "BOTTINE", "BOTTE"],
                "T-SHIRTS": ["T", "T-SHIRT", "DEBARDEUR", "POLO"],
                "PULLS": ["PULL", "SWEAT", "CARDIGAN", "SWEAT-SHIRT", "BLOUSSANT", "VESTE"],
                "BOTTOMS": ["PANTALON", "SHORT", "BERMUDA", "JUPE", "LEGGING", "JEANS", "JEAN"],
                "DRESSES": ["ROBE", "COMBINAISON", "CAFTAN"]
            }

            def get_group(p_name: str):
                p_name = p_name.upper().replace('À', 'A')
                first_word = p_name.split()[0]
                for g_id, keywords in GROUPS.items():
                    if first_word in keywords: return g_id
                    for kw in keywords:
                        if f" {kw} " in f" {p_name} ": return g_id
                return first_word

            for i, (score, idx) in enumerate(zip(top_val, top_idx)):
                s_val = score.item()
                # Application du seuil ADAPTATIF
                if s_val < MIN_REQUIRED: continue
                
                pid = str(PRODUCT_IDS[idx.item()])
                if pid in catalog_map:
                    product = catalog_map[pid]
                    p_nom = (product.get("nom") or "").upper().replace('À', 'A')
                    
                    if i == 0:
                        main_group = get_group(p_nom)
                    
                    if main_group and i > 0:
                        curr_group = get_group(p_nom)
                        if curr_group != main_group:
                            if main_group in GROUPS:
                                continue
                            elif curr_group != main_group:
                                continue
                    
                    line = format_product_line(product)
                    final_lines.append(line)
                    if len(scores_log) < 3: scores_log.append(f"{s_val:.4f}")
            
            if final_lines:
                print(f"DEBUG VISION: Succès vectoriel ({len(final_lines)} résultats, top scores: {', '.join(scores_log)}) [GAP Filter: {MIN_REQUIRED:.2f}]")
                return {
                    "method": "local_vector",
                    "similaires": final_lines[:12], # Limiter à 12 pour l'UI
                    "complements": [],
                    "detected": {
                        "title_guess": "RECHERCHE VISUELLE",
                        "famille": "Barsha Catalog",
                        "colors": ["Match Visuel"],
                        "style_keywords": ["local"],
                        "confidence": float(top_val[0].item())
                    }
                }
            else:
                # MODE CLIP-ONLY: Retourner les résultats même si le score est faible
                print(f"DEBUG VISION: Score faible mais mode CLIP-ONLY activé (max: {top_val[0].item():.4f})")
                # Retourner les meilleurs résultats CLIP sans filtrage strict
                for i, (score, idx) in enumerate(zip(top_val[:12], top_idx[:12])):
                    pid = str(PRODUCT_IDS[idx.item()])
                    if pid in catalog_map:
                        line = format_product_line(catalog_map[pid])
                        final_lines.append(line)

                if final_lines:
                    return {
                        "method": "local_vector_relaxed",
                        "similaires": final_lines[:12],
                        "complements": [],
                        "detected": {
                            "title_guess": "RECHERCHE VISUELLE",
                            "famille": "Barsha Catalog",
                            "colors": ["Match Visuel"],
                            "style_keywords": ["clip-only"],
                            "confidence": float(top_val[0].item())
                        }
                    }
        except Exception as ve:
            print(f"DEBUG VISION: Erreur moteur vectoriel: {str(ve)}")
            # MODE CLIP-ONLY: Retourner une erreur claire au lieu de fallback LLM
            return {
                "method": "clip_error",
                "similaires": [],
                "complements": [],
                "detected": {"title_guess": "ERREUR", "confidence": 0},
                "error": f"Erreur traitement image: {str(ve)}"
            }

    # ── Fallback : Si CLIP n'est pas disponible, essayer LLM ──
    # Seulement si une clé API est configurée
    if not OPENROUTER_API_KEY and not GEMINI_API_KEY:
        return {
            "method": "no_model",
            "similaires": [],
            "complements": [],
            "detected": {"title_guess": "AUCUN", "confidence": 0},
            "error": "Moteur CLIP indisponible et aucune clé API vision configurée"
        }

    detected = await call_vision_ai(image_base64, request.image_url)

    # ── Étape 2 : Construction de la requête Meilisearch ──
    title_raw = (detected.get("title_guess") or "").upper()
    # Normalisation pour Meilisearch Barsha
    q = FASHION_SYNONYMS.get(title_raw, title_raw)
    if not q: q = "ARTICLE"
    
    # On ajoute les style_keywords pour affiner
    style_q = " ".join(detected.get("style_keywords") or [])
    full_q = f"{q} {style_q}".strip()
    
    famille_val = detected.get("famille") or ""

    # Filtre natif sur Famille si disponible
    famille_filter_list = [famille_val] if famille_val else None

    # Recherche principale
    hits = await call_meilisearch(full_q, 60, famille_filter=famille_filter_list)

    # Si peu de résultats, élargir sans filtre famille
    if len(hits) < 5:
        hits = await call_meilisearch(q, 60)

    # ── Étape 3 : Scoring métier ──
    scored = []
    seen_ids = set()
    for p in hits:
        pid = p.get("id")
        if not pid or pid in seen_ids:
            continue
        seen_ids.add(pid)
        s = score_product(p, detected)
        scored.append((s, p))

    scored.sort(key=lambda x: x[0], reverse=True)

    # ── Étape 4 : Séparation similaires / compléments ──
    # Similaires : top 8 produits bien scorés
    similaires_raw = [p for (s, p) in scored if s >= 20][:8]
    # Si pas assez, compléter avec les suivants
    if len(similaires_raw) < 4:
        similaires_raw = [p for (_, p) in scored[:8]]

    # Compléments : produits d'une famille proche mais de catégorie différente
    # On cherche les IDs listés dans 'complements' du top produit, sinon 2e batch
    complement_ids = set()
    for p in similaires_raw[:3]:
        for c in (p.get("complements") or []):
            if isinstance(c, int):
                complement_ids.add(c)

    complements_raw = []
    if complement_ids:
        # Chercher les produits compléments par ID via Meilisearch
        filter_ids = " OR ".join(f"id = {cid}" for cid in list(complement_ids)[:6])
        comp_hits = await call_meilisearch("", 6, famille_filter=None)
        comp_hits_filtered = [h for h in comp_hits if h.get("id") in complement_ids]
        complements_raw = comp_hits_filtered[:6]

    # Si pas de compléments via IDs, on prend un 2e batch différent (famille différente)
    if not complements_raw:
        alt_famille = ["WOMEN", "TEEN WOMEN"] if "MEN" not in famille_val.upper() else ["MEN", "TEEN MEN"]
        alt_hits = await call_meilisearch(q, 20, famille_filter=alt_famille if not famille_filter_list or alt_famille != famille_filter_list else None)
        alt_seen = {p.get("id") for p in similaires_raw}
        complements_raw = [h for h in alt_hits if h.get("id") not in alt_seen][:6]

    # ── Étape 5 : Formatage de la réponse ──
    similaires_lines = [format_product_line(p) for p in similaires_raw]
    complements_lines = [format_product_line(p) for p in complements_raw]

    return {
        "detected": {
            "title_guess": detected.get("title_guess"),
            "famille": detected.get("famille"),
            "colors": detected.get("colors", []),
            "style_keywords": detected.get("style_keywords", []),
            "confidence": detected.get("confidence", 0),
        },
        "similaires": similaires_lines,
        "complements": complements_lines,
        "total_searched": len(hits)
    }


# ═══════════════════════════════════════════════════════════════════════════════
# FRONTEND COMPATIBILITY ENDPOINTS
# Endpoints required by the Angular frontend that proxy to local database
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/getDeclinaisonStock/{declinaison_id}")
async def get_declinaison_stock(declinaison_id: int):
    """Return stock/size data for a product variant (declinaison).
    The frontend calls this to populate sizes when a color is selected."""
    try:
        from app.core.database import SessionLocal
        from app.models.product import ProductVariant
        db = SessionLocal()
        try:
            # declinaison_id maps to variant ID
            variant = db.query(ProductVariant).filter(ProductVariant.id == declinaison_id).first()
            if not variant:
                return {"data": []}

            # Get all variants for the same product and color to show all sizes
            siblings = db.query(ProductVariant).filter(
                ProductVariant.product_id == variant.product_id,
                ProductVariant.color == variant.color,
                ProductVariant.is_active == True
            ).all()

            data = []
            for v in siblings:
                data.append({
                    "size": v.size or "TU",
                    "qte": v.available_quantity,
                    "ean13": v.ean13 or "",
                    "state": "available" if v.is_in_stock else "unavailable"
                })

            return {"data": data}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error fetching stock for declinaison {declinaison_id}: {e}")
        return {"data": []}


@app.post("/api/checkStock")
async def check_stock(request: Request):
    """Check stock availability for a specific EAN13 + quantity"""
    try:
        body = await request.json()
        ean13 = body.get("ean13", "")
        quantity = body.get("quantity", 1)

        from app.core.database import SessionLocal
        from app.models.product import ProductVariant
        db = SessionLocal()
        try:
            variant = db.query(ProductVariant).filter(ProductVariant.ean13 == ean13).first()
            if variant and variant.available_quantity >= quantity:
                return {"inStock": True, "availableQuantity": variant.available_quantity}
            return {"inStock": False, "availableQuantity": variant.available_quantity if variant else 0}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error checking stock: {e}")
        return {"inStock": False, "availableQuantity": 0}


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN & E-COMMERCE MODULE INTEGRATION
# Integrates the professional admin back-office with the AI backend
# ═══════════════════════════════════════════════════════════════════════════════

ADMIN_AVAILABLE = False

try:
    from app.core.database import create_tables, SessionLocal, get_db
    from app.core.config import settings
    from app.core.security import hash_password
    from app.models.user import User, UserRole
    # Import analytics models to register with SQLAlchemy Base for table creation
    from app.models import analytics
    # Import wishlist_share model for table creation
    from app.models.wishlist_share import WishlistShare
    # Import product_alert model for table creation
    from app.models.product_alert import ProductAlert, AlertHistory
    # Import outfit model for table creation
    from app.models.outfit import Outfit, OutfitItem
    # Import product_review model for table creation
    from app.models.product_review import ProductReview, ReviewVote, ProductRatingStats
    # Import gift_card model for table creation
    from app.models.gift_card import GiftCard, GiftCardTransaction, UserStoreCredit, StoreCreditTransaction
    # Import loyalty model for table creation
    from app.models.loyalty import LoyaltyAccount, PointsTransaction, PointsRedemption
    from app.routers import (
        auth_router,
        payment_router,
        orders_router,
        orders_compat_router,
        admin_dashboard_router,
        admin_orders_router,
        admin_products_router,
        admin_customers_router,
        admin_coupons_router,
        admin_returns_router,
        admin_content_router,
        admin_settings_router,
        admin_reports_router,
        recommendations_router,
        analytics_router,
        support_router,
        admin_support_router,
        notifications_router,
        faq_router,
        admin_faq_router,
        meilisearch_compat_router,
        premium_recommendations_router,
        next_gen_recommendations_router,
        user_preferences_router,
        wishlist_sharing_router,
        alerts_router,
        admin_alerts_router,
        outfits_router,
        admin_outfits_router,
        reviews_router,
        admin_reviews_router,
        gift_cards_router,
        admin_gift_cards_router,
        loyalty_router,
        admin_loyalty_router,
        stock_alerts_router,
        promotions_router,
        admin_promotions_router,
        bundles_router,
        admin_bundles_router,
        newsletter_router,
        referrals_router,
        product_qa_router,
        admin_product_qa_router
    )
    ADMIN_AVAILABLE = True
    logger.info("Admin module loaded successfully")
except ImportError as e:
    logger.warning(f"Admin module not available: {e}")
    logger.info("Running in AI-only mode. Admin features disabled.")
    recommendations_router = None
    analytics_router = None


# Register admin routers if available
if ADMIN_AVAILABLE:
    app.include_router(auth_router, prefix="/api", tags=["Authentication"])
    app.include_router(payment_router, tags=["Payment"])
    app.include_router(orders_router, tags=["Orders"])
    app.include_router(orders_compat_router, tags=["Orders Compatibility"])
    app.include_router(admin_dashboard_router, prefix="/api", tags=["Admin Dashboard"])
    app.include_router(admin_orders_router, prefix="/api", tags=["Admin Orders"])
    app.include_router(admin_products_router, prefix="/api", tags=["Admin Products"])
    app.include_router(admin_customers_router, prefix="/api", tags=["Admin Customers"])
    app.include_router(admin_coupons_router, prefix="/api", tags=["Admin Coupons"])
    app.include_router(admin_returns_router, prefix="/api", tags=["Admin Returns"])
    app.include_router(admin_content_router, prefix="/api", tags=["Admin Content"])
    app.include_router(admin_settings_router, prefix="/api", tags=["Admin Settings"])
    app.include_router(admin_reports_router, prefix="/api", tags=["Admin Reports"])
    app.include_router(support_router, prefix="/api", tags=["Customer Support"])
    app.include_router(admin_support_router, prefix="/api", tags=["Admin Support"])
    app.include_router(notifications_router, prefix="/api", tags=["Notifications"])
    app.include_router(faq_router, prefix="/api", tags=["Help Center"])
    app.include_router(admin_faq_router, prefix="/api", tags=["Admin FAQ"])
    app.include_router(meilisearch_compat_router, tags=["MeiliSearch Compatibility"])
    app.include_router(premium_recommendations_router, tags=["Premium Recommendations"])
    app.include_router(next_gen_recommendations_router, tags=["Next-Gen Recommendations"])
    app.include_router(user_preferences_router, tags=["User Preferences"])
    app.include_router(wishlist_sharing_router, prefix="/api", tags=["Wishlist Sharing"])
    app.include_router(alerts_router, prefix="/api", tags=["Product Alerts"])
    app.include_router(admin_alerts_router, prefix="/api", tags=["Admin Alerts"])
    app.include_router(outfits_router, tags=["Shop the Look"])
    app.include_router(admin_outfits_router, tags=["Admin Outfits"])
    app.include_router(reviews_router, tags=["Product Reviews"])
    app.include_router(admin_reviews_router, tags=["Admin Reviews"])
    app.include_router(gift_cards_router, prefix="/api", tags=["Gift Cards"])
    app.include_router(admin_gift_cards_router, prefix="/api", tags=["Admin Gift Cards"])
    app.include_router(loyalty_router, tags=["Loyalty Program"])
    app.include_router(admin_loyalty_router, tags=["Admin Loyalty"])
    app.include_router(stock_alerts_router, prefix="/api", tags=["Stock Alerts"])
    app.include_router(promotions_router, prefix="/api", tags=["Promotions"])
    app.include_router(admin_promotions_router, prefix="/api", tags=["Admin Promotions"])
    app.include_router(bundles_router, tags=["Bundles"])
    app.include_router(admin_bundles_router, tags=["Admin Bundles"])
    app.include_router(newsletter_router, prefix="/api", tags=["Newsletter"])
    app.include_router(referrals_router, tags=["Referrals"])
    app.include_router(product_qa_router, tags=["Product Q&A"])
    app.include_router(admin_product_qa_router, tags=["Admin Q&A"])
    if recommendations_router:
        app.include_router(recommendations_router, tags=["AI Recommendations"])
    if analytics_router:
        app.include_router(analytics_router)
    logger.info("All routers registered (including promotions, bundles, newsletter, referrals, product-qa)")


# Initialize database on startup
@app.on_event("startup")
async def init_admin_database():
    """Initialize admin database and create default admin user"""
    if not ADMIN_AVAILABLE:
        return

    try:
        create_tables()
        logger.info("Database tables created/verified")

        db = SessionLocal()
        try:
            # Create default admin user
            admin = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
            if not admin:
                admin = User(
                    email=settings.ADMIN_EMAIL,
                    password_hash=hash_password(settings.ADMIN_PASSWORD),
                    first_name="Admin",
                    last_name="Barsha",
                    role=UserRole.SUPER_ADMIN,
                    is_active=True,
                    is_verified=True
                )
                db.add(admin)
                db.commit()
                logger.info(f"Default admin user created: {settings.ADMIN_EMAIL}")

            # Seed FAQ data if not exists
            try:
                from app.routers.faq import seed_default_faqs
                seed_default_faqs(db)
                logger.info("FAQ data seeded successfully")
            except Exception as faq_error:
                logger.warning(f"FAQ seeding skipped: {faq_error}")

            # Seed storefront data (categories, products, banners, content)
            try:
                from app.seed_data import run_all_seeds
                # Check if we already have products
                from app.models.product import Product
                product_count = db.query(Product).count()
                if product_count < 10:
                    logger.info("Seeding storefront data...")
                    run_all_seeds(db, products_limit=200)
                else:
                    logger.info(f"Storefront data already exists ({product_count} products)")
            except Exception as seed_error:
                logger.warning(f"Storefront seeding skipped: {seed_error}")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Database initialization error: {e}")


# Health check endpoint (enhanced)
@app.get("/health", tags=["System"])
async def health_check():
    """System health check - returns status of all modules"""
    # Check recommendation engine
    rec_status = "unavailable"
    rec_products = 0
    try:
        from app.services.recommendation_engine import get_recommendation_engine
        engine = get_recommendation_engine()
        rec_status = "available"
        rec_products = len(engine.catalog)
    except:
        pass

    return {
        "status": "healthy",
        "ai": {
            "chat": "available",
            "visual_search": "available" if CLIP_MODEL is not None else "unavailable",
            "recommendations": rec_status,
            "products_indexed": len(PRODUCT_IDS) if PRODUCT_IDS else 0,
            "recommendations_catalog": rec_products
        },
        "admin": "available" if ADMIN_AVAILABLE else "unavailable",
        "database": "connected" if ADMIN_AVAILABLE else "not configured",
        "version": "2.1.0"
    }


# API info endpoint
@app.get("/api", tags=["System"])
async def api_info():
    """API information and available endpoints"""
    endpoints = {
        "ai": {
            "chat": "/api/chat",
            "visual_search": "/api/like-this"
        }
    }
    if ADMIN_AVAILABLE:
        endpoints["auth"] = "/api/auth"
        endpoints["payment"] = "/api/payment"
        endpoints["orders"] = "/api/orders"
        endpoints["admin"] = {
            "dashboard": "/api/admin/dashboard",
            "orders": "/api/admin/orders",
            "products": "/api/admin/products",
            "customers": "/api/admin/customers",
            "coupons": "/api/admin/coupons",
            "returns": "/api/admin/returns",
            "content": "/api/admin/content",
            "support": "/api/admin/support",
            "alerts": "/api/admin/alerts"
        }
        endpoints["support"] = "/api/support"
        endpoints["alerts"] = "/api/alerts"
        endpoints["gift_cards"] = "/api/gift-cards"
    return {
        "name": "Barsha E-Commerce Platform API",
        "version": "2.0.0",
        "description": "Unified AI + Admin Backend",
        "endpoints": endpoints,
        "documentation": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print("  BARSHA E-COMMERCE PLATFORM - UNIFIED BACKEND")
    print("="*60)
    print(f"  AI Chat:        http://localhost:8000/api/chat")
    print(f"  Visual Search:  http://localhost:8000/api/like-this")
    print(f"  Admin API:      http://localhost:8000/api/admin")
    print(f"  Documentation:  http://localhost:8000/docs")
    print("="*60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
