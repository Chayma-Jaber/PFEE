# Scénario de Démonstration - Soutenance PFE Barsha

## Durée Estimée: 15-20 minutes

---

## 1. Introduction et Homepage (2 min)

### Actions
1. Ouvrir http://localhost:4200/fr
2. Montrer le design premium et responsive
3. Scroller pour montrer les sections

### Points à Souligner
- Design moderne et luxueux adapté à une marque de mode
- Navigation intuitive
- Sections hero, nouveautés, catégories
- Barre de recherche intelligente

### Script
> "Voici la page d'accueil de Barsha, une plateforme e-commerce intelligente. Le design a été pensé pour refléter l'image premium de la marque tout en offrant une navigation fluide."

---

## 2. Recherche et Filtres (2 min)

### Actions
1. Utiliser la barre de recherche: "robe"
2. Appliquer des filtres (catégorie, prix)
3. Montrer le tri des résultats

### Points à Souligner
- Recherche full-text via Meilisearch
- Filtres dynamiques
- Résultats pertinents

### Script
> "La recherche est alimentée par Meilisearch pour des résultats instantanés. Les utilisateurs peuvent affiner avec des filtres intelligents."

---

## 3. Page Produit (PDP) et Recommandations IA (3 min)

### Actions
1. Cliquer sur un produit
2. Montrer la galerie d'images
3. Scroller vers les recommandations
4. Montrer "Produits similaires" et "Pour compléter ce look"

### Points à Souligner
- **Module IA #2: Recommandations**
- Algorithme basé sur CLIP embeddings
- Produits similaires = même catégorie/style
- Complémentaires = outfit building

### Script
> "Ici intervient notre premier module IA: le moteur de recommandation. Il utilise des embeddings CLIP pour trouver des produits visuellement similaires, et un algorithme de cross-category pour suggérer des articles complémentaires créant un look cohérent."

---

## 4. Assistant IA Conversationnel (4 min) ⭐

### Actions
1. Cliquer sur l'icône chatbot
2. Envoyer: "Bonjour, je cherche une tenue pour un mariage en été"
3. Observer la réponse contextuelle
4. Demander: "Qu'est-ce qui irait avec une robe bleue?"
5. Cliquer sur un produit suggéré

### Points à Souligner
- **Module IA #1: Assistant Conversationnel**
- LLM Google Gemini
- Contexte utilisateur (panier, historique)
- Suggestions produits inline
- Conseils mode personnalisés

### Script
> "Le cœur de notre innovation IA: l'assistant Barsha. Basé sur Google Gemini, il comprend les intentions d'achat, connaît le catalogue, et fournit des conseils mode personnalisés. Il peut suggérer des produits directement dans la conversation."

---

## 5. Recherche Visuelle IA (3 min) ⭐

### Actions
1. Dans le chatbot, cliquer sur l'icône appareil photo
2. Uploader une image de vêtement (préparer une image)
3. Montrer les résultats similaires
4. Montrer les suggestions complémentaires

### Points à Souligner
- **Module IA #3: Recherche Visuelle**
- Modèle CLIP pour extraction features
- Matching par similarité cosinus
- "Trouvez ce look" fonctionnalité

### Script
> "Notre troisième brique IA: la recherche visuelle. L'utilisateur uploade une photo, notre modèle CLIP extrait les caractéristiques visuelles, et nous trouvons les produits les plus similaires dans le catalogue. C'est du 'shop the look' intelligent."

---

## 6. Panier et Tunnel d'Achat (2 min)

### Actions
1. Ajouter un produit au panier
2. Aller au panier
3. Montrer le récapitulatif
4. Entrer dans le checkout (sans finaliser)

### Points à Souligner
- Panier persistant
- Calcul automatique
- Intégration coupon
- Tunnel sécurisé

### Script
> "Le tunnel d'achat classique mais optimisé: panier clair, possibilité d'appliquer des coupons, et checkout sécurisé avec intégration Click to Pay."

---

## 7. Back-Office Admin (3 min)

### Actions
1. Naviguer vers /admin
2. Montrer le dashboard avec KPIs
3. Montrer la gestion commandes
4. **Aller sur Analytics IA**
5. Montrer les métriques des modules IA

### Points à Souligner
- Dashboard KPIs business
- Gestion complète back-office
- **Analytics IA: mesure de la valeur ajoutée**
- CTR recommandations, engagement assistant

### Script
> "Le back-office permet de gérer l'activité. Plus important pour notre PFE: le dashboard Analytics IA qui mesure l'efficacité de nos modules. On peut voir le taux d'engagement de l'assistant, le CTR des recommandations, et l'utilisation de la recherche visuelle."

---

## 8. Architecture Technique (1 min)

### Points à Présenter
- Frontend: Angular 19 (SPA)
- Backend: FastAPI Python
- IA: Gemini LLM + CLIP + Recommendation Engine
- Analytics: Event tracking + Dashboard

### Script
> "L'architecture est découplée: Angular pour le frontend, FastAPI pour l'API backend qui orchestre les services IA. Les modèles utilisés sont Gemini pour le LLM et CLIP pour les embeddings visuels."

---

## 9. Conclusion et Valeur Ajoutée (2 min)

### Récapitulatif Valeur IA

| Module | Valeur Business |
|--------|-----------------|
| Assistant | Engagement +, conversion +, support 24/7 |
| Recommandations | Panier moyen +, découverte produits |
| Recherche Visuelle | UX différenciante, conversion mobile |
| Analytics | Mesure ROI, optimisation continue |

### Script
> "En conclusion, Barsha démontre comment l'IA peut transformer une plateforme e-commerce: assistant intelligent pour l'engagement, recommandations pour augmenter le panier, recherche visuelle pour une UX innovante, et analytics pour mesurer et optimiser. Le tout dans une architecture maintenable et sécurisée."

---

## Checklist Pré-Démonstration

- [ ] Backend démarré (`python -m uvicorn api:app --reload --port 8000`)
- [ ] Frontend démarré (`npm run start`)
- [ ] Image test prête pour recherche visuelle
- [ ] Navigateur en mode incognito (état propre)
- [ ] Connexion internet stable (pour Gemini API)
- [ ] Données démo présentes

## Questions Anticipées du Jury

1. **"Comment fonctionne le modèle de recommandation?"**
   > Embeddings CLIP pour similarité visuelle + règles métier pour complémentaires

2. **"Quelle est la précision de la recherche visuelle?"**
   > Dépend de la qualité des images catalogue. Tests montrent ~80% pertinence top-5

3. **"Comment gérez-vous les hallucinations du LLM?"**
   > Contexte strict sur le catalogue, pas d'informations externes, vérification produits

4. **"Scalabilité?"**
   > Architecture découplée, embeddings pré-calculés, caching possible

5. **"Sécurité des données?"**
   > JWT, bcrypt, CORS, RBAC, conformité RGPD (consentement cookies)
