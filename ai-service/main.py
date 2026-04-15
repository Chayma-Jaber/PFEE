"""
Barsha AI Microservice - Comprehensive Local AI Inference Service
=================================================================
This is the unified Python AI microservice for the Barsha e-commerce platform.

Capabilities:
  - POST /api/chat          : Full chatbot (Qwen/Ollama primary, Gemini/OpenRouter fallback)
  - POST /api/like-this     : CLIP visual search (legacy format)
  - POST /api/visual-search : CLIP visual search (structured format)
  - GET  /api/recommendations/:strategy : Recommendation engine endpoints
  - GET  /health            : Health check with component status

Architecture:
  - Qwen 2.5 7B via Ollama is the PRIMARY LLM
  - Gemini is FALLBACK #1 (if GEMINI_API_KEY set)
  - OpenRouter is FALLBACK #2 (if OPENROUTER_API_KEY set)
  - Meilisearch provides catalog grounding for chat
  - CLIP provides visual product search
  - Recommendation engines provide similar/complementary/personalized suggestions
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import sys
import json
import re
import base64
import asyncio
import logging
import traceback

import httpx
import numpy as np
import torch
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
from io import BytesIO
from dotenv import load_dotenv

# Ensure engines package is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engines import (
    RecommendationEngine,
    get_recommendation_engine,
    PremiumRecommendationEngine,
    NextGenRecommendationEngine,
)

# ─── Environment ───
load_dotenv(override=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─── Helper: clean env vars (strip stray quotes/spaces) ───
def get_clean_env(key: str) -> str | None:
    val = os.getenv(key)
    return val.strip("'\" ") if val else None


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
GEMINI_API_KEY = get_clean_env("GEMINI_API_KEY")
OPENROUTER_API_KEY = get_clean_env("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

MEILI_URL = os.getenv(
    "MEILISEARCH_URL",
    "https://cache-data.barsha.com.tn/indexes/products/search",
)
MEILI_TOKEN = os.getenv(
    "MEILISEARCH_TOKEN",
    "Bearer 660ac272a4c62f4138f96bc52d33f1d6de8a182712321c667f516312f2db200c",
)

DEFAULT_MODEL = "openrouter/auto"
VECTOR_MODEL_NAME = "openai/clip-vit-base-patch32"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
VECTORS_PATH = os.path.join(DATA_DIR, "product_vectors.pt")
CATALOG_PATH = os.path.join(DATA_DIR, "barsha_products.json")
STORES_PATH = os.path.join(DATA_DIR, "barsha_stores.json")


# ═══════════════════════════════════════════════════════════════════════════════
# GLOBAL STATE
# ═══════════════════════════════════════════════════════════════════════════════

CLIP_MODEL = None
CLIP_PROCESSOR = None
PRODUCT_IDS = None
PRODUCT_VECS = None
CATALOG_MAP: Dict[str, dict] = {}
LOCAL_CATALOG_IMAGES: Dict[str, str] = {}

# Recommendation engine singletons (initialised at startup)
REC_ENGINE: RecommendationEngine | None = None
PREMIUM_ENGINE: PremiumRecommendationEngine | None = None
NEXTGEN_ENGINE: NextGenRecommendationEngine | None = None


# ═══════════════════════════════════════════════════════════════════════════════
# SEMANTIC GROUPS (for CLIP coherence filtering)
# ═══════════════════════════════════════════════════════════════════════════════

GROUPS = {
    "BAGS": ["SAC", "SACOCHE", "POCHETTE", "CABAS", "BANDOULIERE", "VALISE", "SAC-A-MAIN", "SAC-A-DOS"],
    "FOOTWEAR": ["BALLERINE", "CHAUSSURE", "SABOT", "BASKET", "DERBI", "MOCASSIN", "SANDALE", "ESCARPIN", "TALON", "BOTTINE", "BOTTE"],
    "T-SHIRTS": ["T", "T-SHIRT", "DEBARDEUR", "POLO"],
    "PULLS": ["PULL", "SWEAT", "CARDIGAN", "SWEAT-SHIRT", "BLOUSSANT", "VESTE"],
    "BOTTOMS": ["PANTALON", "SHORT", "BERMUDA", "JUPE", "LEGGING", "JEANS", "JEAN"],
    "DRESSES": ["ROBE", "COMBINAISON", "CAFTAN"],
}


def get_group(product_name: str) -> str:
    p_name = product_name.upper().replace("\u00c0", "A")
    first_word = p_name.split()[0] if p_name.split() else ""
    for g_id, keywords in GROUPS.items():
        if first_word in keywords:
            return g_id
        for kw in keywords:
            if f" {kw} " in f" {p_name} ":
                return g_id
    return first_word


# ═══════════════════════════════════════════════════════════════════════════════
# CHAT HELPERS: GENDER / COLOR / BUDGET DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

GENDER_MALE_PATTERNS = r'\b(homme|hommes|masculin|masculins|mec|gars|gar\u00e7on|gar\u00e7ons|boy|boys|man|men|cale\u00e7on|boxer|slip)\b'
GENDER_FEMALE_PATTERNS = r'\b(femme|femmes|f\u00e9minin|f\u00e9minins|fille|filles|dame|dames|woman|women|girl|girls|robe|jupe|balerine|talon|talons|escarpin|chemisier|sac \u00e0 main)\b'
GENDER_KID_PATTERNS = r'\b(enfant|enfants|kid|kids|b\u00e9b\u00e9|bebe|junior|gar\u00e7onnet|fillette)\b'

COLOR_KEYWORDS = [
    'fushia', 'fuschia', 'fuchsia', 'rose', 'rouge', 'noir', 'blanc', 'bleu', 'vert', 'marron',
    'orange', 'jaune', 'violet', 'gris', 'beige', 'creme', 'cr\u00e8me', 'kaki', 'turquoise',
    'bordeaux', 'marine', 'caramel', 'corail', 'dor\u00e9', 'dore', 'argent', 'naturel',
    'rouille', 'ecru', '\u00e9cru', 'nude', 'camel', 'saumon', 'lavande', 'menthe',
]

COLOR_VARIATIONS = {
    'noire': 'noir', 'noires': 'noir', 'noirs': 'noir',
    'blanche': 'blanc', 'blanches': 'blanc', 'blancs': 'blanc',
    'grise': 'gris', 'grises': 'gris',
    'verte': 'vert', 'vertes': 'vert', 'verts': 'vert',
    'bleue': 'bleu', 'bleues': 'bleu', 'bleus': 'bleu',
    'violette': 'violet', 'violettes': 'violet', 'violets': 'violet',
    'dor\u00e9e': 'dor\u00e9', 'doree': 'dor\u00e9',
}


def detect_gender(query: str):
    """Return 'homme', 'femme', 'enfant' or None."""
    q = query.lower()
    if re.search(GENDER_MALE_PATTERNS, q):
        return 'homme'
    if re.search(GENDER_FEMALE_PATTERNS, q):
        return 'femme'
    if re.search(GENDER_KID_PATTERNS, q):
        return 'enfant'
    return None


def detect_color(query: str):
    """Return canonical colour from the query or None."""
    q = query.lower()
    for var, canonical in COLOR_VARIATIONS.items():
        if re.search(r'\b' + var + r'\b', q):
            return canonical.upper()
    for color in COLOR_KEYWORDS:
        if re.search(r'\b' + color + r'\b', q):
            return color.upper()
    return None


def detect_budget(query: str):
    """Extract a max-budget amount from the query (e.g. 'moins de 60.000')."""
    q = query.lower()
    match = re.search(r'(\d+[\.,]?\d*)\s*(?:dt|tnd|dinars?|tn)?', q)
    if match:
        try:
            raw_val = match.group(1).replace(',', '.')
            val = float(raw_val)
            if val >= 1000 and '.' not in raw_val:
                val = val / 1000
            return val
        except Exception:
            return None
    return None


def clean_search_query(query: str) -> str:
    """Clean user query for Meilisearch: semantic expansion + stop-word removal."""
    q = query.lower()
    semantic_map = {
        r'entretien|travail|bureau|chic|bank|banque': 'chic \u00e9l\u00e9gant chemise pantalon classique veste chaussure',
        r'mariage|f\u00eate|soir\u00e9e|ceremonie': 'robe soir\u00e9e \u00e9l\u00e9gant chic brillant satin chaussure',
        r'sport|jogging|quotidien|confortable': 'jogging t-shirt basket sport sweat chaussure',
        r'\u00e9t\u00e9|plage|vacances|maillot|bain': 'short robe l\u00e9g\u00e8re t-shirt cotton plage maillot',
        r'sac|sacoche|bag|valise|bagage': 'sac sacoche bandouli\u00e8re accessoire bag',
        r'froid|hiver|manteau|pull': 'pull sweat veste manteau cotton chaud',
        r'chaussure|basket|ballerine|talon|sabot|escarpin|pied': 'chaussure basket ballerine sabot basket',
    }
    extra_keywords = ""
    for pattern, keywords in semantic_map.items():
        if re.search(pattern, q):
            extra_keywords += " " + keywords

    stop_words = [
        'trouve', 'moi', 'des', 'un', 'une', 'cherche', 'montre', 'donne',
        'quelques', 'et', 'maintenant', 'je', 'veux', 'peux', 'me', 'donner',
        'pour', 'avec', 'dans', 'notre', 'boutique', 'les', 'la', 'le', 'l',
        'quelque', 'chose', 'comme', 'est', 'ce', 'qu', 'il', 'existe',
        'cette', 'cet', 'ces', 'avez', 'vous', 'as', 'tu', 'ou', 'qui',
        'que', 'quoi', 'disponible', 'article', 'produit', 'modele', 'ton',
        'ta', 'tes', 'mon', 'ma', 'mes', 'son', 'sa', 'ses',
    ]
    q = re.sub(r'[^\w\s]', ' ', q)
    words = q.split()
    meaningful_words = [w for w in words if w not in stop_words and len(w) > 2]

    final_query = " ".join(meaningful_words)
    if extra_keywords:
        final_query = f"{final_query} {extra_keywords}".strip()

    return final_query


# ═══════════════════════════════════════════════════════════════════════════════
# MEILISEARCH INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════════

GENRE_TO_FAMILLE = {
    'homme': ['MEN', 'TEEN MEN', 'BOYS', 'TEEN BOYS'],
    'femme': ['WOMEN', 'TEEN WOMEN', 'GIRLS', 'TEEN GIRLS'],
    'enfant': ['KIDS', 'BABY', 'JUNIOR'],
}

FAMILLE_HOMME = {'men', 'teen men', 'boys', 'teen boys', 'homme', 'hommes', 'garcon', 'garcons'}
FAMILLE_FEMME = {'women', 'teen women', 'girls', 'teen girls', 'femme', 'femmes', 'fille', 'filles'}
FAMILLE_ENFANT = {'kids', 'enfants', 'baby', 'bebe', 'junior'}


async def call_meilisearch(q: str, limit: int = 40, famille_filter: list = None, custom_filter: str = None):
    headers = {"Authorization": MEILI_TOKEN, "Content-Type": "application/json"}
    payload: dict = {"q": q, "limit": limit}

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
        except Exception:
            return []


def _get_famille_gender(product: dict):
    """Return 'homme', 'femme', 'enfant' or None from the product's Famille/Genre fields."""
    famille_raw = (
        product.get("famille") or product.get("Famille") or
        product.get("family") or product.get("Family") or ""
    )
    famille = str(famille_raw).strip().lower()

    if famille in FAMILLE_HOMME:
        return 'homme'
    if famille in FAMILLE_FEMME:
        return 'femme'
    if famille in FAMILLE_ENFANT:
        return 'enfant'

    genre_raw = product.get("genre") or product.get("Genre") or ""
    genre = str(genre_raw).lower()
    if 'homme' in genre or 'men' in genre:
        return 'homme'
    if 'femme' in genre or 'women' in genre:
        return 'femme'
    if 'enfant' in genre or 'kid' in genre:
        return 'enfant'

    if re.search(r'\b(men|boys|homme|masculin)\b', famille):
        return 'homme'
    if re.search(r'\b(women|girls|femme|f\u00e9minin)\b', famille):
        return 'femme'
    return None


def _gender_filter(product: dict, requested_gender: str) -> bool:
    """Return True if the product is compatible with the requested gender."""
    famille_gender = _get_famille_gender(product)
    if famille_gender is not None:
        return famille_gender == requested_gender

    candidate_fields = " ".join(filter(None, [
        str(product.get("name") or ""),
        str(product.get("nom") or ""),
        str(product.get("category") or ""),
        str(product.get("categorie") or ""),
        str(product.get("gender") or ""),
        str(product.get("genre") or ""),
        str(product.get("tags") or ""),
    ])).lower()

    opposite = {
        'homme': GENDER_FEMALE_PATTERNS,
        'femme': GENDER_MALE_PATTERNS,
        'enfant': None,
    }
    opp_pattern = opposite.get(requested_gender)
    if opp_pattern and re.search(opp_pattern, candidate_fields):
        return False
    return True


async def _fetch_stock_for_declinaison(client, did):
    try:
        resp = await client.get(
            f"https://main.barsha.com.tn/api/getDeclinaisonStock/{did}", timeout=2.0
        )
        data = resp.json().get("data", [])
        sizes = [f"{s.get('size')}:{s.get('qte')}" for s in data if s.get("qte", 0) > 0]
        return did, ",".join(sizes) if sizes else "Rupture"
    except Exception:
        return did, ""


def ensure_abs_url(url_val):
    if not url_val:
        return ""
    if isinstance(url_val, dict):
        url = (url_val.get("medium") or {}).get("url") or url_val.get("url") or ""
    else:
        url = str(url_val)
    if not url:
        return ""
    if url.startswith("http"):
        return url
    return f"https://barsha.com.tn/{url.lstrip('/')}"


def format_product_line(p: dict, pid, requested_color: str | None, stock_map: dict, local_images: dict) -> tuple[str | None, dict | None]:
    """
    Format a single product hit into the strict text line for the LLM system prompt
    AND into a clean_hit dict for the catalog_hits response metadata.

    Returns (line, clean_hit) or (None, None) if the product should be skipped.
    """
    nom = str(
        p.get("nom") or p.get("title") or p.get("name") or p.get("sku") or "Article Barsha"
    ).split('|')[0].strip()
    prix = f"{p.get('prix') or p.get('currentPrice') or p.get('price')} TND"
    ref = p.get("sku") or p.get("reference") or "N/A"
    famille = p.get("genre") or p.get("Famille") or ""

    declinaisons = p.get("declinaisons") or []
    variants_parts = []
    highlighted_img = ""

    for d in declinaisons:
        libellet = str(d.get("couleur") or "").upper()
        did = d.get("id")
        stock_str = stock_map.get(did, "")

        val = libellet
        if stock_str:
            val = f"{val} ({stock_str})" if val else stock_str
        if val:
            variants_parts.append(val)

        if requested_color and libellet == requested_color:
            highlighted_img = p.get("image")

    # Skip products that don't have the requested colour
    if requested_color and variants_parts:
        has_color = any(requested_color in str(v).upper() for v in declinaisons if "couleur" in v)
        if not has_color:
            return None, None

    img_val = local_images.get(str(pid)) or p.get("image") or p.get("firstImg") or ""
    main_img = ensure_abs_url(img_val)

    color_note = (
        f" , COULEUR DEMAND\u00c9E: {requested_color} \u2192 IMG: {highlighted_img}"
        if highlighted_img else ""
    )
    variants_str = ", ".join(variants_parts) if variants_parts else "N/A"

    line = (
        f"- [ID:{pid}] [{ref}] {nom} | {prix} | Famille:{famille} | "
        f"Couleurs+Images: {variants_str}{color_note} | "
        f"ImgPrincipale: {main_img} | "
        f"https://barsha.com.tn/fr/produit/{pid}"
    )

    clean_hit = {
        "id": pid,
        "reference": ref,
        "nom": nom,
        "prix": prix,
        "image": main_img,
        "url": f"https://barsha.com.tn/fr/produit/{pid}",
    }

    return line, clean_hit


# ═══════════════════════════════════════════════════════════════════════════════
# CATALOG SEARCH (grounding for the chatbot)
# ═══════════════════════════════════════════════════════════════════════════════

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_context: Optional[dict] = None
    model: Optional[str] = DEFAULT_MODEL


async def search_barsha_catalog(
    query: str,
    history: List[ChatMessage] = [],
    limit: int = 30,
) -> tuple[str, list]:
    """
    Search the Barsha catalog via Meilisearch with gender/colour/budget filters.
    Returns (formatted_text, clean_hits_list).
    """
    effective_query = query

    # Collect recently mentioned product IDs from conversation
    recent_ids: set = set()
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
    requested_color = detect_color(effective_query)
    requested_budget = detect_budget(effective_query)
    clean_q = clean_search_query(effective_query)

    # Remove colour and budget digits from the textual query sent to Meilisearch
    if requested_color:
        clean_q = re.sub(r'\b' + re.escape(requested_color.lower()) + r'\b', '', clean_q).strip()
    if requested_budget:
        clean_q = re.sub(r'\d+[\.,]?\d*', '', clean_q).strip()
    if not clean_q:
        clean_q = effective_query.lower().split()[0]

    famille_filter = GENRE_TO_FAMILLE.get(requested_gender) if requested_gender else None

    # 1. Fetch recent IDs for context continuity
    recent_hits = []
    if recent_ids:
        ids_str = ", ".join(recent_ids)
        recent_hits = await call_meilisearch("", limit=10, custom_filter=f"id IN [{ids_str}]")

    # 2. Main search with native Meilisearch family filter
    search_hits = await call_meilisearch(clean_q, limit * 5, famille_filter=famille_filter)

    # 2b. Budget post-filter
    if requested_budget and search_hits:
        def _get_price(p):
            try:
                return float(p.get('currentPrice') or p.get('price') or 999999)
            except Exception:
                return 999999
        search_hits = [p for p in search_hits if _get_price(p) <= (requested_budget + 1.0)]

    # 3. Post-filter by gender
    hits = []
    if requested_gender and search_hits:
        filtered = [p for p in search_hits if _gender_filter(p, requested_gender)]
        if filtered:
            hits.extend(filtered)
        else:
            all_hits = await call_meilisearch(clean_q, limit * 2)
            filtered2 = [p for p in all_hits if _gender_filter(p, requested_gender)]
            hits.extend(filtered2)
    elif requested_gender and not search_hits:
        all_hits = await call_meilisearch(clean_q, limit * 2)
        filtered_q = [p for p in all_hits if _gender_filter(p, requested_gender)]
        hits.extend(filtered_q)
    else:
        hits.extend(search_hits)

    # 4. Append recent-IDs context at the end
    if recent_hits:
        hits.extend(recent_hits)

    # Deduplicate
    unique_hits = []
    seen: set = set()
    for h in hits:
        if h.get('id') not in seen:
            seen.add(h.get('id'))
            unique_hits.append(h)
    hits = unique_hits

    # 5. Keyword fallback if still empty
    if not hits and " " in clean_q:
        keywords = clean_q.split()
        for kw in keywords[:2]:
            if len(kw) < 3:
                continue
            fallback = await call_meilisearch(kw, 20)
            filtered_fb = (
                [p for p in fallback if _gender_filter(p, requested_gender)]
                if requested_gender else fallback
            )
            if filtered_fb:
                hits.extend(filtered_fb)
                break

    note = ""
    if not hits:
        raw_fallback = await call_meilisearch("", 40)
        hits = (
            [p for p in raw_fallback if _gender_filter(p, requested_gender)]
            if requested_gender else raw_fallback
        )
        hits = hits[:20]
        note = (
            "NOTE: Je n'ai pas trouv\u00e9 exactement l'article demand\u00e9. "
            "Voici quelques articles phares de notre collection qui pourraient vous plaire :\n"
        )

    # Safety: exclude obviously wrong gender items
    if requested_gender == 'homme':
        hits = [
            p for p in hits
            if not re.search(
                r'\b(robe|jupe|talon|balerine|sac \u00e0 main|escarpin)\b',
                (str(p.get('nom', '')) + " " + str(p.get('category', ''))).lower(),
            )
        ]
    elif requested_gender == 'femme':
        hits = [
            p for p in hits
            if not re.search(
                r'\b(cale\u00e7on|boxer|slip)\b',
                (str(p.get('nom', '')) + " " + str(p.get('category', ''))).lower(),
            )
        ]

    hits = hits[:limit]

    # Fetch stock info for declinaisons
    stock_map: dict = {}
    decl_ids = []
    for p in hits:
        for d in (p.get("declinaisons") or []):
            if d.get("id"):
                decl_ids.append(d.get("id"))
    if decl_ids:
        async with httpx.AsyncClient() as stock_client:
            tasks = [_fetch_stock_for_declinaison(stock_client, did) for did in decl_ids]
            results = await asyncio.gather(*tasks)
            stock_map = {did: v for did, v in results if v}

    # Build formatted lines and clean hits
    lines = []
    clean_hits = []
    seen_ids: set = set()
    for p in hits:
        pid = p.get('id')
        if not pid or pid in seen_ids:
            continue
        seen_ids.add(pid)

        line, clean_hit = format_product_line(
            p, pid, requested_color, stock_map, LOCAL_CATALOG_IMAGES
        )
        if line is None:
            continue
        lines.append(line)
        clean_hits.append(clean_hit)

    return note + "\n".join(lines[:limit]), clean_hits


def scrub_history(messages: List[ChatMessage]) -> List[dict]:
    """Strip system messages; keep user/assistant only."""
    clean = []
    for msg in messages:
        if msg.role == "system":
            continue
        clean.append({"role": msg.role, "content": msg.content})
    return clean


# ═══════════════════════════════════════════════════════════════════════════════
# LLM CALL HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

async def call_ollama_chat(messages: list) -> dict | None:
    """Call local Ollama (Qwen). Returns OpenRouter-compatible dict or None."""
    try:
        payload = {
            "model": OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.3},
        }
        async with httpx.AsyncClient() as client:
            logger.info(f"OLLAMA: attempting {OLLAMA_MODEL}...")
            resp = await client.post(OLLAMA_URL, json=payload, timeout=90.0)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "choices": [{
                        "message": {
                            "role": "assistant",
                            "content": data.get("message", {}).get("content", ""),
                        }
                    }]
                }
            logger.warning(f"OLLAMA: HTTP {resp.status_code}")
            return None
    except Exception as e:
        logger.warning(f"OLLAMA: unavailable ({e})")
        return None


async def call_gemini_native_chat(messages: List[dict], max_tokens: int = 600) -> dict | None:
    """Fallback via Google Gemini REST API."""
    if not GEMINI_API_KEY:
        return None

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
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}"
                f":generateContent?key={GEMINI_API_KEY}"
            )
            payload: dict = {
                "contents": contents,
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": max_tokens,
                },
            }
            if system_instr:
                payload["system_instruction"] = {"parts": [{"text": system_instr}]}

            try:
                logger.info(f"GEMINI REST: trying {model}...")
                resp = await client.post(url, json=payload, timeout=30.0)
                if resp.status_code == 200:
                    data = resp.json()
                    text = data['candidates'][0]['content']['parts'][0]['text']
                    logger.info(f"GEMINI REST: success with {model}")
                    return {"choices": [{"message": {"role": "assistant", "content": text}}]}
                logger.warning(f"GEMINI REST: {model} returned {resp.status_code}")
            except Exception as e:
                logger.warning(f"GEMINI REST: {model} error: {e}")
                continue

    return None


async def call_openrouter_chat(messages: list, model_override: str | None = None) -> dict | None:
    """Fallback via OpenRouter cloud models."""
    if not OPENROUTER_API_KEY:
        return None

    models_to_try = (
        [model_override]
        if model_override and model_override != "openrouter/auto"
        else [
            "mistralai/mistral-7b-instruct:free",
            "google/gemma-3-27b-it:free",
            "meta-llama/llama-3.3-70b-instruct:free",
        ]
    )

    async with httpx.AsyncClient() as client:
        for model_name in models_to_try:
            try:
                logger.info(f"OPENROUTER: trying {model_name}...")
                resp = await client.post(
                    OPENROUTER_URL,
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model_name,
                        "messages": messages,
                        "temperature": 0.3,
                        "max_tokens": 600,
                    },
                    timeout=45.0,
                )
                if resp.status_code == 200:
                    return resp.json()
            except Exception as e:
                logger.warning(f"OPENROUTER: {model_name} error: {e}")
                continue

    return None


# ═══════════════════════════════════════════════════════════════════════════════
# FASTAPI APPLICATION
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Barsha AI Service",
    description="Comprehensive local AI inference service: chat, visual search, recommendations",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Startup ───

@app.on_event("startup")
async def startup_event():
    global CLIP_MODEL, CLIP_PROCESSOR, PRODUCT_IDS, PRODUCT_VECS
    global CATALOG_MAP, LOCAL_CATALOG_IMAGES
    global REC_ENGINE, PREMIUM_ENGINE, NEXTGEN_ENGINE

    logger.info("=== BARSHA AI SERVICE: STARTING ===")
    logger.info(f"Ollama URL  : {OLLAMA_URL}")
    logger.info(f"Ollama Model: {OLLAMA_MODEL}")
    logger.info(f"Gemini Key  : {'SET' if GEMINI_API_KEY else 'NOT SET'}")
    logger.info(f"OpenRouter  : {'SET' if OPENROUTER_API_KEY else 'NOT SET'}")

    # ── Load product catalog ──
    if os.path.exists(CATALOG_PATH):
        try:
            with open(CATALOG_PATH, "r", encoding="utf-8") as f:
                catalog_data = json.load(f)
            CATALOG_MAP = {str(p.get("id")): p for p in catalog_data if p.get("id")}
            LOCAL_CATALOG_IMAGES = {
                str(p.get("id")): p.get("image") or p.get("firstImg") or ""
                for p in catalog_data if p.get("id")
            }
            logger.info(f"Catalog loaded: {len(CATALOG_MAP)} products")
        except Exception as e:
            logger.error(f"Catalog load error: {e}")
    else:
        logger.warning(f"Catalog not found at {CATALOG_PATH}")

    # ── Load CLIP model + vectors ──
    if os.path.exists(VECTORS_PATH):
        try:
            logger.info(f"Loading CLIP model ({VECTOR_MODEL_NAME})...")
            CLIP_MODEL = CLIPModel.from_pretrained(VECTOR_MODEL_NAME).to("cpu")
            CLIP_PROCESSOR = CLIPProcessor.from_pretrained(VECTOR_MODEL_NAME)
            CLIP_MODEL.eval()

            data = torch.load(VECTORS_PATH, weights_only=False, map_location="cpu")
            PRODUCT_IDS = data["ids"]

            embeddings_raw = data["embeddings"]
            if isinstance(embeddings_raw, np.ndarray):
                PRODUCT_VECS = torch.from_numpy(embeddings_raw).float()
            else:
                PRODUCT_VECS = torch.tensor(embeddings_raw).float()

            PRODUCT_VECS = torch.nn.functional.normalize(PRODUCT_VECS, p=2, dim=-1)
            logger.info(f"CLIP ready: {len(PRODUCT_IDS)} products indexed")
        except Exception as e:
            logger.error(f"CLIP load error: {e}")
            CLIP_MODEL = None
            PRODUCT_VECS = None
    else:
        logger.warning(f"Vectors file not found at {VECTORS_PATH}")

    # ── Initialise recommendation engines ──
    try:
        REC_ENGINE = get_recommendation_engine()
        logger.info(f"RecommendationEngine ready: {len(REC_ENGINE.catalog)} products")
    except Exception as e:
        logger.error(f"RecommendationEngine init error: {e}")

    try:
        PREMIUM_ENGINE = PremiumRecommendationEngine()
        logger.info("PremiumRecommendationEngine ready")
    except Exception as e:
        logger.error(f"PremiumRecommendationEngine init error: {e}")

    try:
        NEXTGEN_ENGINE = NextGenRecommendationEngine()
        logger.info("NextGenRecommendationEngine ready")
    except Exception as e:
        logger.error(f"NextGenRecommendationEngine init error: {e}")

    # ── Check Ollama availability ──
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("http://localhost:11434/api/tags", timeout=5.0)
            if resp.status_code == 200:
                models = [m.get("name", "") for m in resp.json().get("models", [])]
                logger.info(f"Ollama available. Models: {models}")
            else:
                logger.warning(f"Ollama responded with {resp.status_code}")
    except Exception:
        logger.warning("Ollama not reachable at startup (will retry on first request)")

    logger.info("=== BARSHA AI SERVICE: READY ===")


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: Health Check
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health_check():
    # Quick Ollama ping
    ollama_ok = False
    try:
        async with httpx.AsyncClient() as c:
            r = await c.get("http://localhost:11434/api/tags", timeout=3.0)
            ollama_ok = r.status_code == 200
    except Exception:
        pass

    return {
        "status": "ok",
        "service": "barsha-ai-service",
        "version": "3.0.0",
        "clip_loaded": CLIP_MODEL is not None,
        "vectors_loaded": PRODUCT_VECS is not None,
        "products_indexed": len(PRODUCT_IDS) if PRODUCT_IDS else 0,
        "catalog_size": len(CATALOG_MAP),
        "ollama_available": ollama_ok,
        "ollama_model": OLLAMA_MODEL,
        "gemini_configured": bool(GEMINI_API_KEY),
        "openrouter_configured": bool(OPENROUTER_API_KEY),
        "recommendation_engine": REC_ENGINE is not None,
        "premium_engine": PREMIUM_ENGINE is not None,
        "nextgen_engine": NEXTGEN_ENGINE is not None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: POST /api/chat
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Main chat endpoint.
    1. Analyse the query and search products in Meilisearch.
    2. Build the full system prompt.
    3. Try Ollama/Qwen (local, primary).
    4. Fallback to Gemini (cloud).
    5. Fallback to OpenRouter (cloud).
    """
    try:
        user_query = request.messages[-1].content if request.messages else ""
        logger.info(f"CHAT: query='{user_query}'")

        # 1. Catalog search
        catalog_subset, raw_hits = await search_barsha_catalog(user_query, request.messages)
        api_messages = scrub_history(request.messages)

        # 2. User context
        ctx = request.user_context or {}
        is_logged = ctx.get("isLoggedIn", False)
        profile = ctx.get("profile", {})

        def _ensure_list(val):
            if isinstance(val, list):
                return val
            if isinstance(val, dict):
                for key in ("data", "orders", "items", "results", "commandes"):
                    inner = val.get(key)
                    if isinstance(inner, list):
                        return inner
                    if isinstance(inner, dict):
                        for sub_key in ("data", "items", "results"):
                            sub = inner.get(sub_key)
                            if isinstance(sub, list):
                                return sub
            return []

        orders_raw = ctx.get("orders", [])
        orders = _ensure_list(orders_raw)
        if not orders and orders_raw:
            logger.warning(
                f"ORDERS: could not extract list. Type={type(orders_raw)}, "
                f"Preview={str(orders_raw)[:200]}"
            )
        coupons = _ensure_list(ctx.get("coupons", []))
        motifs = _ensure_list(ctx.get("motifs", []))
        wishlist = _ensure_list(ctx.get("wishlist", []))

        # ── Format wishlist ──
        wishlist_formatted = []
        for w in wishlist:
            w_prod = w.get("product") or w.get("produit") or w
            pid = w_prod.get("id") or w.get("produit_id") or w.get("productId") or "0"
            nom = (
                w_prod.get("title") or w_prod.get("nom") or w_prod.get("name") or "Article Favori"
            )
            prix_val = w_prod.get("currentPrice") or w_prod.get("prix") or w_prod.get("price") or ""
            prix = (
                f"{prix_val} TND"
                if prix_val and "TND" not in str(prix_val).upper()
                else str(prix_val) if prix_val else "Sur site"
            )
            ref = w_prod.get("sku") or w_prod.get("reference") or "FAV"

            img_obj = (
                w_prod.get("image") or w_prod.get("firstImg")
                or LOCAL_CATALOG_IMAGES.get(str(pid), "")
            )
            if isinstance(img_obj, dict):
                img = img_obj.get("url") or (img_obj.get("medium") or {}).get("url") or ""
            else:
                img = str(img_obj)
            if img and not img.startswith("http"):
                img = f"https://barsha.com.tn/{img.lstrip('/')}"
            if not img:
                img = "https://barsha.com.tn/assets/images/logo.png"

            wishlist_formatted.append(
                f"- [ID:{pid}] [{ref}] {nom} | {prix} | Famille:FAVORI | "
                f"Couleurs+Images: N/A | ImgPrincipale: {img} | "
                f"https://barsha.com.tn/fr/produit/{pid}"
            )
            raw_hits.append({
                "id": pid, "reference": ref, "nom": nom,
                "prix": prix, "image": img,
                "url": f"https://barsha.com.tn/fr/produit/{pid}",
            })

        wishlist_catalog = (
            f"VOICI LA LISTE D\u00c9TAILL\u00c9E DE SES FAVORIS :\n" + "\n".join(wishlist_formatted)
            if wishlist_formatted
            else "Aucun favori enregistr\u00e9."
        )

        # ── Format orders ──
        STATUS_MAP = {
            "pending": "En attente de confirmation",
            "confirmed": "Confirm\u00e9e \u2705",
            "processing": "En pr\u00e9paration \U0001f4e6",
            "shipped": "Exp\u00e9di\u00e9e \U0001f69a",
            "delivered": "Livr\u00e9e \u2705",
            "cancelled": "Annul\u00e9e \u274c",
            "returned": "Retourn\u00e9e \U0001f504",
            "refunded": "Rembours\u00e9e \U0001f4b3",
            "en attente": "En attente de confirmation",
            "valid\u00e9e": "Confirm\u00e9e \u2705",
            "en cours": "En pr\u00e9paration \U0001f4e6",
            "exp\u00e9di\u00e9e": "Exp\u00e9di\u00e9e \U0001f69a",
            "livr\u00e9e": "Livr\u00e9e \u2705",
            "annul\u00e9e": "Annul\u00e9e \u274c",
        }
        orders_formatted = []
        for o in orders:
            ref = (
                o.get("reference") or o.get("ref") or o.get("orderNumber")
                or o.get("order_number") or o.get("id") or "N/A"
            )
            amt = (
                o.get("totalAmount") or o.get("total") or o.get("montant")
                or o.get("amount") or o.get("total_amount") or "?"
            )
            total = f"{amt} TND"
            raw_statut = (
                o.get("status") or o.get("statut") or o.get("etat")
                or o.get("state") or "en cours"
            )
            statut = STATUS_MAP.get(str(raw_statut).lower().strip(), str(raw_statut).capitalize())
            date_raw = (
                o.get("createdAt") or o.get("created_at") or o.get("date")
                or o.get("orderDate") or o.get("order_date") or "Date inconnue"
            )
            date = str(date_raw)[:10] if date_raw and date_raw != "Date inconnue" else "Date inconnue"

            addr_obj = o.get("shippingAddress") or o.get("address") or o.get("adresse") or {}
            if isinstance(addr_obj, dict):
                ville = addr_obj.get("city") or addr_obj.get("ville") or ""
                addr_str = f" | Livraison: {ville}" if ville else ""
            else:
                addr_str = f" | Livraison: {addr_obj}" if addr_obj else ""

            tracking = (
                o.get("trackingNumber") or o.get("tracking")
                or o.get("tracking_number") or o.get("numSuivi") or ""
            )
            tracking_str = f" | N\u00b0 Suivi: {tracking}" if tracking else ""

            items = (
                o.get("items") or o.get("lignes") or o.get("products")
                or o.get("orderItems") or o.get("order_items") or []
            )
            items_str = ""
            if isinstance(items, list) and items:
                item_parts = []
                for it in items[:5]:
                    it_nom = (
                        it.get("name") or it.get("nom") or it.get("title")
                        or it.get("productName") or it.get("product_name")
                        or (it.get("product") or {}).get("nom")
                        or (it.get("product") or {}).get("name") or "Article"
                    )
                    it_qty = it.get("quantity") or it.get("qte") or it.get("qty") or 1
                    it_taille = it.get("size") or it.get("taille") or ""
                    it_couleur = it.get("color") or it.get("couleur") or ""
                    details = "/".join(filter(None, [str(it_taille), str(it_couleur)]))
                    part = f"{it_nom} x{it_qty}"
                    if details:
                        part += f" ({details})"
                    item_parts.append(part)
                if item_parts:
                    items_str = f"\n   Articles: {', '.join(item_parts)}"

            orders_formatted.append(
                f"- Commande #{ref} | Statut: {statut} | Total: {total} | "
                f"Date: {date}{addr_str}{tracking_str}{items_str}"
            )

        if orders_formatted:
            orders_details = (
                f"HISTORIQUE DES COMMANDES DE L'UTILISATEUR ({len(orders_formatted)} commande(s)) :\n"
                + "\n".join(orders_formatted)
            )
        else:
            orders_details = "Aucune commande pass\u00e9e (utilisateur sans historique ou non connect\u00e9)."

        user_info = (
            f"Utilisateur : {profile.get('firstName', 'Invite')} {profile.get('lastName', '')}"
            if is_logged else "Utilisateur GUEST"
        )
        orders_info = f"{len(orders)} commande(s)" if is_logged else "Pas d'historique"
        wishlist_info = f"{len(wishlist)} articles en favoris" if is_logged else "0 favoris"

        social_links = (
            "R\u00e9seaux sociaux : Facebook (https://www.facebook.com/barsha.tunisie), "
            "Instagram (https://www.instagram.com/barsha.tunisie/), "
            "Youtube (https://www.youtube.com/channel/UCOlzEAEfVUcn8sTh5OXV0-Q)"
        )

        # 3. System prompt
        system_prompt = {
            "role": "system",
            "content": f"""Tu es le styliste personnel Barsha, un conseiller mode expert et chaleureux pour la marque de v\u00eatements tunisienne Barsha.

CONTEXTE CLIENT: {user_info} | Commandes: {orders_info} | Favoris: {wishlist_info}
INFOS PRATIQUES: {social_links}

--- CATALOGUE BARSHA (PRODUITS DISPONIBLES) ---
{catalog_subset}

{wishlist_catalog}

{orders_details}

=== TES COMP\u00c9TENCES DE STYLISTE ===

1. CONSEIL PERSONNALIS\u00c9 PAR OCCASION:
   - Entretien/Bureau: Sugg\u00e8re chemises, pantalons classiques, blazers sobres
   - Mariage/Soir\u00e9e: Robes \u00e9l\u00e9gantes, tenues chics, accessoires raffin\u00e9s
   - Casual/Quotidien: T-shirts, jeans, sneakers, pi\u00e8ces confortables
   - \u00c9t\u00e9/Plage: Robes l\u00e9g\u00e8res, shorts, sandales, couleurs vives
   - Hiver: Pulls, manteaux, boots, couches superpos\u00e9es

2. CONSEIL LOOK COMPLET:
   - Quand un client h\u00e9site, propose un ensemble coh\u00e9rent (haut + bas + accessoire)
   - Mentionne les harmonies de couleurs (ex: "Le blanc s'accorde parfaitement avec le marine")
   - Sugg\u00e8re des compl\u00e9ments ("Pour parfaire ce look, je vous conseille...")

3. GESTION DU BUDGET:
   - Si le client mentionne un budget, respecte-le strictement
   - Propose des alternatives si les articles sont au-dessus du budget
   - "Pour ce budget, je vous sugg\u00e8re..." plut\u00f4t que "C'est trop cher"

=== R\u00c8GLES ABSOLUES ===

1. MODE UNIQUEMENT: Refuse poliment tout sujet hors-mode (code, recettes, etc.)

2. COMMANDES: Les infos sont CI-DESSUS. Affiche-les DIRECTEMENT si demand\u00e9. Ne dis JAMAIS que tu n'y as pas acc\u00e8s.

3. GENRE STRICT: Homme \u2192 articles homme UNIQUEMENT. Ne sugg\u00e8re JAMAIS de robes \u00e0 un homme.

4. FAVORIS: Pour ajouter/retirer, dire de cliquer sur le coeur. Pour VOIR, affiche les lignes brutes.

5. STOCKS: Utilise les infos entre parenth\u00e8ses (ex: M:2, L:1). Taille absente = rupture.

6. PRODUITS R\u00c9ELS: Ne propose QUE les produits list\u00e9s ci-dessus.

7. FORMAT STRICT: Copie EXACTEMENT les lignes produit (commen\u00e7ant par - [ID:...)

=== STYLE DE COMMUNICATION ===

- Sois chaleureux mais professionnel
- Utilise "vous" par d\u00e9faut
- Ajoute une touche d'enthousiasme pour les belles pi\u00e8ces
- Termine par une question pour guider ("Qu'en pensez-vous?" / "Souhaitez-vous voir d'autres options?")

--- EXEMPLE DE R\u00c9PONSE PARFAITE ---

J'ai trouv\u00e9 quelques pi\u00e8ces qui correspondent parfaitement \u00e0 votre style :

- [ID:123] [REF456] CHEMISE SLIM FIT | 59.900 TND | Famille:MEN | Couleurs+Images: BLEU | ImgPrincipale: https://... | https://barsha...

Cette chemise se marierait tr\u00e8s bien avec un pantalon chino pour un look smart casual. Souhaitez-vous que je vous sugg\u00e8re un bas assorti ?""",
        }

        final_messages = [system_prompt] + api_messages

        # ── Step A: OLLAMA (LOCAL, PRIMARY) ──
        if not request.model or request.model == "openrouter/auto":
            logger.info("CHAT: trying Ollama (local)...")
            ollama_resp = await call_ollama_chat(final_messages)
            if ollama_resp:
                ollama_resp["catalog_hits"] = raw_hits
                return ollama_resp

        # ── Step B: GEMINI (CLOUD FALLBACK #1) ──
        if GEMINI_API_KEY:
            logger.info("CHAT: trying Gemini (cloud fallback #1)...")
            try:
                gemini_resp = await call_gemini_native_chat(final_messages, max_tokens=600)
                if gemini_resp and "choices" in gemini_resp:
                    gemini_resp["catalog_hits"] = raw_hits
                    return gemini_resp
            except Exception as e:
                logger.warning(f"CHAT: Gemini failed: {e}")

        # ── Step C: OPENROUTER (CLOUD FALLBACK #2) ──
        logger.info("CHAT: trying OpenRouter (cloud fallback #2)...")
        if not OPENROUTER_API_KEY and not GEMINI_API_KEY:
            raise Exception("No API keys configured (Ollama unavailable, no Gemini or OpenRouter key).")

        or_resp = await call_openrouter_chat(final_messages, model_override=request.model)
        if or_resp:
            or_resp["catalog_hits"] = raw_hits
            return or_resp

        raise Exception("No AI model responded.")

    except Exception as err:
        tb = traceback.format_exc()
        logger.error(f"CHAT ERROR:\n{tb}")
        return {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": f"D\u00e9sol\u00e9, j'ai rencontr\u00e9 un probl\u00e8me technique.\n\nErreur : {str(err)}",
                }
            }],
            "debug": tb,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: POST /api/visual-search (CLIP)
# ═══════════════════════════════════════════════════════════════════════════════

class VisualSearchRequest(BaseModel):
    image: str
    limit: Optional[int] = 12


class VisualSearchResult(BaseModel):
    id: int
    nom: str
    prix: float
    currentPrice: float
    image: str
    famille: str
    category: str
    score: float


class VisualSearchResponse(BaseModel):
    method: str
    results: List[VisualSearchResult]
    count: int
    confidence: float
    error: Optional[str] = None


def format_product(product: dict) -> dict:
    """Format a catalog product for the visual search response."""
    price = product.get("currentPrice") or product.get("prix") or 0
    original = product.get("prix") or price
    image = product.get("image") or product.get("firstImg") or ""
    return {
        "id": product.get("id"),
        "nom": product.get("nom", ""),
        "prix": original,
        "currentPrice": price,
        "image": image,
        "famille": product.get("famille", ""),
        "category": product.get("category", ""),
    }


@app.post("/api/visual-search", response_model=VisualSearchResponse)
async def visual_search(request: VisualSearchRequest):
    """
    CLIP-based visual search.
    Accepts a base64-encoded image and returns visually similar products.
    """
    if CLIP_MODEL is None or PRODUCT_VECS is None:
        raise HTTPException(
            status_code=503,
            detail="CLIP engine not available. Ensure product_vectors.pt exists in data/",
        )

    try:
        image_b64 = request.image
        if "," in image_b64:
            image_b64 = image_b64.split(",")[1]

        img_data = base64.b64decode(image_b64)
        query_img = Image.open(BytesIO(img_data)).convert("RGB")

        inputs = CLIP_PROCESSOR(images=query_img, return_tensors="pt")
        with torch.no_grad():
            outputs = CLIP_MODEL.get_image_features(**inputs)
            if not isinstance(outputs, torch.Tensor):
                pooler = getattr(outputs, "pooler_output", None)
                outputs = pooler if pooler is not None else outputs[0]

        query_vec = torch.nn.functional.normalize(outputs, p=2, dim=-1).to("cpu").float()
        cos_scores = torch.matmul(PRODUCT_VECS, query_vec.T).squeeze()

        k = min(25, len(PRODUCT_IDS))
        top_val, top_idx = torch.topk(cos_scores, k=k)

        THRESHOLD = 0.70
        top_score = top_val[0].item()
        ADAPTIVE_GAP = 0.05
        MIN_REQUIRED = max(THRESHOLD, top_score - ADAPTIVE_GAP)

        results = []
        main_group = None

        for i, (score, idx) in enumerate(zip(top_val, top_idx)):
            s_val = score.item()
            if s_val < MIN_REQUIRED and len(results) > 0:
                continue

            pid = str(PRODUCT_IDS[idx.item()])
            if pid not in CATALOG_MAP:
                continue

            product = CATALOG_MAP[pid]
            p_nom = (product.get("nom") or "").upper().replace("\u00c0", "A")

            if i == 0:
                main_group = get_group(p_nom)
            elif main_group and main_group in GROUPS:
                curr_group = get_group(p_nom)
                if curr_group != main_group:
                    continue

            formatted = format_product(product)
            formatted["score"] = round(s_val, 4)
            results.append(VisualSearchResult(**formatted))

            if len(results) >= request.limit:
                break

        # Relaxed fallback
        if not results:
            for i, (score, idx) in enumerate(zip(top_val[: request.limit], top_idx[: request.limit])):
                pid = str(PRODUCT_IDS[idx.item()])
                if pid in CATALOG_MAP:
                    formatted = format_product(CATALOG_MAP[pid])
                    formatted["score"] = round(score.item(), 4)
                    results.append(VisualSearchResult(**formatted))

        method = "clip_vector" if top_score >= THRESHOLD else "clip_vector_relaxed"
        confidence = top_score if results else 0.0

        return VisualSearchResponse(
            method=method,
            results=results,
            count=len(results),
            confidence=round(confidence, 4),
        )

    except Exception as e:
        logger.error(f"Visual search error: {e}")
        raise HTTPException(status_code=500, detail=f"Visual search processing error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: POST /api/like-this (legacy CLIP format)
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/like-this")
async def like_this_compat(request: VisualSearchRequest):
    """
    Legacy compatibility endpoint matching the original /api/like-this format.
    Wraps the visual search and returns in the original response format with
    format_product_line()-style text lines.
    """
    if CLIP_MODEL is None or PRODUCT_VECS is None:
        return {
            "method": "no_model",
            "similaires": [],
            "complements": [],
            "detected": {"title_guess": "AUCUN", "confidence": 0},
            "error": "Moteur CLIP indisponible",
        }

    try:
        search_result = await visual_search(request)

        similaires = []
        for r in search_result.results:
            pid = str(r.id)
            if pid in CATALOG_MAP:
                product = CATALOG_MAP[pid]
                price = product.get("currentPrice") or product.get("prix") or 0
                original = product.get("prix") or price
                discount = ""
                if original and price and original > price:
                    pct = round((1 - price / original) * 100)
                    discount = f" (-{pct}%)"

                image = product.get("image") or product.get("firstImg") or ""
                line = f"[ID:{pid}] {product.get('nom', '')} \u2014 {price:.3f} TND{discount} | {image}"
                similaires.append(line)

        return {
            "method": search_result.method,
            "similaires": similaires,
            "complements": [],
            "detected": {
                "title_guess": "RECHERCHE VISUELLE",
                "famille": "Barsha Catalog",
                "colors": ["Match Visuel"],
                "style_keywords": ["clip"],
                "confidence": search_result.confidence,
            },
        }

    except HTTPException as e:
        return {
            "method": "clip_error",
            "similaires": [],
            "complements": [],
            "detected": {"title_guess": "ERREUR", "confidence": 0},
            "error": str(e.detail),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: GET /api/recommendations/:strategy
# ═══════════════════════════════════════════════════════════════════════════════

def _rec_result_to_dict(rec) -> dict:
    """Convert a RecommendationResult/RecommendationItem to a JSON-safe dict."""
    product = rec.product_data or {}
    return {
        "product_id": rec.product_id,
        "score": round(rec.score, 2),
        "reason": rec.reason,
        "strategy": rec.strategy.value if hasattr(rec.strategy, "value") else str(rec.strategy),
        "product": {
            "id": product.get("id"),
            "nom": product.get("nom", ""),
            "prix": product.get("prix", 0),
            "currentPrice": product.get("currentPrice") or product.get("prix", 0),
            "image": ensure_abs_url(product.get("image") or product.get("firstImg") or ""),
            "famille": product.get("famille") or product.get("Famille", ""),
            "category": product.get("category", ""),
        },
    }


def _rec_response_to_dict(resp) -> dict:
    """Convert a RecommendationResponse/RecommendationSet to a JSON-safe dict."""
    items = []
    # Handle both RecommendationResponse (has .recommendations) and RecommendationSet (has .items)
    recs = getattr(resp, "recommendations", None) or getattr(resp, "items", None) or []
    for r in recs:
        items.append(_rec_result_to_dict(r))

    strategy_val = resp.strategy_used if hasattr(resp, "strategy_used") else getattr(resp, "strategy", "")
    if hasattr(strategy_val, "value"):
        strategy_val = strategy_val.value

    return {
        "strategy": strategy_val,
        "explanation": getattr(resp, "explanation", ""),
        "title": getattr(resp, "title", ""),
        "subtitle": getattr(resp, "subtitle", ""),
        "total_candidates": getattr(resp, "total_candidates", 0),
        "results": items,
        "count": len(items),
    }


@app.get("/api/recommendations/{strategy}")
async def get_recommendations(
    strategy: str,
    product_id: Optional[int] = None,
    user_id: Optional[int] = None,
    limit: int = 8,
    context: Optional[str] = None,
):
    """
    Unified recommendation endpoint.

    Strategies: similar, complementary, trending, new_arrivals,
                personalized, cart_complement, complete_the_look,
                because_you_viewed, smart, etc.

    Query params:
      - product_id : source product for similar/complementary
      - user_id    : user for personalized recommendations
      - limit      : max results (default 8)
      - context    : JSON-encoded extra context (e.g. cart IDs, viewed IDs)
    """
    extra_ctx: dict = {}
    if context:
        try:
            extra_ctx = json.loads(context)
        except Exception:
            pass

    engine = REC_ENGINE
    if engine is None:
        raise HTTPException(status_code=503, detail="Recommendation engine not initialised")

    try:
        if strategy == "similar":
            if not product_id:
                raise HTTPException(status_code=400, detail="product_id required for similar strategy")
            resp = engine.get_similar_products(product_id, limit=limit)

        elif strategy == "complementary":
            if not product_id:
                raise HTTPException(status_code=400, detail="product_id required for complementary strategy")
            resp = engine.get_complementary_products(product_id, limit=limit)

        elif strategy == "trending":
            resp = engine._get_trending_recommendations(limit=limit)

        elif strategy == "personalized":
            user_ctx = extra_ctx if extra_ctx else {"wishlist": [], "orders": []}
            resp = engine.get_personalized_recommendations(user_ctx, limit=limit)

        elif strategy == "recently_viewed":
            viewed_ids = extra_ctx.get("viewed_product_ids", [])
            resp = engine.get_recently_viewed_recommendations(viewed_ids, limit=limit)

        elif strategy == "because_you_viewed":
            viewed_ids = extra_ctx.get("viewed_product_ids", [])
            resp = engine.get_because_you_viewed_recommendations(viewed_ids, limit=limit)

        elif strategy == "cart_complement" or strategy == "cart_based":
            cart_ids = extra_ctx.get("cart_product_ids", [])
            resp = engine.get_cart_based_recommendations(cart_ids, limit=limit)

        elif strategy == "frequently_bought_together":
            if not product_id:
                raise HTTPException(status_code=400, detail="product_id required")
            co_ids = extra_ctx.get("co_purchased_ids", [])
            resp = engine.get_frequently_bought_together(product_id, co_ids, limit=limit)

        elif strategy == "session_based":
            session_ctx = extra_ctx if extra_ctx else {}
            resp = engine.get_session_based_recommendations(session_ctx, limit=limit)

        elif strategy == "smart":
            resp = engine.get_smart_recommendations(
                user_id=user_id,
                current_product_id=product_id,
                cart_product_ids=extra_ctx.get("cart_product_ids", []),
                viewed_product_ids=extra_ctx.get("viewed_product_ids", []),
                wishlist_product_ids=extra_ctx.get("wishlist_product_ids", []),
                limit=limit,
            )

        else:
            # Try premium engine for advanced strategies
            if PREMIUM_ENGINE is not None:
                try:
                    prem_method = getattr(PREMIUM_ENGINE, f"get_{strategy}", None)
                    if prem_method and product_id:
                        resp = prem_method(product_id, limit=limit)
                        return _rec_response_to_dict(resp)
                except Exception:
                    pass

            # Try next-gen engine
            if NEXTGEN_ENGINE is not None:
                try:
                    ng_method = getattr(NEXTGEN_ENGINE, f"get_{strategy}", None)
                    if ng_method and product_id:
                        resp = ng_method(product_id, limit=limit)
                        return _rec_response_to_dict(resp)
                except Exception:
                    pass

            raise HTTPException(
                status_code=400,
                detail=f"Unknown strategy '{strategy}'. "
                       f"Available: similar, complementary, trending, personalized, "
                       f"recently_viewed, because_you_viewed, cart_complement, "
                       f"frequently_bought_together, session_based, smart",
            )

        return _rec_response_to_dict(resp)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Recommendation error ({strategy}): {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# ROOT
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/")
async def root():
    return {
        "status": "Barsha AI Service Online",
        "version": "3.0.0",
        "endpoints": [
            "/health",
            "/api/chat",
            "/api/visual-search",
            "/api/like-this",
            "/api/recommendations/{strategy}",
        ],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_SERVICE_PORT", "8001"))
    logger.info(f"Starting Barsha AI Service on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
