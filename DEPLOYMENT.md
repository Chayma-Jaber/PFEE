# Barsha — Deployment & Demo Guide

## 1. Prerequisites

- Node.js 18+ and npm 9+
- SQL Server (local or remote) — default connection: `DESKTOP-KOR5QAB`, database `barsha`, user `admin` / `admin123`
- (Optional for AI) Python 3.10+ with venv
- (Optional for AI chatbot) Ollama with a model like `qwen2.5:7b` (~4 GB)
- (Optional for search) Meilisearch instance or external at `cache-data.barsha.com.tn`
- (Optional for email) SMTP credentials (Gmail app password, SendGrid, Outlook, etc.)

## 2. First-time setup

```bash
# Backend (NestJS)
cd backend
cp .env.example .env                          # edit as needed — see "Environment" below
npm install
npm run build

# Seed realistic data (customers, orders, Q&A, search analytics, pricing rules...)
npx ts-node src/database/seed.ts              # baseline: admin, categories, products, FAQs
npx ts-node src/database/seed-full.ts         # realistic demo data

# Frontend (Angular 19)
cd ..
npm install
```

## 3. Run in development

Open three terminals:

```bash
# Terminal 1 — backend
cd backend && node dist/main.js
# → http://localhost:8000   (Swagger: /api/docs)

# Terminal 2 — frontend
npm start
# → http://localhost:4200

# Terminal 3 (optional) — Python AI service
cd ai-service && python main.py               # enables visual search + recommendations
```

Ollama model for chatbot (one-time):
```bash
ollama pull qwen2.5:7b
ollama serve
```

## 4. Environment variables (backend/.env)

See [backend/.env.example](backend/.env.example) for the full list. Key groups:

| Group | Required for |
|---|---|
| `DB_*` | Database connection |
| `JWT_SECRET` | **Change in production** — must be a long random string |
| `CORS_ORIGINS` | Comma-separated list of allowed origins |
| `MEILISEARCH_URL`, `MEILISEARCH_TOKEN` | Search index |
| `AI_SERVICE_URL`, `OLLAMA_URL`, `OLLAMA_MODEL` | Chatbot + visual search |
| `SMTP_*`, `EMAIL_ENABLED=true` | Real email delivery (order confirmations, cart recovery, password reset, etc.) |
| `FRONTEND_URL` | Used in email links |

### SMTP quick configs

**Gmail:** `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=<gmail>`, `SMTP_PASSWORD=<Gmail App Password>`
**SendGrid:** `SMTP_HOST=smtp.sendgrid.net`, `SMTP_PORT=587`, `SMTP_USER=apikey`, `SMTP_PASSWORD=<api key>`
**Outlook:** `SMTP_HOST=smtp.office365.com`, `SMTP_PORT=587`

When `EMAIL_ENABLED=false` or SMTP is unreachable, the app logs the intended email and returns `emailSent: false` — it never crashes.

## 5. Login credentials (seeded)

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@barsha.com.tn` | `Admin123!` |
| Customer | `sarah.benali@gmail.com` | `Customer123!` (any seeded customer) |

## 6. Demo/soutenance routes

**Storefront:**
- `/` — home with flash sale banner, featured products, recommendations
- `/tn/femme` — category page with SEO-optimized meta tags
- `/detail-produit/:id` — product detail with reviews, Q&A, recently-viewed, visual search
- `/panier` — cart
- `/checkout` — checkout (auto-discounts applied via pricing rules)
- `/profile` — customer account: orders, loyalty, wishlist, addresses, notifications

**Admin back-office** (`/admin`):
- Dashboard · Commandes · Produits · Catégories · Clients · Fidélité · Coupons · Cartes cadeaux · Retours · Support · FAQ · Avis · Lots & Packs · Notifications (broadcast) · Tenues · Alertes · Rapports · Analytics IA
- **Avancé (10 outils)** at `/admin/advanced` — Customer 360°, Journal d'activité, Analytics recherche, Paniers abandonnés, Mouvements stock, Import/Export CSV, Campagnes, Segments, SEO, Pricing rules

## 7. Production build

```bash
# Frontend
npm run build -- --configuration production --base-href /
# Output: dist/barsha/

# Backend (already compiled by `npm run build`)
cd backend
NODE_ENV=production node dist/main.js
```

Serve `dist/barsha/` with any static host (nginx, Apache, Netlify, Vercel). Point `FRONTEND_URL` in backend env to the public URL so emails use correct links.

## 8. Health checks

```bash
curl http://localhost:8000/health
# → { aiService, ollama }  — confirms backend up and shows AI status

curl http://localhost:8000/api/products?limit=1       # catalog
curl http://localhost:8000/indexes/products/search -X POST -d '{"q":"robe","limit":5}' -H "Content-Type: application/json"  # search
```

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `jwt malformed` | Clear localStorage.admin_jwt and re-login, or check `JWT_SECRET` in env |
| `500 on /api/products` | Check TypeORM sort column; confirm `npm run build` was run after any entity change |
| Search returns empty | Meilisearch API key invalid / host unreachable — backend logs "connection failed" at boot |
| Chat returns fallback text only | `ai-service` or Ollama not running (see section 3) |
| `emailSent: false` | SMTP not configured — set `SMTP_USER`/`SMTP_PASSWORD` in `.env` |
| Port 8000 in use | `taskkill /F /PID $(netstat -ano | findstr :8000 | findstr LISTENING | awk '{print $5}')` |

## 10. What works in demo with default config (no external services)

Without SMTP, without Ollama model, without the Python AI service:

- Full storefront catalog, cart, checkout, account
- Admin back-office (all 20+ tabs)
- Search (via external Meilisearch)
- Chatbot (returns polite fallback text)
- Visual search (returns "indisponible" message gracefully)
- Pricing rules auto-apply at checkout
- Stock movements auto-log on orders/cancellations/returns
- Cart recovery generates real coupon + in-app notification
- Email delivery: `emailSent: false` but coupon code is visible in admin

With SMTP + Ollama + AI service running, all AI flows and real emails light up automatically.

## 11. Docker — one-command AI stack

Two composes are provided at the repo root:

- **`docker-compose.yml`** — full stack: Ollama + Python AI microservice + NestJS backend.
  - `docker compose up -d`
  - First boot pulls the model (~5 GB) via the `ollama-pull` one-shot sidecar.
  - Expose ports `8000` (backend), `8001` (ai-service), `11434` (Ollama).

- **`docker-compose.ai-only.yml`** — just Ollama + AI microservice.
  - Use when running the backend natively (`npm run start:dev`) but wanting real inference.
  - `docker compose -f docker-compose.ai-only.yml up -d`

Configure model / fallback credentials via repo-root `.env` (picked up by compose):

```
OLLAMA_MODEL=qwen2.5:7b
MEILISEARCH_URL=http://host.docker.internal:7700
MEILISEARCH_TOKEN=
GEMINI_API_KEY=
OPENROUTER_API_KEY=
```

Dockerfiles are in [`ai-service/Dockerfile`](ai-service/Dockerfile) and [`backend/Dockerfile`](backend/Dockerfile). The Python image is Python 3.11-slim with a multi-stage build; the backend image is node:20-alpine.

## 12. Post-Wave-4 operational features

- **SMS** — `/admin/sms` shows stats, recent log, test sender. Configure via `SMS_*` env vars (Twilio / Infobip / console). OTP, order confirmation and shipping updates all route through it automatically when `SMS_ENABLED=true`.
- **Email analytics** — `/admin/email-analytics` shows delivery rate, opens (pixel tracking), clicks and recent send log. No configuration needed beyond existing SMTP.
- **Customer returns portal** — `/account/returns` lets signed-in customers initiate RMA flows (pick order → pick items → reason + photos → submit), reusing the existing `ReturnRequest` backend.

## 13. CDN + offline hardening

The storefront is now CDN-ready. Three pieces:

### Service worker (offline + instant shell)

- Config: [`ngsw-config.json`](ngsw-config.json) — prefetches the app shell + lazy-caches assets; API data uses `freshness` strategy with 3 s timeout → falls back to cache on slow networks.
- Registered in [`src/app/app.config.ts`](src/app/app.config.ts) via `provideServiceWorker`, **prod builds only** (`!isDevMode()`).
- Verify after `npm run build`: `dist/barsha/browser/ngsw-worker.js` and `ngsw.json` must exist.

### nginx reverse proxy

- Sample in [`deploy/nginx.sample.conf`](deploy/nginx.sample.conf). Sets `immutable` headers on hashed assets, bypasses cache on `/api/*` and `/ngsw-worker.js`, proxies backend + AI service with keepalive + rate-limit.

### Cloudflare

- Recipe in [`deploy/cloudflare-rules.md`](deploy/cloudflare-rules.md). The single rule that matters: **do NOT cache `/ngsw-worker.js` on the CDN** — the SW is the source of truth for app-version updates.

### SSR status — why we did not add `@angular/platform-server`

The storefront has ~500 `localStorage` / `window` / `document` references across ~115 components and services (auth tokens, cart state, recently-viewed, funnel analytics, chatbot, etc.). Activating Angular Universal today would cause server-render crashes and silent auth-loss bugs. The SW + CDN path above covers the real win — first-load speed and offline resilience — without that blast radius. Per-route SSR can be added later as a scoped migration (prerender-only for `/faq`, `/about`, category landing pages, etc.).

## 14. Multi-warehouse stock

The catalog now supports multiple physical stock locations while keeping the legacy flat `Product.totalStock` column working.

**Data model**
- [`warehouses`](backend/src/warehouses/entities/warehouse.entity.ts) — code, name, city, priority, ships_orders, is_active, is_default
- [`product_stock`](backend/src/warehouses/entities/product-stock.entity.ts) — (product_id, warehouse_id) unique, quantity, reserved, safety_stock

**First-boot behavior**
`WarehousesService.onModuleInit` seeds one `MAIN` warehouse (Tunis) and backfills `product_stock` from each product's current `total_stock`. On every stock mutation the service recomputes `Product.totalStock` as the sum of per-warehouse quantities — so all downstream code (shop lists, Meilisearch indexing, catalog exports, AI grounding) keeps working unchanged.

**Admin UI** — `/admin/warehouses`
- CRUD for warehouses (create, update, set-default)
- Global stats tiles (active warehouses, total units, reserved, low-stock lines)
- Low-stock alert list across all locations
- Per-product stock inspector: lookup by product ID → shows every warehouse's quantity / reserved / safety stock / adjustment control

**Admin API**
- `GET  /api/admin/warehouses` — list warehouses
- `POST /api/admin/warehouses` — create
- `PUT  /api/admin/warehouses/:id` — update
- `POST /api/admin/warehouses/:id/set-default` — mark default
- `GET  /api/admin/warehouses/stats` — global KPIs
- `GET  /api/admin/warehouses/low-stock` — alert rows
- `GET  /api/admin/warehouses/products/:productId` — per-warehouse summary
- `POST /api/admin/warehouses/products/:productId/set` — absolute set (`{warehouseId, quantity, safetyStock?}`)
- `POST /api/admin/warehouses/products/:productId/adjust` — delta adjust (`{warehouseId, delta, safetyStock?}`)

---

## 15. Final-release runbook

### 15.1 Production-safety preflight

The backend refuses to boot in `NODE_ENV=production` if `JWT_SECRET` is empty or
left at the placeholder value. Soft warnings are also emitted for:
- `JWT_SECRET` shorter than 32 chars (recommend 64+)
- `EMAIL_ENABLED=true` with no `SMTP_USER`
- `SMS_ENABLED=true` with provider != `console` and no provider credentials
- `CTP_SANDBOX_MODE != "false"` (card payments still sandboxed)

Generate a strong secret:
```bash
openssl rand -base64 64
```

### 15.2 Database migration runner

Migrations live in [`backend/migrations/`](backend/migrations/) as plain `.sql`
files (one per change). The runner is `backend/scripts/run-migrations.ts`:
- maintains a `_migration_history` table with djb2 checksums
- detects drift (re-edited migrations) and warns
- handles MSSQL `GO` batch separators
- idempotent — every migration uses `IF NOT EXISTS` / `OBJECT_ID IS NULL` guards
- standalone (no NestJS module graph dependency); runs from `process.env`

**Dev (ts-node):**
```bash
cd backend
npm run migrate          # apply
npm run migrate:dry      # preview only
npm run migrate:rollback # last batch only
```

**Production (compiled JS — no ts-node needed):**
```bash
cd backend
npm ci --production=false   # need devDeps to run tsc
npm run build               # compiles app
npm run build:scripts       # compiles run-migrations.ts → dist/scripts/
npm run migrate:prod        # apply (uses dist/scripts/run-migrations.js)
npm run migrate:prod:dry
npm run migrate:prod:rollback
```

The runner reads `DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`,
`DB_NAME` directly from env, mirroring `database.module.ts`. It supports
`mssql` (default), `postgres`, and `sqlite`.

### 15.3 First-boot order on a fresh prod host

> **Important:** the 2 hand-written migrations in [`backend/migrations/`](backend/migrations/)
> only cover deltas added after the initial schema. The base 80+ entity tables
> (`products`, `users`, `orders`, `categories`, `warehouses`, `sellers`, ...)
> are created by TypeORM `synchronize:true`, which only runs in
> `NODE_ENV=development`. Therefore a **fresh** prod DB needs a one-time
> bootstrap pass before switching to production. See step 4 below.

```bash
# 1. clone + install
git clone <repo> && cd <repo>/backend
npm ci

# 2. configure env (copy + edit)
cp .env.example .env
$EDITOR .env   # at minimum: JWT_SECRET, DB_*, FRONTEND_URL, CORS_ORIGINS

# 3. build app + migration runner
npm run build
npm run build:scripts

# 4. ONE-TIME bootstrap of the base schema on a FRESH database.
#    Boot once in development mode so TypeORM synchronize:true creates
#    the 80+ entity tables. Stop the server as soon as it's listening.
NODE_ENV=development node dist/main.js &
sleep 25 && kill $!    # adjust if your DB is slow

# 5. apply post-bootstrap deltas
npm run migrate:prod

# 6. (optional) seed baseline data
NODE_ENV=production npx ts-node src/database/seed.ts

# 7. start API for real
NODE_ENV=production node dist/main.js
# → expect "[Bootstrap] Barsha API running on http://localhost:8000"
# → expect graceful "[WARN]" for any unconfigured external services

# 8. frontend
cd .. && npm ci && npm run build:prod
# serve dist/barsha/ behind nginx (see deploy/nginx.sample.conf)
```

**Subsequent deploys** (DB already bootstrapped) skip step 4 — go straight from
build → `npm run migrate:prod` → start in production.

### 15.4 Final go-live checklist

**Required to boot in production:**
- [ ] `JWT_SECRET` is set, ≥32 chars, not the placeholder
- [ ] `DB_HOST` / `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` point at the real DB
- [ ] Migrations applied (`npm run migrate:prod`)
- [ ] Frontend built (`npm run build:prod` from repo root) and served from `dist/barsha/`

**Required for full feature parity (warned at boot if missing):**
- [ ] `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` + `EMAIL_ENABLED=true`
      → order confirmations, RMA emails, password reset, lifecycle drips
- [ ] `MEILISEARCH_URL` + `MEILISEARCH_TOKEN` → product search + visual search
- [ ] `SMS_PROVIDER` + provider credentials + `SMS_ENABLED=true`
      → OTP, order confirmation SMS, shipping updates
- [ ] `CTP_*` real (non-sandbox) credentials + `CTP_SANDBOX_MODE=false`
      → live card payments
- [ ] `OLLAMA_URL` reachable and `OLLAMA_MODEL` pulled → chatbot real responses
- [ ] `AI_SERVICE_URL` reachable → visual search + recommendations

**Recommended but optional:**
- [ ] `FRONTEND_URL` = real public URL (used in email links + invoice PDFs)
- [ ] `CORS_ORIGINS` restricted to the production domain(s) only
- [ ] `FIRSTDELIVERY_*` / `ARAMEX_*` real credentials → live shipping labels
- [ ] `TTN_*` fiscal credentials → live fiscal receipts

**Smoke test after deploy:**
- [ ] `curl https://api.example.com/health` → 200
- [ ] `curl https://api.example.com/api/categories` → 200 with categories array
- [ ] `curl -XPOST https://api.example.com/indexes/products/search -d '{"q":"","limit":1}' -H 'Content-Type: application/json'` → 200 if Meilisearch configured
- [ ] Open `https://www.example.com/` → home page renders, no console errors
- [ ] Place a test order → confirmation email received

### 15.5 Known limitations (final release)

1. **SQLite fallback is not fully boot-supported.** Several entities use
   MSSQL-specific `nvarchar(MAX)` column types. TypeORM `synchronize:true`
   passes those through verbatim and SQLite rejects `MAX`. The migration
   runner itself works against SQLite — but full-app boot requires MSSQL or
   PostgreSQL. *Workaround:* set `NODE_ENV=production` (turns synchronize off)
   and apply migrations manually; or use MSSQL/Postgres. *Permanent fix:*
   replace `nvarchar(MAX)` with a DB-aware getter — deferred as a post-release
   refactor since MSSQL is the only deployment target.

2. **Card payments are sandboxed by default.** `CTP_SANDBOX_MODE=true` in
   `.env.example`. Setting it to `false` requires real CTP merchant
   credentials from the bank. Order placement still works in sandbox mode —
   the gateway just returns a fake authorization code.

3. **Shipping providers (FirstDelivery, Aramex) require real credentials.**
   Without them, the admin can still mark orders shipped manually but
   automatic label generation and tracking pings are skipped.

4. **Fiscal receipts (TTN) require real credentials and are off by default.**
   Without them, orders complete but no fiscal receipt is generated.

5. **AI features degrade gracefully when external services are absent.**
   Ollama/AI-service unreachable → chatbot returns canned French fallback,
   visual search returns "indisponible". Search returns empty arrays when
   Meilisearch is unreachable. None of these crash the app.

6. **Production-safety preflight only checks `JWT_SECRET` hard.** Other env
   misconfigurations produce `[WARN]` lines and the app boots in a degraded
   mode. The deliberate design choice: degraded > down. Verify the
   `[WARN]` log lines on first boot match expectations.

7. **Drift warnings on already-applied migrations are non-fatal.** If a
   migration `.sql` file is edited after being applied, the runner logs
   `⚠ drift` and continues. Don't edit applied migrations — write a new one.

8. **Fresh prod DB requires a one-time `NODE_ENV=development` bootstrap.**
   The 2 hand-written migrations cover only post-baseline deltas. The 80+
   entity tables are created by TypeORM `synchronize:true`, which only runs
   in dev mode. Procedure: boot once with `NODE_ENV=development` to create
   the base schema, stop the server, apply migrations, then run for real in
   production. See §15.3 step 4. *Permanent fix:* generate an "initial
   schema" SQL dump and add it as `migrations/2026-01-01_baseline/up.sql` —
   deferred as a post-release task since the bootstrap procedure is documented
   and idempotent (synchronize:true is safe on an empty DB and additive on a
   live one).
