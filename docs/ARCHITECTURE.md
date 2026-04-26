# Architecture Technique - Barsha E-Commerce Intelligent

## Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Angular 19)                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐│
│  │  Shop/PDP   │ │  Checkout   │ │   Account   │ │   Admin Dashboard   ││
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────────┬──────────┘│
│         │               │               │                    │          │
│  ┌──────┴───────────────┴───────────────┴────────────────────┴────────┐ │
│  │                     Services Layer (Angular)                       │ │
│  │  ChatService │ RecommendationService │ AnalyticsService │ CartSvc  │ │
│  └──────────────────────────────────────────────────────────────────┬─┘ │
└─────────────────────────────────────────────────────────────────────┼───┘
                                                                      │
                              HTTP/REST API                           │
                                                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       BACKEND AI (FastAPI)                              │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                         API Layer                                   ││
│  │  /api/chat │ /api/recommendations │ /api/like-this │ /api/analytics ││
│  └──────┬─────────────────┬─────────────────┬─────────────────┬────────┘│
│         │                 │                 │                 │         │
│  ┌──────┴──────┐   ┌──────┴──────┐   ┌──────┴──────┐   ┌──────┴───────┐ │
│  │  Chatbot    │   │Recommendation│   │  Visual     │   │  Analytics   │ │
│  │  Service    │   │   Engine     │   │  Search     │   │   Service    │ │
│  │  (Gemini)   │   │  (CLIP+AI)   │   │  (CLIP)     │   │  (Tracking)  │ │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬───────┘ │
│         │                 │                 │                 │         │
│  ┌──────┴─────────────────┴─────────────────┴─────────────────┴───────┐ │
│  │                       Core Services                                │ │
│  │  Security │ Config │ Database │ External APIs (Meilisearch)        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐  │
│  │   SQLite/       │    │   Meilisearch   │    │   Product Catalog   │  │
│  │   PostgreSQL    │    │   (Search API)  │    │   (JSON + Vectors)  │  │
│  │   (Analytics)   │    │                 │    │                     │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Stack Technologique

### Frontend
| Technologie | Version | Utilisation |
|-------------|---------|-------------|
| Angular | 19.x | Framework SPA |
| TypeScript | 5.x | Langage de programmation |
| SCSS | - | Styles avec design premium |
| RxJS | 7.x | Programmation réactive |

### Backend AI
| Technologie | Version | Utilisation |
|-------------|---------|-------------|
| FastAPI | 0.109+ | Framework API REST |
| Python | 3.11+ | Langage backend |
| SQLAlchemy | 2.0+ | ORM base de données |
| Pydantic | 2.x | Validation des données |
| PyTorch | 2.0+ | Modèles IA (CLIP) |
| Transformers | 4.30+ | Hugging Face models |

### IA et ML
| Technologie | Utilisation |
|-------------|-------------|
| Google Gemini | Assistant conversationnel LLM |
| CLIP (OpenAI) | Embeddings images pour recherche visuelle |
| Cosine Similarity | Calcul de similarité produits |

### Infrastructure
| Service | Utilisation |
|---------|-------------|
| Meilisearch | Recherche full-text produits |
| SQLite/PostgreSQL | Stockage analytiques |
| Click to Pay | Intégration paiement (sandbox) |

## Modules Fonctionnels

### 1. Module E-Commerce Core
- Catalogue produits avec filtres avancés
- Panier et wishlist
- Tunnel de commande
- Gestion compte utilisateur
- Système de coupons

### 2. Module IA - Assistant Conversationnel
- Chatbot intelligent basé sur Gemini LLM
- Contexte utilisateur (historique, panier, wishlist)
- Recommandations produits inline
- Support multilingue (FR)

### 3. Module IA - Recommandations
- Produits similaires (CLIP embeddings)
- Produits complémentaires (cross-category)
- Recommandations personnalisées (comportement)
- Tendances (popularité)

### 4. Module IA - Recherche Visuelle
- Upload image pour recherche
- Extraction features CLIP
- Matching par similarité cosinus
- Suggestions complémentaires

### 5. Module Analytics
- Tracking comportement utilisateur
- Métriques modules IA
- Dashboard admin analytics
- KPIs recommandations (CTR, conversion)

### 6. Module Admin Back-Office
- Tableau de bord KPIs
- Gestion commandes
- Gestion produits
- Gestion clients
- Analytics IA

## Sécurité

### Authentification
- JWT tokens (access + refresh)
- Hachage bcrypt pour mots de passe
- RBAC (Role-Based Access Control)

### Protection des Données
- Validation stricte Pydantic
- CORS configuré
- Secrets via variables d'environnement
- Journalisation événements sécurité

## Performance

### Optimisations
- Lazy loading Angular modules
- Mise en cache embeddings produits
- Batch processing analytics
- Connection pooling database
