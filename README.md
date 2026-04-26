# Barsha — plateforme e-commerce intelligente

Site e-commerce omnicanal pour la marque Barsha, avec marketplace multi-vendeurs,
gestion multi-entrepôts, conformité RGPD/TTN, et briques d'intelligence
artificielle (assistant LLM, recherche visuelle CLIP, recommandations
multi-stratégies).

> Projet de fin d'études — voir [docs/Rapport_PFE_Barsha_Soutenance.docx](docs/Rapport_PFE_Barsha_Soutenance.docx)
> et [docs/Cahier_des_charges_Barsha_v2.docx](docs/Cahier_des_charges_Barsha_v2.docx).

---

## Architecture

```
PFEE/
├── src/                          # Frontend Angular 19 (storefront + admin)
│   └── app/
│       ├── components/           # Storefront grand public
│       ├── features/admin/       # Back-office admin (30+ pages)
│       ├── services/             # Services métier (cart, auth, chat, reco…)
│       └── models/
│
├── backend/                      # API métier NestJS 10 (50+ modules)
│   ├── src/
│   │   ├── ai/, auth/, orders/, products/, marketplace/, …
│   │   ├── platform/             # event bus, observability, schedulers
│   │   ├── database/seed.ts      # baseline + realistic seed data
│   │   ├── app.module.ts
│   │   └── main.ts               # bootstrap + production-safety preflight
│   ├── migrations/               # SQL migrations versionnées
│   ├── scripts/run-migrations.ts # runner standalone (drift detection)
│   ├── Dockerfile
│   └── package.json
│
├── ai-service/                   # Service IA Python (FastAPI)
│   ├── main.py                   # endpoints /chat /recommend /like-this
│   ├── engines/                  # CLIP, Ollama orchestration
│   └── Dockerfile
│
├── deploy/                       # Configurations nginx (TLS + staging)
├── docs/                         # Documentation, diagrammes UML, rapport PFE
├── docker-compose.yml            # Pile IA seule (Ollama + ai-service + backend)
├── docker-compose.staging.yml    # Pile complète single-host
├── DEPLOYMENT.md                 # Runbook complet (15 sections)
└── README.md                     # Ce fichier
```

---

## Démarrage rapide (développement)

Trois terminaux :

```bash
# 1. Backend NestJS
cd backend
cp .env.example .env             # ajuster DB_*, JWT_SECRET…
npm install
npm run start:dev                # → http://localhost:8000  (Swagger /api/docs)

# 2. Frontend Angular
npm install
npm start                        # → http://localhost:4200

# 3. (optionnel) Service IA
cd ai-service
pip install -r requirements.txt
python main.py                   # → http://localhost:8001
ollama serve && ollama pull qwen2.5:7b   # LLM local pour le chatbot
```

Sans le service IA / sans Ollama, le storefront fonctionne avec des fallbacks
polis ("indisponible") — aucune fonctionnalité ne fait planter l'application.

---

## Démarrage staging (Docker compose, single-host)

```bash
cp .env.staging.example .env.staging
# éditer JWT_SECRET (≥32 chars : openssl rand -base64 64), SMTP, CTP…
npm install && npm run build:prod                      # bundle Angular
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d

# Bootstrap base fraîche (synchronize crée les ~80 tables)
docker compose -f docker-compose.staging.yml exec backend \
  sh -c "NODE_ENV=development node dist/main.js & sleep 25 && kill %1"

# Appliquer les migrations versionnées
docker compose -f docker-compose.staging.yml exec backend npm run migrate:prod

# Smoke test
curl http://localhost/health
curl http://localhost/api/categories
```

Détails complets dans [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Angular 19 (standalone), TypeScript 5.6, PrimeNG 19, RxJS, SCSS, Service Worker |
| Backend | NestJS 10, TypeScript 5.3, TypeORM 0.3, JWT (@nestjs/jwt), bcrypt, class-validator |
| Base de données | Microsoft SQL Server 2022 (PostgreSQL et SQLite supportés en fallback) |
| Recherche | Meilisearch 1.6 (full-text français + synonymes) |
| IA | Python 3.11, FastAPI, Ollama (Qwen 2.5 7B), CLIP (OpenAI), PyTorch 2 |
| LLM cloud (fallback) | Gemini, OpenRouter |
| Paiement | Click-to-Pay / Konnekt (sandbox par défaut) |
| Transporteurs | FirstDelivery, Aramex |
| Email / SMS | SMTP (Gmail / SendGrid / Mailtrap), Twilio, Infobip, mode console |
| Conformité | RGPD self-service, TTN fiscal Tunisie (branchable) |
| Infra | Docker, Docker Compose, nginx, Cloudflare-ready |

---

## Modules backend (50+)

| Domaine | Modules NestJS |
|---|---|
| Core commerce | auth, users, products, categories, cart, orders, payments, promotions, search, wishlist, shipping |
| Marketplace & fulfillment | marketplace (sellers, fulfillments, payouts), warehouses, replenishment |
| IA & personnalisation | ai (chatbot, visual search, stylist), recommendations (v3 multi-stratégies), propensity (CLV/churn), ugc-moderation |
| CRM & opérations | reviews, product-qa, support, faq, notifications, alerts, newsletter, lifecycle (drips), email, sms |
| Conformité & sécurité | fiscal (TTN), gdpr (export/erasure), fraud (signaux + fingerprinting) |
| Commerce avancé | subscriptions, preorder/drops, bundles, configurator, dynamic-pricing, gift-cards, loyalty, referrals |
| B2B | b2b (wholesale, devis, listes de prix) |
| Contenu & expérience | cms (page builder), outfits, sizing, feature-flags |
| Analytics & infra | analytics (funnel, recently-viewed, search queries, stock movements), admin, storefront, wave4 (CRM ops), erp, platform/events |

> 80+ entités relationnelles, 400+ endpoints REST documentés via Swagger.

---

## Endpoints clés (extraits)

### Public / storefront
- `GET  /health` — état des services externes
- `GET  /api/categories`, `/api/products`, `/api/products/:id`
- `POST /api/cart/items`, `GET /api/cart`
- `POST /api/orders` — passage de commande
- `POST /indexes/products/search` — recherche Meilisearch
- `POST /api/ai/chat` — chatbot
- `POST /api/ai/like-this` — recherche visuelle (CLIP)
- `GET  /api/recommendations/v3?strategy=...` — 8+ stratégies de reco

### Authentification
- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/refresh`
- `POST /api/auth/forgot-password`, `/api/auth/reset-password`

### Compte client
- `GET  /api/orders/me`, `/api/orders/:id/track`
- `POST /api/orders/:id/return-request`
- `POST /api/storefront/gdpr/requests` — demande export ou effacement

### Marketplace (vendeur)
- `POST /api/storefront/seller/apply`
- `GET  /api/storefront/seller/me`, `/api/storefront/seller/payouts`

### Back-office admin (`/admin/*`)
- Dashboard, commandes, produits, catégories, clients, coupons, retours
- Marketplace (sellers, payouts), warehouses, lifecycle, fiscal, gdpr, fraud
- Customer 360°, analytics IA, journal d'activité, A/B tests, feature flags
- Modération UGC, reviews, Q&A, support tickets

Documentation Swagger interactive : `http://localhost:8000/api/docs`

---

## Fonctionnalités principales

### Storefront grand public
- Catalogue avec filtres dynamiques (prix, taille, couleur, disponibilité)
- Recherche Meilisearch + recherche visuelle CLIP
- Fiches produit avec galerie zoomable, variantes, avis, Q&A, recommandations
- Panier persistant + tunnel d'achat (CTP / COD) + coupons + pricing rules auto
- Compte client : commandes, suivi livraison, retours, fidélité, parrainage, RGPD
- Wishlist multi-listes, partage, sizing assistant
- Outfits, drops, daily deals, B2B portal
- Service worker offline + PWA installable

### IA & personnalisation
- **Chatbot** Ollama Qwen 2.5 7B local (fallback Gemini/OpenRouter), grounding produits via Meilisearch
- **Recherche visuelle** CLIP : upload image → top-N produits similaires
- **Recommandations v3** : trending, new-arrivals, seasonal, editorial, personalized, complementary, cart-based, bundle, similar
- **Modération UGC** : pipeline texte + image, file admin
- **Propensity scoring** : CLV, churn risk, next-purchase timing
- **AI Stylist** : recommandations de tenue par occasion

### Marketplace multi-vendeurs
- Onboarding KYC public + workflow d'approbation admin
- Catalogue vendeur (produit rattaché à un seller_id)
- Fulfillments mixés (Barsha + items vendeurs ; états PARTIALLY_SHIPPED / DELIVERED)
- Calcul des payouts (gross − commission), virement admin

### Multi-entrepôts & inventaire
- Stock par couple (product, warehouse) avec safety stock
- Réservation atomique au passage de commande
- Alertes rupture, mouvements de stock auditables
- Replenishment fournisseurs (suppliers, purchase orders)

### Marketing & CRM
- Lifecycle automation : welcome, panier abandonné, post-livraison, winback, drips vendeurs
- Newsletter (campagnes, tracking ouvertures/clics)
- Customer 360°, segments, tags, tasks board, signaux comportementaux
- Daily deals, drops, programmes loyalty / parrainage / cartes cadeaux

### Conformité & sécurité
- **Préflight production** : refuse de booter avec un `JWT_SECRET` par défaut
- **RGPD** self-service : export, effacement, vérification
- **TTN fiscal Tunisie** : émission de reçus (sandbox par défaut, branchable live)
- Fraude : signaux, file de validation, device fingerprinting
- JWT + bcrypt 12 rounds + RBAC (visitor / customer / seller / admin)
- ValidationPipe global, CORS allowlist, HSTS via nginx

### Industrialisation
- Migrations versionnées avec drift detection (`backend/scripts/run-migrations.ts`)
- Variantes du runner : `npm run migrate` / `migrate:dry` / `migrate:rollback`
  (ts-node) et `migrate:prod*` (compiled JS, sans ts-node)
- Configuration par environnement (38 variables, 9 groupes)
- Docker compose double : `docker-compose.yml` (IA seule) et `docker-compose.staging.yml` (pile complète)
- Event bus interne + outbox persistante (`domain_events`)
- Audit trail : CustomerNote, OrderComment, AdminTask, AuditDiff

---

## Identifiants seedés

| Rôle | Email | Mot de passe |
|---|---|---|
| Super Admin | `admin@barsha.com.tn` | `Admin123!` |
| Client (n'importe quel seedé) | `sarah.benali@gmail.com` | `Customer123!` |

> Provient de `npm run seed` (`backend/src/database/seed.ts`).

---

## Documentation détaillée

- [DEPLOYMENT.md](DEPLOYMENT.md) — runbook opérationnel complet (15 sections)
- [docs/Cahier_des_charges_Barsha_v2.docx](docs/Cahier_des_charges_Barsha_v2.docx) — cahier des charges v2 (27 pages)
- [docs/Rapport_PFE_Barsha_Soutenance.docx](docs/Rapport_PFE_Barsha_Soutenance.docx) — rapport PFE complet (53 pages)
- [docs/Annexes_UML_Barsha.docx](docs/Annexes_UML_Barsha.docx) — diagrammes UML + sources PlantUML (40 pages)
- [docs/SOUTENANCE_PREFLIGHT.md](docs/SOUTENANCE_PREFLIGHT.md) — checklist soutenance + Plan B
- [docs/DEMO_SCENARIO.md](docs/DEMO_SCENARIO.md) — scénario de démo en 8 étapes
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — vue technique
- [docs/AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md), [docs/AI_MODULES.md](docs/AI_MODULES.md) — détails IA

---

## Conformité au cahier des charges

| Catégorie | Cahier v1 (initial) | Cahier v2 (final) | Implémenté |
|---|---|---|---|
| Storefront baseline (F01-F13) | 13 | 13 | ✅ 13/13 |
| IA baseline (F14-F16) | 3 | 3 | ✅ 3/3 (étendu à 5 briques) |
| Analytics & SEO (F17-F19) | 3 | 3 | ✅ 3/3 |
| Marketplace & multi-WH (F20-F25) | — | 6 | ✅ 6/6 |
| CRM & ops (F26-F33) | — | 8 | ✅ 8/8 |
| Commerce avancé (F34-F45) | — | 12 | ✅ 12/12 |
| Conformité & fraude (F46-F49) | — | 4 | ✅ 4/4 |
| IA étendue (F49-F50, F70-F71) | — | 4 | ✅ 4/4 |
| Logistique & comms (F51-F54) | — | 4 | ✅ 4/4 |
| Industrialisation (F72-F75) | — | 4 | ✅ 4/4 |
| **Total** | **19** | **75** | **✅ 75/75** |

---

## Licence

Projet académique. Tous droits réservés à l'auteur dans le cadre du PFE.

## Auteur

**Wassim Marouani** — Projet de fin d'études, année universitaire 2025-2026.
