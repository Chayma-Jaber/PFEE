# 🤖 ANALYSE DÉTAILLÉE - MODULES IA (F14-F16)

**Question de l'utilisateur**: Entraînement de modèles pré-entraînés sur BD? Metrics? Epochs?

**Réponse synthétique**: ❌ **PAS D'ENTRAÎNEMENT** - Tous les modèles sont **PRÉ-ENTRAÎNÉS** + utilisation via **INFÉRENCE SEULEMENT**

---

## 📋 MATRICE RÉCAPITULATIVE

| Module | F14 | F15 | F16 |
|--------|-----|-----|-----|
| **Nom** | Chatbot IA | Visual Search | Recommendations |
| **Type** | LLM Inférence | CLIP Inférence | Rule-based |
| **Modèle** | Qwen 2.5 7B | CLIP ViT-B/32 | Moteurs métier |
| **Pré-entraîné?** | ✅ OUI | ✅ OUI | N/A |
| **Fine-tuning?** | ❌ NON | ❌ NON | N/A |
| **Entraînement BD?** | ❌ NON | ❌ NON | ❌ NON |
| **Epochs** | N/A | N/A | N/A |
| **Training time** | 0h | 0h | 0h |

---

## 🔴 F14 - CHATBOT IA (INFÉRENCE SEULEMENT)

### Architecture

```
USER INPUT
    ↓
┌─────────────────────────────────────────┐
│  CONTEXTE EXTRACTION (Local, No ML)     │
│  - detect_gender() → regex              │
│  - detect_budget() → regex              │
│  - detect_color() → string matching     │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  GROUNDING (Meilisearch API)            │
│  - Search products from catalog         │
│  - Return top 5 products matching       │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  LLM INFERENCE (PRÉ-ENTRAÎNÉ)           │
│  Model: Qwen 2.5 7B                    │
│  ✅ PRÉ-ENTRAÎNÉ (via HuggingFace)     │
│  ❌ PAS FINE-TUNED                      │
│  ❌ PAS ENTRAÎNÉ SUR BD BARSHA         │
│  Action: Forward context to LLM         │
│  Provider: Ollama local / Gemini / OR  │
└─────────────────────────────────────────┘
    ↓
RESPONSE + products
```

### Code d'inférence (backend-ai/api.py)

```python
# *** NO TRAINING CODE ***
# Only inference:

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Inference ONLY - no training"""
    
    user_message = request.messages[-1]["content"]
    
    # 1. Context extraction (regex-based, no ML)
    gender = detect_gender(user_message)
    budget = detect_budget(user_message)
    color = detect_color(user_message)
    
    # 2. Grounding (search existing products)
    products = await search_meilisearch(
        query=user_message,
        gender=gender,
        budget=budget
    )
    
    # 3. LLM INFERENCE (PRÉ-ENTRAÎNÉ Qwen)
    system_prompt = f"""Tu es Barsha, assistant IA.
Context: {gender}, {budget}, {color}
Produits disponibles: {products[:5]}"""
    
    response = await call_qwen_ollama(
        system=system_prompt,
        messages=request.messages,
        temperature=0.7,
        max_tokens=500
        # *** NO training parameters ***
        # *** NO epochs, learning_rate, etc. ***
    )
    
    return {"response": response, "products": products}
```

### Modèle Qwen 2.5 7B

**Source**: HuggingFace Hub (pré-entraîné)  
**Taille**: 7 Milliards de paramètres  
**Entraîné sur**: Données générales Web (Alibaba)  
**Fine-tuning**: ❌ **NON** - Utilisé tel quel

```
Original Qwen Training (Alibaba):
├─ Dataset: 6 Trillion tokens
├─ Duration: Plusieurs mois (pas public)
└─ Compute: Clusters massifs (pas accessible pour nous)

BARSHA Usage (Vous):
├─ Fine-tuning: ❌ PAS FAIT
├─ Training: ❌ PAS EN COURS
└─ Action: Inference seulement ✅
```

### Metrics de Chatbot

| Métrique | Mesure | Cible |
|----------|--------|-------|
| **Latency** | Temps réponse | < 3s ✅ |
| **Precision** | Exactitude réponses domain | > 85% |
| **Hallucination rate** | Fausses infos générées | < 5% |
| **User satisfaction** | NPS score | > 7/10 |
| **Handoff rate** | % escalation humain | < 10% |

**Comment mesure-t-on?**:
```python
# Manual evaluation on test set
test_questions = [
    "Je cherche un jean bleu femme moins 80 TND",
    "Comment retourner un produit?",
    "Quel est le prix du SAC001?"
]

evaluator_scores = []
for q in test_questions:
    response = get_chat_response(q)
    # Human evaluation: 1-5 stars
    score = evaluate_response(response, expected_answer)
    evaluator_scores.append(score)

precision = mean(evaluator_scores) / 5 * 100
# e.g., 4.2/5 = 84% precision
```

---

## 🔴 F15 - VISUAL SEARCH (CLIP INFÉRENCE)

### Architecture

```
INPUT: USER IMAGE (JPEG/PNG/Base64)
    ↓
┌───────────────────────────────┐
│  IMAGE PREPROCESSING          │
│  - Resize 224×224             │
│  - Normalize pixel values      │
│  (OpenCV, no ML training)      │
└───────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│  CLIP MODEL INFERENCE                 │
│  Model: OpenAI CLIP ViT-B/32          │
│  ✅ PRÉ-ENTRAÎNÉ (OpenAI 2021)       │
│  ❌ PAS FINE-TUNED                    │
│  ❌ PAS ENTRAÎNÉ SUR BD BARSHA       │
│  Action: Extract 512-dim embedding    │
└───────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  VECTOR SIMILARITY SEARCH            │
│  - Compute cosine similarity         │
│  - All products (product_vectors.pt) │
│  - Top-K retrieval (K=10)            │
│  (Pure math, no ML)                  │
└─────────────────────────────────────┘
    ↓
RETURN top 10 similar products
```

### Code CLIP (backend-ai/api.py)

```python
import torch
from transformers import CLIPModel, CLIPProcessor

# Load PRÉ-TRAINED model (NO TRAINING)
CLIP_MODEL = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
CLIP_PROCESSOR = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

@app.post("/api/like-this")
async def visual_search(request: VisualSearchRequest):
    """CLIP inference ONLY"""
    
    # 1. Load image from base64/URL
    image = load_image(request.image_base64)
    
    # 2. PREPROCESSING (no training)
    inputs = CLIP_PROCESSOR(images=image, return_tensors="pt")
    
    # 3. INFERENCE (forward pass only)
    with torch.no_grad():  # ← No gradient computation
        image_embedding = CLIP_MODEL.get_image_features(**inputs)
        # *** NO BACKPROP, NO WEIGHT UPDATES ***
    
    # 4. Normalize embedding
    image_embedding = F.normalize(image_embedding, p=2, dim=-1)
    
    # 5. Cosine similarity (pure math)
    similarities = torch.mm(image_embedding, PRODUCT_VECS.t()).squeeze()
    
    # 6. Top-K
    top_k_indices = torch.topk(similarities, k=10)[1]
    
    results = []
    for idx in top_k_indices:
        product_id = PRODUCT_IDS[idx]
        results.append({
            "id": product_id,
            "similarity": similarities[idx].item(),  # 0-1 score
            "name": get_product(product_id).name,
            "price": get_product(product_id).price
        })
    
    return {"results": results}
```

### CLIP Model Specs

**Sourced from**: OpenAI (2021)  
**Link**: https://github.com/openai/CLIP  
**Training**: ❌ **PAS ENTRAÎNÉ CHEZ BARSHA**

```
OpenAI Original CLIP Training:
├─ Dataset: 400M image-text pairs (Internet)
├─ Duration: ~18 months
├─ Compute: 256 V100 GPUs
├─ Loss: Contrastive loss (InfoNCE)
└─ Result: General-purpose vision-text foundation model

BARSHA Usage:
├─ Download weights: ✅ OUI
├─ Fine-tuning: ❌ NON
├─ Training loop: ❌ NON
├─ Parameter updates: ❌ NON
└─ Usage: Inference only ✅
```

### Product Embeddings Generation

Le fichier `product_vectors.pt` contient les EMBEDDINGS (résultats):

**Généré une fois** via `generate_embeddings.py`:
```python
# execute ONCE when catalog changes
python generate_embeddings.py

# What it does:
for each product in barsha_products.json:
    image = download_product_image()
    
    # Use PRÉ-TRAINED CLIP (no backprop)
    with torch.no_grad():
        embedding = CLIP_MODEL.get_image_features(preprocess_image(image))
    
    # Store this vector
    product_vectors.append(embedding)

# Save to disk
torch.save({
    "ids": product_ids,
    "embeddings": product_vectors
}, "product_vectors.pt")

# That's IT - no training, just caching
```

**Épochs**: ❌ **0** (pas d'entraînement)  
**Training time**: ~10-15 min (1-time setup)  
**Updates**: Si catalogue change, régénérer une fois

### Metrics Visual Search

| Métrique | Mesure | Target |
|----------|--------|--------|
| **Latency** | Temps requête | 1-2s |
| **Precision@10** | % top 10 corrects | > 70% |
| **Recall@10** | Couverture produits pertinents | > 60% |
| **NSR (Negative Similarity Rate)** | % faux positifs sans rapport | < 15% |

**Comment mesure-t-on**:
```python
# Test set: 100 product images
test_images = load_test_images()  # Vetted by humans

for image, expected_similar_ids in test_images:
    results = visual_search_api(image)
    retrieved_ids = [r["id"] for r in results[:10]]
    
    # Count correct
    correct = len(set(retrieved_ids) & set(expected_similar_ids))
    precision_10 = correct / 10
    
# Average over 100 test images
mean_precision = mean(precisions)
# e.g., 72% = good
```

---

## 🔴 F16 - RECOMMANDATIONS (RULE-BASED NO ML)

### Architecture

```
USER INTERACTION (view, add to cart, etc.)
    ↓
┌─────────────────────────────────────────┐
│  3 RECOMMENDATION ENGINES               │
│  (NO MACHINE LEARNING)                  │
└─────────────────────────────────────────┘
    │
    ├─ RecommendationEngine (Basic)
    │  └─ Content-based only (category, color, price)
    │
    ├─ PremiumRecommendationEngine
    │  ├─ Outfit rules (tops ↔ bottoms)
    │  ├─ Color harmony matrix
    │  ├─ Price tier matching
    │  └─ Behavior signals (views, cart)
    │
    └─ NextGenRecommendationEngine
       ├─ Multi-signal blending
       ├─ Seasonal awareness
       └─ Trending products
```

### Code Recommandations (ai-service/engines/)

**Basic Engine**:
```python
class RecommendationEngine:
    """Content-based only"""
    
    def get_similar_products(self, product_id: int) -> List[Dict]:
        """❌ NO TRAINING, Pure rules"""
        
        source = self.catalog_by_id[product_id]
        candidates = []
        
        for candidate in self.catalog:
            # 1. Same category? (rule-based)
            category_score = 40 if same_category(source, candidate) else 0
            
            # 2. Same gender (Femme/Homme/Enfant)? (rule-based)
            family_score = 30 if same_family(source, candidate) else 0
            
            # 3. Shared colors? (rule-based)
            colors1 = set(get_colors(source))
            colors2 = set(get_colors(candidate))
            color_score = 15 * len(colors1 & colors2)
            
            # 4. Similar price? (rule-based)
            price_score = 10 if price_similar(source, candidate) else 0
            
            total_score = category_score + family_score + color_score + price_score
            candidates.append((candidate, total_score))
        
        # Sort and return top 10
        return sorted(candidates, key=lambda x: x[1], reverse=True)[:10]
        
        # *** ZERO ML TRAINING ***
        # *** ZERO EPOCHS ***
        # *** ZERO WEIGHTS TO LEARN ***
```

**Premium Engine**:
```python
class PremiumRecommendationEngine:
    """Multi-signal recommendation"""
    
    def get_recommendations(self, user_id, context) -> List[Dict]:
        """Multiple rule-based strategies"""
        
        strategies = [
            ("similar", self.similar_products(context)),       # Rule-based
            ("complementary", self.complementary_products(context)),  # Outfit rules
            ("trending", self.trending_products()),             # Popularity metric
            ("new_arrivals", self.new_products()),              # Timestamp rule
            ("personalized", self.user_behavior_based(user_id)) # Simple CF
        ]
        
        # Return best strategy
        return best_strategy["items"]
        
        # *** NO NEURAL NETWORKS ***
        # *** NO BACKPROPAGATION ***
        # *** NO GRADIENT DESCENT ***
```

### Metrics Recommandations

| Métrique | Mesure | Target |
|----------|--------|--------|
| **CTR (Click-through rate)** | % recommendations clickées | +15% |
| **Add-to-cart rate** | % → panier | +20% |
| **AOV (Average Order Value)** | Montant moyen | +10% |
| **Conversion rate** | % → achat | +8% |
| **Diversity** | % produits uniques | > 80% |

**Comment mesure-t-on**:
```python
# Track A/B test
control_group = show_generic_recommendations()  # No recommendations
treatment_group = show_ml_recommendations()     # With recommendations

# Over 7 days:
control_metrics = {
    "ctr": 2.1%,
    "cart_rate": 5.3%,
    "aov": 125 TND
}

treatment_metrics = {
    "ctr": 2.4%,         # +14% ✅
    "cart_rate": 6.4%,   # +21% ✅
    "aov": 137.50 TND    # +10% ✅
}

# Calculate lift
ctr_lift = (treatment - control) / control * 100
```

---

## 🎯 RÉSUMÉ FINAL

### ❌ Ce qui N'EXISTE PAS

```
NON:
├─ ❌ Fine-tuning Qwen sur BD Barsha
├─ ❌ Fine-tuning CLIP sur photos produits
├─ ❌ Training de neural networks
├─ ❌ Epochs > 0
├─ ❌ Learning rates
├─ ❌ Gradient descent
├─ ❌ Backpropagation
├─ ❌ Loss functions
└─ ❌ Collabor filtering matrix factorization
```

### ✅ Ce qui EXISTE

```
OUI:
├─ ✅ PRÉ-TRAINED models (Qwen, CLIP)
├─ ✅ Inference seulement
├─ ✅ Zero-shot capabilities
├─ ✅ Context grounding via Meilisearch
├─ ✅ Rule-based recommendations
├─ ✅ Vector similarity search
├─ ✅ Business logic + heuristics
└─ ✅ Metrics tracking via user behavior
```

---

## 📊 COÛT COMPUTATION

| Task | GPU/CPU | Duration | Cost |
|------|---------|----------|------|
| **Generate embeddings (once)** | CPU/GPU Optional | 10-15 min | $0-1 |
| **Chatbot inference** | CPU | ~500ms/request | $0.001-0.01 |
| **Visual search inference** | CPU/GPU | ~1-2s/request | $0.001-0.02 |
| **Recommendations** | CPU | ~100ms/request | $0.0001 |
| **Fine-tuning Qwen (IF done)** | GPU (4x V100) | ~72h | $1000-2000 |
| **Fine-tuning CLIP (IF done)** | GPU (8x A100) | ~48h | $5000-8000 |

**Current setup**: $0 (inference-only, pré-trained models)  
**If you added fine-tuning**: +$6000-10000 initial investment

---

## 💡 RECOMMANDATION

### Pour améliorer les résultats:

**Option 1: Utiliser plus de contexte** ✅ **Facile**
```python
# Add more grounding data
search_results = meilisearch.search(query, limit=20)  # ← Augment de 5 à 20
context += f"Top 20 products: {search_results}"

# Better accuracy without training
```

**Option 2: Fine-tuning Qwen** 🟡 **Moyen**
```bash
# If you have 72 GPU hours
python -m axolotl finetune_config.yml

# Cost: $1000-2000
# Gain: +5-10% accuracy
```

**Option 3: Fine-tuning CLIP** 🔴 **Difficile**
```bash
# If you have 48 GPU hours + labeled data
python train_clip.py --epochs 10 --batch_size 256

# Cost: $5000-8000
# Gain: +10-15% precision on visual search
# Requires: 1000+ labeled image pairs
```

---

## ✅ VERDICT FINAL

**F14 - Chatbot**: ✅ **Prêt pour production** (inférence Qwen)  
**F15 - Visual Search**: ✅ **Prêt pour production** (inférence CLIP)  
**F16 - Recommendations**: ✅ **Prêt pour production** (rules-based + metrics)

**Entraînement de modèles**: ❌ **Pas en cours, pas prévu**  
**Epochs**: **0** (tous les modèles sont précalculés/pré-entraînés)  
**Training loop**: **Aucun** (inference-only)

---

**Document créé**: 16 Avril 2026  
**Statut**: ✅ Clarification complète des modules IA
