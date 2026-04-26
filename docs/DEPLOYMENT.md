# Guide de Déploiement - Barsha E-Commerce

## Prérequis

### Logiciels Requis
- **Node.js** 18+ (pour le frontend Angular)
- **Python** 3.11+ (pour le backend AI)
- **Git** (gestion de version)

### Optionnel (Production)
- **PostgreSQL** 14+ (base de données production)
- **Nginx** (reverse proxy)
- **Docker** (containerisation)

## Installation Locale (Développement)

### 1. Cloner le Projet
```bash
git clone <repository-url>
cd PFEE
```

### 2. Configuration Backend

```bash
# Naviguer vers le backend
cd backend-ai

# Créer environnement virtuel (recommandé)
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Installer dépendances
pip install -r requirements.txt

# Copier et configurer l'environnement
cp .env.example .env
# Éditer .env avec vos clés API (GEMINI_API_KEY, etc.)
```

### 3. Configuration Frontend

```bash
# Retour à la racine
cd ..

# Installer dépendances Node
npm install
```

### 4. Lancement

**Terminal 1 - Backend:**
```bash
cd backend-ai
python -m uvicorn api:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
npm run start
# ou: ng serve
```

### 5. Accès

| Service | URL |
|---------|-----|
| Frontend | http://localhost:4200/fr |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Admin Dashboard | http://localhost:4200/fr/admin |

## Configuration Production

### Variables d'Environnement Critiques

```bash
# Sécurité (OBLIGATOIRE à changer)
SECRET_KEY=<générer-avec-secrets.token_hex(32)>
ADMIN_PASSWORD=<mot-de-passe-fort>

# Environnement
ENVIRONMENT=production
DEBUG=false

# Base de données PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/barsha

# CORS (domaines autorisés)
CORS_ORIGINS=https://barsha.com.tn,https://www.barsha.com.tn

# APIs
GEMINI_API_KEY=<votre-clé-google-ai>
MEILISEARCH_TOKEN=<votre-token-meilisearch>
```

### Build Production Frontend

```bash
# Build pour production
npm run build

# Output dans: dist/barsha/
```

### Configuration Nginx (Exemple)

```nginx
server {
    listen 80;
    server_name barsha.com.tn;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name barsha.com.tn;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend Angular
    location / {
        root /var/www/barsha/dist/barsha;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Lancement Production Backend

```bash
# Avec Gunicorn (recommandé)
pip install gunicorn

gunicorn api:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Ou avec systemd service
sudo systemctl start barsha-api
```

## Docker (Optionnel)

### Dockerfile Backend
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  backend:
    build: ./backend-ai
    ports:
      - "8000:8000"
    env_file:
      - ./backend-ai/.env

  frontend:
    build: .
    ports:
      - "4200:80"
    depends_on:
      - backend
```

## Vérification Post-Déploiement

### Checklist
- [ ] Frontend accessible et responsive
- [ ] API répond sur /docs
- [ ] Chatbot fonctionne (test message)
- [ ] Recherche visuelle opérationnelle
- [ ] Recommandations s'affichent
- [ ] Admin dashboard accessible
- [ ] Analytics trackent les événements

### Commandes de Test
```bash
# Test API santé
curl http://localhost:8000/

# Test chat
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Bonjour"}]}'

# Test analytics
curl -X POST http://localhost:8000/api/analytics/track \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","event_type":"product_view","product_id":1}'
```

## Troubleshooting

### Erreurs Courantes

| Erreur | Solution |
|--------|----------|
| `ModuleNotFoundError` | `pip install -r requirements.txt` |
| `CORS blocked` | Vérifier CORS_ORIGINS dans .env |
| `401 Unauthorized` | Token JWT expiré ou invalide |
| `AI module not available` | Vérifier GEMINI_API_KEY |

### Logs
```bash
# Backend logs
tail -f /var/log/barsha/api.log

# Ou en développement
python -m uvicorn api:app --reload --log-level debug
```
