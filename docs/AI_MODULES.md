# Modules Intelligence Artificielle - Documentation Technique

## Vue d'Ensemble

Le projet Barsha intègre trois modules IA distincts qui apportent une valeur ajoutée mesurable à l'expérience e-commerce.

---

## 1. Assistant Conversationnel Barsha

### Description
Chatbot intelligent basé sur un Large Language Model (LLM) capable d'accompagner les clients dans leur parcours d'achat.

### Technologie
- **Modèle**: Google Gemini Pro
- **Framework**: API REST via google-generativeai
- **Contexte**: Catalogue produits + historique utilisateur

### Fonctionnalités
| Fonctionnalité | Description |
|----------------|-------------|
| Conseil mode | Recommandations style personnalisées |
| Recherche produit | Comprend intentions et trouve produits |
| Outfit building | Aide à composer des tenues |
| FAQ dynamique | Répond aux questions sur produits |
| Contexte utilisateur | Utilise panier, wishlist, historique |

### Architecture
```
User Message
    │
    ▼
┌─────────────────────┐
│  Context Builder    │ ◄── User Profile, Cart, Wishlist
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  System Prompt      │ ◄── Fashion Expert Persona
│  + Product Catalog  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Gemini LLM API     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Response Parser    │ ──► Product Cards (if mentioned)
└─────────────────────┘
```

### Prompt Engineering
Le system prompt définit:
- Persona: Conseillère mode experte Barsha
- Ton: Professionnel, chaleureux, expert
- Contraintes: Français, produits Barsha uniquement
- Format: Markdown avec références produits

### Métriques de Performance
| Métrique | Définition | Cible |
|----------|------------|-------|
| Sessions | Ouvertures du chatbot | Croissance |
| Messages/Session | Engagement utilisateur | > 3 |
| Product Clicks | Clics sur produits suggérés | > 10% |
| Add to Cart Rate | Conversions depuis assistant | > 2% |

---

## 2. Moteur de Recommandation

### Description
Système de recommandation hybride combinant embeddings visuels et règles métier pour suggérer des produits pertinents.

### Technologie
- **Modèle**: CLIP (Contrastive Language-Image Pre-training)
- **Similarité**: Cosine similarity sur embeddings 512D
- **Framework**: PyTorch + Transformers

### Types de Recommandations

#### 2.1 Produits Similaires
```python
# Algorithme simplifié
similar = find_nearest_neighbors(
    product_embedding,
    catalog_embeddings,
    k=8,
    same_category=True
)
```

**Critères:**
- Même catégorie ou catégorie proche
- Similarité visuelle élevée (cosine > 0.7)
- Exclut le produit source

#### 2.2 Produits Complémentaires
```python
# Règles cross-category
COMPLEMENT_RULES = {
    "Robes": ["Accessoires", "Chaussures", "Sacs"],
    "Pantalons": ["Hauts", "Chaussures"],
    "Hauts": ["Pantalons", "Jupes", "Accessoires"]
}
```

**Critères:**
- Catégorie différente mais complémentaire
- Cohérence de style (casual, formal, etc.)
- Prix comparable (évite écarts extrêmes)

#### 2.3 Recommandations Personnalisées
```python
# Basé sur comportement
personalized = combine(
    recently_viewed(user_id),
    category_affinity(user_id),
    trending_in_preferences(user_id)
)
```

**Sources:**
- Historique de navigation
- Catégories consultées
- Produits ajoutés au panier/wishlist

#### 2.4 Tendances
```python
# Score de popularité
score = views * 1 + clicks * 2 + add_to_cart * 5 + purchases * 10
trending = top_n_by_score(products, n=20, days=7)
```

### Métriques de Performance
| Métrique | Définition | Cible |
|----------|------------|-------|
| Impression Rate | Vues des recommandations | 100% PDP |
| CTR (Click-Through) | Clics / Impressions | > 5% |
| Cart Rate | Add to cart / Impressions | > 1% |
| Relevance Score | Évaluation manuelle | > 80% |

---

## 3. Recherche Visuelle

### Description
Permet aux utilisateurs de trouver des produits en uploadant une image de référence.

### Technologie
- **Modèle**: CLIP ViT-B/32
- **Processing**: PIL pour images, base64 encoding
- **Matching**: Nearest neighbors sur embeddings

### Pipeline
```
Image Upload (base64)
        │
        ▼
┌─────────────────────┐
│  Image Validation   │ ◄── Size, format, quality check
└─────────┬───────────┘
        │
        ▼
┌─────────────────────┐
│  CLIP Preprocessing │ ◄── Resize 224x224, normalize
└─────────┬───────────┘
        │
        ▼
┌─────────────────────┐
│  Feature Extraction │ ──► 512D embedding vector
└─────────┬───────────┘
        │
        ▼
┌─────────────────────┐
│  Similarity Search  │ ◄── Catalog embeddings (pre-computed)
└─────────┬───────────┘
        │
        ▼
┌─────────────────────┐
│  Result Ranking     │ ──► Top-K similar + complements
└─────────────────────┘
```

### Category Detection
```python
# Détection automatique de catégorie
FASHION_CATEGORIES = {
    "dress": ["robe", "dress", "gown"],
    "top": ["shirt", "blouse", "t-shirt"],
    "bottom": ["pants", "jeans", "skirt"],
    # ...
}

detected_category = classify_image(image_embedding, category_prototypes)
```

### Métriques de Performance
| Métrique | Définition | Cible |
|----------|------------|-------|
| Upload Count | Recherches visuelles | Croissance |
| Result Click Rate | Clics sur résultats / Uploads | > 30% |
| Category Accuracy | Détection correcte | > 85% |
| Visual Relevance | Top-5 pertinence | > 70% |

---

## Évaluation et Validation

### Framework de Test
Voir `tests/test_ai_evaluation.py` pour les scénarios de test complets.

### Scénarios Clés Testés

**Assistant:**
- Shopping par occasion
- Shopping par budget
- Conseil couleur/style
- Aide à la décision
- Construction d'outfit

**Recommandations:**
- Similarité catégorie
- Cohérence complémentaires
- Personnalisation comportement
- Fallback gracieux

**Recherche Visuelle:**
- Détection catégorie
- Similarité visuelle
- Robustesse images imparfaites
- Suggestions cross-category

---

## Limitations Connues

1. **Assistant**: Dépend de la disponibilité API Gemini
2. **Recommandations**: Qualité liée aux embeddings pré-calculés
3. **Recherche Visuelle**: Performance réduite sur images très différentes du catalogue
4. **Cold Start**: Recommandations personnalisées limitées pour nouveaux utilisateurs

---

## Améliorations Futures

1. Fine-tuning CLIP sur le catalogue Barsha
2. Modèle de recommandation collaborative (user-user similarity)
3. A/B testing framework pour optimisation
4. Multi-modal search (texte + image)
5. Assistant vocal
