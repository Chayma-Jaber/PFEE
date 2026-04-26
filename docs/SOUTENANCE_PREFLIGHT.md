# Barsha — Pré-vol soutenance

> Liste à exécuter ~30 min avant la soutenance, dans l'ordre. À la fin de la
> liste, l'environnement de démo est prêt et la liste de scénarios secondaires
> est à portée si quelque chose tombe en panne pendant la démonstration.

Le scénario de démonstration lui-même est dans
[`docs/DEMO_SCENARIO.md`](DEMO_SCENARIO.md). Ce document-ci ne couvre que
**la préparation** et **les filets de sécurité**.

---

## 1. Préparation matérielle (T-30 min)

- [ ] Laptop branché, batterie vérifiée
- [ ] Wi-Fi vérifié — connexion à un point d'accès stable (téléphone en
      partage de connexion en secours)
- [ ] Câble HDMI / adaptateur testé sur le projecteur
- [ ] Résolution écran réglée pour que la fenêtre de démo soit lisible au fond
      de la salle (zoom navigateur ~110-125%)
- [ ] Mode "ne pas déranger" activé (Windows Focus Assist, notifications OFF)
- [ ] Onglets parasites fermés, un seul navigateur visible
- [ ] Power saving / mise en veille de l'écran désactivés

---

## 2. Préparation logicielle (T-25 min)

À exécuter dans 4 terminaux séparés :

### Terminal A — Backend NestJS
```bash
cd backend
# Vérifier que .env est rempli (au minimum DB_*, JWT_SECRET, FRONTEND_URL).
NODE_ENV=production node dist/main.js
```
Attendu :
```
[Bootstrap] Barsha API running on http://localhost:8000
[Bootstrap] Swagger docs at http://localhost:8000/api/docs
[Bootstrap] Environment: production
```
**Smoke test :**
```bash
curl http://localhost:8000/health        # 200
curl http://localhost:8000/api/categories # 200, JSON array
```

### Terminal B — Frontend Angular
```bash
npm start
# → http://localhost:4200
```

### Terminal C (optionnel) — Service IA Python
```bash
cd ai-service && python main.py
# → http://localhost:8001
```
Sans ce service, la recherche visuelle et la chat IA basculent sur leurs
fallbacks polis ("indisponible") — **pas un crash**.

### Terminal D (optionnel) — Ollama
```bash
ollama serve &
ollama list  # vérifier que qwen2.5:7b est présent
```

---

## 3. Vérification fonctionnelle dans le navigateur (T-15 min)

Suivre, dans cet ordre, **avant** la vraie démo :

| Étape | URL / action | Attendu |
|---|---|---|
| 1 | Ouvrir `http://localhost:4200/` | Page d'accueil charge, pas d'erreur console |
| 2 | Cliquer sur une catégorie (`/tn/femme`) | Liste de produits |
| 3 | Cliquer sur un produit | Page détail avec avis, recommandations |
| 4 | Bouton "Ajouter au panier" | Compteur panier passe à 1 |
| 5 | `/panier` | Le produit est listé |
| 6 | `/login` → admin@barsha.com.tn / Admin123! | Connexion OK |
| 7 | `/admin` | Dashboard charge |
| 8 | `/admin/orders` | Liste de commandes |

Si une de ces étapes échoue :
- Note l'étape qui casse → bascule sur le scénario de fallback (§5)
- Si l'API renvoie 500 : `curl http://localhost:8000/health` pour vérifier
  que le backend est encore up. Sinon, redémarrer Terminal A.
- Si l'erreur est sur une seule page : lors de la démo, expliquer la zone et
  passer à la suivante (le jury préfère une démo qui assume une faiblesse à
  une démo qui plante).

---

## 4. Identifiants de démo (rappel)

| Rôle | Email | Mot de passe |
|---|---|---|
| Super Admin | `admin@barsha.com.tn` | `Admin123!` |
| Client (n'importe quel seedé) | `sarah.benali@gmail.com` | `Customer123!` |

> Ces credentials viennent du seed (`npm run seed`). Si la DB a été reset
> sans re-seed, ils n'existeront pas — relancer le seed avant.

---

## 5. Plan B — Si quelque chose casse en direct

### 5a. Le backend ne démarre pas
**Symptôme :** Terminal A coince ou plante.
**Cause probable :** `JWT_SECRET` manquant en production, ou DB inaccessible.
**Action :** quitter le terminal, vérifier `.env`, relancer.
**Pendant ce temps :** parler de l'architecture (slide ou diagramme), gagner
30 secondes.

### 5b. La page produit affiche une erreur
**Symptôme :** 500 sur `/api/products/:id`.
**Cause probable :** drift de schéma entre les entités et la DB.
**Action :** continuer la démo sur **catégories** ou **recherche** (qui
n'utilisent pas les mêmes colonnes). Mentionner le warehouse multi-stock
en parlant, sans cliquer.

### 5c. La recherche renvoie 0 résultat
**Symptôme :** la barre de recherche ne trouve rien.
**Cause probable :** Meilisearch inaccessible ou clé API expirée.
**Action :** rester sur la navigation par catégorie, qui ne dépend pas de
Meilisearch. Mentionner que la recherche utilise **Meilisearch + recherche
visuelle CLIP côté IA**.

### 5d. Le chatbot est bloqué
**Symptôme :** la fenêtre chat reste sur "…" ou affiche "indisponible".
**Cause probable :** Ollama non lancé, ou modèle non chargé.
**Action :** annoncer le fallback comme une **fonctionnalité** ("nous
basculons sur des réponses pré-cadrées si le modèle local est lent — c'est
volontaire pour ne pas bloquer le client"), puis basculer sur la recherche
visuelle pour démontrer une fonctionnalité IA différente.

### 5e. Les emails ne partent pas
**Symptôme :** "emailSent: false" dans le toast, ou dans l'admin.
**Cause probable :** `EMAIL_ENABLED=false` ou SMTP injoignable.
**Action :** ouvrir l'admin **email-analytics** ou la page de **logs email**
pour montrer que le système trace les emails même quand le SMTP est en panne.
C'est un gros plus pour parler de **résilience opérationnelle**.

### 5f. Tout part en vrille
**Action :** afficher Swagger (`http://localhost:8000/api/docs`). C'est
toujours impressionnant et toujours up tant que le backend l'est. Plus de
**400 endpoints** documentés — montrer la richesse fonctionnelle.

---

## 6. Points forts à mettre en avant (au cas où)

Si le jury veut **plus** de matière au-delà du scénario de base :

1. **Migrations versionnées** avec drift detection (rare en projet étudiant)
2. **Préflight de sécurité** au boot (refuse de démarrer avec un secret par
   défaut en prod)
3. **Multi-warehouse stock** (ramifié dans tous les flux : commandes, retours,
   indexation Meilisearch, exports)
4. **Lifecycle marketing automation** — drips welcome / panier abandonné /
   winback / post-livraison, avec aperçu et test-send
5. **GDPR self-service** — clients peuvent demander export ou effacement
6. **Fiscal compliance Tunisie (TTN)** — branchable, sandbox par défaut
7. **Fraud signals + device fingerprinting**
8. **Recommandations + recherche visuelle CLIP** côté IA Python
9. **Service worker offline + CDN-ready**

---

## 7. Après la soutenance

- [ ] Couper Terminal A (backend) — `Ctrl+C`
- [ ] Couper Terminal B (frontend) — `Ctrl+C`
- [ ] Sauvegarder `.env` ailleurs (contient le JWT_SECRET de démo)
- [ ] Si la DB de démo doit être supprimée : `DROP DATABASE barsha;` côté MSSQL
