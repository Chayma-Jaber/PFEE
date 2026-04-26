# Barsha AI Architecture Documentation

## Executive Summary

The Barsha E-Commerce platform integrates three AI-powered features that enhance the shopping experience:

1. **AI Shopping Assistant** - Intelligent chatbot with catalog awareness
2. **AI Recommendations** - Explainable product recommendations
3. **Visual Search** - Image-based product discovery using CLIP

---

## 1. AI Shopping Assistant (F14)

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   /api/chat     │────▶│   LLM Provider  │
│   Angular       │     │   FastAPI       │     │   (Ollama/OR)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   Meilisearch   │
                        │   Product Index │
                        └─────────────────┘
```

### Key Features

| Feature | Implementation |
|---------|----------------|
| **Catalog Grounding** | All product suggestions come from real catalog |
| **Gender Awareness** | Detects homme/femme/enfant and filters appropriately |
| **Color Detection** | Recognizes 25+ color terms in French |
| **Budget Parsing** | Extracts price constraints (ex: "moins de 60 TND") |
| **User Context** | Loads orders, wishlist, coupons when logged in |
| **Multi-LLM Fallback** | Ollama → OpenRouter → Gemini cascade |

### Request Flow

1. User sends message
2. Backend detects intent (product search, order tracking, general help)
3. If product search:
   - Extract gender, color, budget constraints
   - Query Meilisearch with semantic expansion
   - Post-filter by constraints
   - Format products for LLM context
4. Build system prompt with user context + products
5. Call LLM for natural response
6. Return response + product cards

### Code Reference

- **Backend**: `api.py` lines 644-896
- **Frontend**: `chatbot.component.ts`, `chatbot.service.ts`

---

## 2. AI Recommendations (F13, F15)

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Recommendation Engine                        │
├─────────────────┬─────────────────┬─────────────────┬──────────┤
│    Similar      │  Complementary  │  Personalized   │ Trending │
│  (same style)   │ (outfit logic)  │ (user prefs)    │(fallback)│
└─────────────────┴─────────────────┴─────────────────┴──────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Product Catalog│
                    │  (JSON + Index) │
                    └─────────────────┘
```

### Recommendation Strategies

#### 1. Similar Products
- **Algorithm**: Category matching + Family matching + Color overlap + Price similarity
- **Use Case**: "Articles similaires" on product detail page
- **Scoring**:
  - Same category: +40 points
  - Same family: +30 points
  - Shared color: +15 points each
  - Similar price (±20%): +10 points

#### 2. Complementary Products (Outfit Logic)
- **Algorithm**: Cross-category rules + Color harmony
- **Use Case**: "Complétez votre look"
- **Rules**:
  ```
  TOPS → BOTTOMS, OUTERWEAR, BAGS, ACCESSORIES
  BOTTOMS → TOPS, OUTERWEAR, FOOTWEAR, BAGS
  DRESSES → OUTERWEAR, FOOTWEAR, BAGS, ACCESSORIES
  FOOTWEAR → BOTTOMS, DRESSES, BAGS
  ```
- **Color Harmony**: Uses fashion color wheel (NOIR+BLANC, BLEU+BEIGE, etc.)

#### 3. Personalized Recommendations
- **Algorithm**: Similarity to wishlist/order history
- **Data Sources**: Wishlist items, Order history
- **Fallback**: Trending products if no history

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recommendations/similar/{id}` | GET | Similar products |
| `/api/recommendations/complementary/{id}` | GET | Outfit suggestions |
| `/api/recommendations/personalized` | POST | Personalized picks |
| `/api/recommendations/trending` | GET | Fallback trending |

### Response Format

```json
{
  "success": true,
  "strategy": "similar",
  "explanation": "Articles avec le même style que T-SHIRT COTON",
  "products": [
    {
      "id": 123,
      "nom": "T-SHIRT BASIQUE",
      "prix": "29.900 TND",
      "image": "https://...",
      "score": 85.0,
      "reason": "même catégorie (tops) • même collection • couleur commune: NOIR"
    }
  ],
  "total_candidates": 45
}
```

### Code Reference

- **Engine**: `app/services/recommendation_engine.py`
- **Router**: `app/routers/recommendations.py`
- **Frontend**: `ai-recommendations.service.ts`, `ai-recommendations.component.ts`

---

## 3. Visual Search (F16)

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User Image  │────▶│  CLIP Model  │────▶│ Vector Store │
│  (Base64)    │     │ (Local/GPU)  │     │ (PyTorch)    │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                            ┌────────────────────┘
                            ▼
                     ┌──────────────┐     ┌──────────────┐
                     │ Cosine       │────▶│ Top-K        │
                     │ Similarity   │     │ Products     │
                     └──────────────┘     └──────────────┘
```

### Implementation

| Component | Technology | Details |
|-----------|------------|---------|
| **Model** | CLIP ViT-B/32 | OpenAI's pre-trained vision-language model |
| **Embeddings** | `product_vectors.pt` | 512-dim vectors for 700+ products |
| **Matching** | Cosine Similarity | Normalized dot product |
| **Threshold** | 0.70+ | Adaptive gap filtering for precision |

### Search Process

1. **Image Upload**: Base64-encoded image from frontend
2. **Encoding**: CLIP processor generates image embedding
3. **Similarity Search**: Cosine similarity against all product vectors
4. **Filtering**:
   - Threshold: Score ≥ 0.70
   - Semantic grouping (bags with bags, tops with tops)
   - Adaptive gap (top_score - 0.05)
5. **Fallback**: If CLIP fails, use Vision LLM for attribute extraction

### Fallback Chain

```
CLIP Local → Vision LLM (OpenRouter) → Vision LLM (Gemini) → Survival Mode
```

### Code Reference

- **Backend**: `api.py` lines 1252-1460
- **Frontend**: `visual-search.component.ts`, `visual-search.service.ts`

---

## 4. Technical Stack

### Backend (Python/FastAPI)

```
backend-ai/
├── api.py                    # Main API (AI + Admin integration)
├── app/
│   ├── services/
│   │   └── recommendation_engine.py  # Recommendation logic
│   └── routers/
│       └── recommendations.py        # Recommendation endpoints
├── data/
│   ├── barsha_products.json   # Product catalog (700+ items)
│   ├── barsha_stores.json     # Store locations
│   └── product_vectors.pt     # CLIP embeddings (trained)
└── tests/
    └── test_ai_modules.py     # AI tests + evaluation scenarios
```

### Frontend (Angular 19)

```
src/app/
├── components/commun/
│   ├── chatbot/              # AI Assistant UI
│   ├── visual-search/        # Image upload + results
│   └── ai-recommendations/   # Recommendation cards
└── services/
    ├── chatbot.service.ts
    ├── visual-search.service.ts
    └── ai-recommendations.service.ts
```

---

## 5. Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Chat Response | ~2-5s | Depends on LLM provider |
| Visual Search (CLIP) | ~500ms | Local vector search |
| Visual Search (LLM) | ~3-8s | Fallback with vision model |
| Recommendations | ~100ms | Local computation |
| Products Indexed | 700+ | With CLIP embeddings |

---

## 6. Evaluation Scenarios

### Assistant Evaluation

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| AS01 | "chemise pour homme" | Returns only men's shirts |
| AS02 | "robe à moins de 80 TND" | Budget-filtered dresses |
| AS03 | "pantalon noir femme" | Color + gender filtered |
| AS04 | "tenue pour entretien" | Professional outfit suggestions |
| AS05 | "où est ma commande?" | Shows order status if logged in |

### Recommendation Evaluation

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| RC01 | Similar to T-shirt | Other T-shirts, same gender |
| RC02 | Complement to pants | Tops, belts, shoes |
| RC03 | Personalized (with wishlist) | Based on liked items |

### Visual Search Evaluation

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| VS01 | T-shirt photo | Returns similar T-shirts |
| VS02 | Bag photo | Returns similar bags |
| VS03 | Blurry image | Graceful fallback |

---

## 7. Security Considerations

- **No PII in Prompts**: User data is summarized, not sent raw
- **Rate Limiting**: Implicit via LLM provider limits
- **Input Validation**: Pydantic schemas for all requests
- **Fallback Safety**: Graceful degradation when services fail

---

## 8. Future Enhancements

1. **Real-time Personalization**: Track browse behavior for live recommendations
2. **Collaborative Filtering**: "Customers who bought X also bought Y"
3. **Visual Search Enhancement**: Multi-image queries, crop detection
4. **Voice Integration**: Voice-to-text for hands-free shopping

---

**Document Version**: 2.0
**Last Updated**: 2026-04-11
**Author**: Barsha PFE Team
