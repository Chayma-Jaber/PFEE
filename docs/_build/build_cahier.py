# -*- coding: utf-8 -*-
"""
Generate docs/Cahier_des_charges_Barsha_v2.docx — updated requirements/reference
document for the Barsha PFE platform, reflecting the real final implementation.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from build_helpers import (
    Document, set_default_styles, set_a4_margins,
    heading, para, justified, bullet, numbered,
    code_block, page_break, image, table, add_toc, page_numbers,
    Cm, Pt, RGBColor, WD_ALIGN_PARAGRAPH,
)


def build():
    doc = Document()
    set_default_styles(doc)
    set_a4_margins(doc)

    # =================================================================
    # PAGE DE GARDE
    # =================================================================
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("CAHIER DES CHARGES — VERSION 2"); r.font.size = Pt(14); r.bold = True
    r.font.color.rgb = RGBColor(0x1F, 0x3A, 0x5F)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Document de référence du projet"); r.italic = True; r.font.size = Pt(11)

    for _ in range(4):
        doc.add_paragraph()

    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Plateforme Barsha"); r.font.size = Pt(36); r.bold = True
    r.font.color.rgb = RGBColor(0x1F, 0x3A, 0x5F)

    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Site e-commerce intelligent et marketplace"); r.font.size = Pt(16); r.italic = True

    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Conception, développement et industrialisation d'une plateforme "
                  "e-commerce augmentée par l'intelligence artificielle"); r.font.size = Pt(12)

    for _ in range(6):
        doc.add_paragraph()

    meta = [
        ("Entreprise", "Barsha (mode prêt-à-porter — Tunisie)"),
        ("Nature du document", "Cahier des charges fonctionnel et technique — version 2 (mise à jour finale)"),
        ("Document remplacé", "Cahier_des_charges_Barsha.docx (v1.0)"),
        ("Statut", "Validé — reflète l'implémentation réelle au terme du PFE"),
        ("Auteur", "Wassim Marouani"),
        ("Encadrant", "[à compléter]"),
        ("Année universitaire", "2025 — 2026"),
        ("Version", "2.0 (mise à jour majeure)"),
        ("Date", "Avril 2026"),
    ]
    t = doc.add_table(rows=len(meta), cols=2)
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for i, (k, v) in enumerate(meta):
        c1, c2 = t.rows[i].cells
        c1.text = ""; rp = c1.paragraphs[0].add_run(k); rp.bold = True; rp.font.size = Pt(10)
        c2.text = ""; rp = c2.paragraphs[0].add_run(v); rp.font.size = Pt(10)
    doc.add_paragraph()
    page_break(doc)

    # =================================================================
    # AVANT-PROPOS
    # =================================================================
    heading(doc, "Avant-propos — pourquoi une version 2 ?", level=1)
    justified(doc,
        "Le présent document constitue une mise à jour majeure du cahier des charges initial du "
        "projet de fin d'études Barsha (version 1.0, daté du début du projet). La version 1 décrivait "
        "fidèlement le périmètre cible défini lors du cadrage : un site e-commerce front-end et "
        "back-end intégrant trois briques d'intelligence artificielle (assistant conversationnel, "
        "recommandations, recherche visuelle), une dizaine de modules métier classiques (catalogue, "
        "panier, commande, profil, retours, coupons, favoris) et un back-office d'administration.")

    justified(doc,
        "Au cours de la phase de réalisation, le projet a connu une expansion fonctionnelle "
        "considérable, motivée par trois facteurs : (i) la nécessité de produire une plateforme "
        "réellement industrialisable et non un simple démonstrateur, (ii) l'opportunité d'explorer "
        "des problématiques d'ingénierie logicielle plus avancées (multi-vendeurs, multi-entrepôts, "
        "automatisation marketing, conformité fiscale), et (iii) la prise en compte de retours "
        "utilisateurs successifs ayant fait émerger de nouveaux besoins.")

    justified(doc,
        "À l'issue du projet, la plateforme Barsha compte plus de 50 modules NestJS, plus de 80 "
        "entités relationnelles, plus de 400 endpoints REST, un service IA Python autonome basé sur "
        "Ollama et CLIP, et un front-end Angular 19 comprenant un storefront grand public et un "
        "back-office administrateur de plus de 30 pages. La quantité, la nature et la complexité "
        "des fonctionnalités effectivement livrées rendent le cahier des charges initial nettement "
        "insuffisant en tant que document de référence.")

    justified(doc,
        "Cette version 2 conserve la structure du cahier original mais : (1) actualise chaque "
        "section pour refléter l'implémentation réelle, (2) ajoute des chapitres pour les nouvelles "
        "thématiques (marketplace, conformité, opérations), et (3) introduit en clôture une matrice "
        "de traçabilité explicite entre les exigences originales et les capacités finalement "
        "livrées. Le cahier v1 reste cité comme baseline de référence.")
    page_break(doc)

    # =================================================================
    # TOC
    # =================================================================
    add_toc(doc)

    # =================================================================
    # CHAPITRE 1 — CONTEXTE
    # =================================================================
    heading(doc, "1. Contexte et problématique", level=1)

    heading(doc, "1.1 Contexte du projet", level=2)
    justified(doc,
        "Barsha est une marque tunisienne de prêt-à-porter qui souhaite développer un canal de "
        "vente en ligne moderne, intelligent et différencié. Le marché du e-commerce en Tunisie "
        "connaît une croissance soutenue mais reste dominé par des plateformes généralistes ; "
        "les marques nationales disposent rarement d'une expérience digitale à la hauteur de "
        "leur identité. Barsha ambitionne de combler ce manque en proposant une plateforme de "
        "vente en ligne au standard international, avec une couche de personnalisation par "
        "intelligence artificielle qui constitue son avantage différenciant.")

    heading(doc, "1.2 Problématique initiale (rappel)", level=2)
    justified(doc,
        "« Comment concevoir une plateforme e-commerce moderne, ergonomique et intelligente "
        "permettant à Barsha de vendre ses produits en ligne, d'améliorer l'engagement client "
        "et d'optimiser le taux de conversion, tout en intégrant des modules d'intelligence "
        "artificielle apportant une réelle valeur ajoutée ? »")

    heading(doc, "1.3 Problématique étendue (version 2)", level=2)
    justified(doc,
        "Au cours du projet, la problématique s'est élargie de la simple « plateforme e-commerce "
        "intelligente » vers la question plus générale de la construction d'un écosystème "
        "commerce omnicanal : "
    )
    bullet(doc, "Comment industrialiser la plateforme pour qu'elle puisse réellement aller en production (gestion d'environnements, migrations versionnées, observabilité, déploiement reproductible) ?")
    bullet(doc, "Comment supporter un modèle marketplace multi-vendeurs sans casser l'expérience client unifiée (catalogue, paiement, livraison, retours) ?")
    bullet(doc, "Comment intégrer la conformité réglementaire tunisienne (TTN/fiscal) et européenne (RGPD) sans alourdir le parcours utilisateur ?")
    bullet(doc, "Comment construire une gestion opérationnelle (lifecycle marketing, support, fraude, retours) qui soit utilisable par une équipe métier non technique ?")

    heading(doc, "1.4 Justification académique du projet", level=2)
    justified(doc,
        "Sur le plan académique, le projet s'inscrit pleinement dans le périmètre du génie "
        "logiciel : architecture modulaire, séparation des préoccupations, intégration de "
        "services externes hétérogènes, gestion du cycle de vie des données, observabilité, "
        "déploiement, sécurité. Les briques IA (LLM local, embeddings CLIP, recommandation) "
        "apportent une dimension recherche appliquée. La couche commerce/opérations apporte "
        "une dimension produit réelle. Cette double dimension distingue le projet d'un "
        "exercice purement technique ou purement applicatif.")

    page_break(doc)

    # =================================================================
    # CHAPITRE 2 — ÉVOLUTION DU PÉRIMÈTRE
    # =================================================================
    heading(doc, "2. Évolution du périmètre — du baseline au périmètre final", level=1)

    justified(doc,
        "Cette section synthétise l'évolution du périmètre fonctionnel entre la version 1 du "
        "cahier des charges et la version 2. L'objectif est de rendre lisible, en un coup d'œil, "
        "l'écart entre ce qui était initialement planifié et ce qui a été effectivement livré.")

    heading(doc, "2.1 Synthèse quantitative", level=2)
    table(doc,
        ["Indicateur", "Cahier v1 (planifié)", "Implémentation finale (v2)"],
        [
            ["Modules fonctionnels", "≈ 12", "Plus de 50"],
            ["Endpoints REST", "≈ 40", "Plus de 400"],
            ["Entités persistées", "≈ 15", "Plus de 80"],
            ["Pages back-office admin", "≈ 5–6", "Plus de 30"],
            ["Briques IA principales", "3 (chatbot, reco, vision)", "5 (chatbot, reco multi-stratégies, vision, scoring propension, modération UGC)"],
            ["Conformité réglementaire", "RGPD (mention)", "RGPD self-service + TTN fiscal Tunisie"],
            ["Modèle commerce", "B2C unique", "B2C + marketplace multi-vendeurs + B2B"],
            ["Gestion stock", "Stock global", "Multi-entrepôts + réservations + safety stock"],
            ["Paiement", "Simulation", "Intégration CTP/Konnekt (sandbox prêt à passer en live)"],
            ["Livraison", "Hors périmètre", "Intégration FirstDelivery & Aramex + suivi temps réel"],
            ["Conformité fiscale", "Hors périmètre", "TTN configuré, sandbox par défaut"],
            ["Observabilité", "Non planifiée", "Event bus, audit trail, observability module"],
            ["Industrialisation", "Démonstrateur local", "Docker compose staging + migrations versionnées + préflight de sécurité"],
        ],
        col_widths_cm=[5.0, 5.5, 5.5],
        first_col_bold=True,
    )

    heading(doc, "2.2 Catégorisation des nouveaux modules", level=2)
    para(doc, "Les modules ajoutés après le cadrage initial peuvent être regroupés en sept catégories :", bold=False)

    bullet(doc, "Marketplace & fulfillment : marketplace, warehouses, replenishment, shipping (intégrations transporteurs).")
    bullet(doc, "IA & personnalisation étendue : recommandations multi-stratégies (v3), propensity (CLV/churn), ugc-moderation, ai-stylist.")
    bullet(doc, "CRM & opérations : reviews, product-qa, support, faq, notifications, alerts, newsletter, lifecycle marketing automation, email/SMS infra.")
    bullet(doc, "Conformité & sécurité : fiscal/TTN, gdpr (self-service export et effacement), fraud (signaux, fingerprinting).")
    bullet(doc, "Commerce avancé : subscriptions, preorder/drops, bundles, configurator, dynamic-pricing, gift-cards, loyalty, referrals.")
    bullet(doc, "B2B : comptes, devis, listes de prix wholesale.")
    bullet(doc, "Contenu & expérience : cms (page builder), outfits, sizing, feature-flags (A/B testing), analytics (funnel, recently-viewed, search-queries, stock-movements).")

    heading(doc, "2.3 Pourquoi ces ajouts ?", level=2)
    justified(doc,
        "Chaque ajout répond à un besoin concret apparu pendant le développement :")
    bullet(doc, "Marketplace : pour passer du modèle « vendeur unique » à une vraie plateforme capable d'héberger plusieurs marques partenaires de Barsha.")
    bullet(doc, "Multi-entrepôts : pour traiter le cas réel où Barsha dispose de stock dans plusieurs villes (Tunis, Sousse, Sfax) et veut prioriser l'expédition au plus proche du client.")
    bullet(doc, "TTN fiscal : pour permettre à Barsha de facturer légalement en Tunisie une fois la plateforme passée en production réelle.")
    bullet(doc, "RGPD self-service : pour garantir la conformité européenne en cas de clientèle française ou italienne (diaspora tunisienne).")
    bullet(doc, "Lifecycle automation : pour permettre à l'équipe marketing d'automatiser welcome, panier abandonné et winback sans intervention dev.")
    bullet(doc, "Préflight de sécurité au boot : pour empêcher tout déploiement accidentel avec un secret par défaut, à la suite d'un retour d'expérience opérationnel.")
    bullet(doc, "Migrations versionnées : pour rendre les déploiements reproductibles et auditables, condition sine qua non d'un passage en production.")

    page_break(doc)

    # =================================================================
    # CHAPITRE 3 — PÉRIMÈTRE FINAL
    # =================================================================
    heading(doc, "3. Périmètre final du projet", level=1)

    heading(doc, "3.1 Périmètre inclus", level=2)
    para(doc, "Le périmètre final livré comprend :", bold=False)
    bullet(doc, "Storefront grand public Angular 19 avec design premium responsive (mobile-first), service worker offline et PWA-ready.")
    bullet(doc, "Back-office administrateur Angular 19 avec plus de 30 pages couvrant l'ensemble des opérations métier.")
    bullet(doc, "API métier NestJS 10 avec plus de 50 modules et 400+ endpoints documentés via Swagger.")
    bullet(doc, "Service IA Python FastAPI autonome (chatbot Ollama, embeddings CLIP, recommandations, modération).")
    bullet(doc, "Base de données MSSQL 2022 (plus de 80 entités) avec migrations versionnées et drift detection.")
    bullet(doc, "Index de recherche Meilisearch avec tokenisation française et synonymes.")
    bullet(doc, "Marketplace multi-vendeurs (onboarding, fulfillment, payouts).")
    bullet(doc, "Multi-entrepôts (réservation stock, safety stock, alertes rupture).")
    bullet(doc, "Lifecycle marketing automation (welcome, panier abandonné, post-livraison, winback).")
    bullet(doc, "Conformité RGPD self-service (export, effacement) et fiscal Tunisie (TTN, branchable).")
    bullet(doc, "Détection fraude (signaux + fingerprinting device).")
    bullet(doc, "Programmes commerciaux : coupons, gift-cards, loyalty, referrals, dynamic-pricing.")
    bullet(doc, "B2B : comptes wholesale, devis, listes de prix.")
    bullet(doc, "CMS (page builder) avec révisions et publication.")
    bullet(doc, "Analytics & observabilité (event bus, funnel, audit trail).")
    bullet(doc, "Industrialisation : préflight sécurité au boot, migrations versionnées, docker-compose staging single-host, runbooks de déploiement.")

    heading(doc, "3.2 Périmètre exclu (assumé)", level=2)
    para(doc, "Restent hors du périmètre du PFE :", bold=False)
    bullet(doc, "Application mobile native iOS / Android (la PWA en couvre les principaux cas d'usage).")
    bullet(doc, "Intégration ERP comptable temps réel (un module ERP d'export CSV/XML est livré, mais sans synchronisation bidirectionnelle).")
    bullet(doc, "Multi-tenant SaaS (le code est mono-tenant ; l'extension SaaS est une perspective post-PFE).")
    bullet(doc, "Tests automatisés exhaustifs : seules quelques suites unitaires sont livrées (ts-jest est configuré, les tests métier critiques sont à compléter).")
    bullet(doc, "Passage à l'échelle géographique multi-régions (la plateforme est aujourd'hui mono-région Tunisie).")
    bullet(doc, "SSR Angular Universal (volontairement écarté, voir DEPLOYMENT.md §13).")

    heading(doc, "3.3 Hypothèses retenues", level=2)
    bullet(doc, "Le catalogue produits initial est alimenté par un jeu de données réaliste de plus de 100 produits avec variantes (couleurs, tailles).")
    bullet(doc, "L'hébergement de démonstration est local (docker-compose staging) ; la mise en production sur cloud (AWS / Azure / OVH) est une étape opérationnelle ultérieure documentée mais non exécutée dans le PFE.")
    bullet(doc, "Le LLM utilisé est Qwen 2.5 7B exécuté localement via Ollama, avec fallback cloud Gemini / OpenRouter en cas d'indisponibilité.")
    bullet(doc, "Les paiements CTP/Konnekt sont en mode sandbox ; le passage en mode live nécessite l'obtention de credentials marchand auprès de la banque.")
    bullet(doc, "La conformité fiscale TTN est branchable mais désactivée par défaut ; elle nécessite un compte fournisseur agréé.")

    heading(doc, "3.4 Limites assumées", level=2)
    justified(doc,
        "Le projet livre une plateforme techniquement industrialisable, mais reste un démonstrateur "
        "au sens où la mise en production effective avec trafic réel, charge à grande échelle et "
        "credentials marchands réels est une phase opérationnelle ultérieure. La couverture de "
        "tests automatisés reste partielle. Certaines fonctions très avancées (multi-tenant SaaS, "
        "BI temps réel, marketplace international avec multi-devises) sont identifiées comme "
        "perspectives.")

    page_break(doc)

    # =================================================================
    # CHAPITRE 4 — PARTIES PRENANTES
    # =================================================================
    heading(doc, "4. Parties prenantes et acteurs", level=1)

    heading(doc, "4.1 Parties prenantes du projet", level=2)
    table(doc,
        ["Partie prenante", "Rôle"],
        [
            ["Barsha (marque commanditaire)", "Définit les besoins métier, valide les livrables fonctionnels et l'identité graphique."],
            ["Étudiant porteur du PFE", "Conception, développement, intégration et industrialisation de la plateforme."],
            ["Encadrant académique", "Supervise la rigueur méthodologique et la qualité du livrable."],
            ["Jury de soutenance", "Évalue la qualité technique, fonctionnelle et académique du projet."],
            ["Équipe métier Barsha (future)", "Utilisera quotidiennement le back-office (catalogue, commandes, marketing)."],
            ["Équipe support Barsha (future)", "Traitera les tickets, les retours et les demandes RGPD."],
            ["Vendeurs partenaires (marketplace)", "Approvisionneront le catalogue marketplace et géreront leurs fulfillments."],
            ["Clients finaux et visiteurs", "Utilisent le storefront pour acheter."],
            ["Comptable / fiscaliste Barsha", "Reçoit les exports ERP et garantit la conformité TTN."],
        ],
        col_widths_cm=[5.0, 11.0],
        first_col_bold=True,
    )

    heading(doc, "4.2 Acteurs UML du système", level=2)
    para(doc,
        "Du point de vue de la modélisation UML, on identifie les acteurs principaux suivants. "
        "Le diagramme de cas d'utilisation détaillé est disponible dans les annexes.")
    bullet(doc, "Visiteur : utilisateur non authentifié, peut naviguer le catalogue, rechercher, dialoguer avec l'assistant IA.")
    bullet(doc, "Client : visiteur authentifié, peut commander, gérer son compte, ses favoris, ses retours, ses demandes RGPD.")
    bullet(doc, "Vendeur : utilisateur marketplace authentifié, peut soumettre une candidature, gérer ses produits et ses fulfillments, consulter ses payouts.")
    bullet(doc, "Administrateur : super-utilisateur disposant d'un accès complet au back-office (catalogue, commandes, marketing, conformité).")
    bullet(doc, "Système IA : acteur logique englobant Ollama, CLIP et l'ai-service FastAPI ; participe aux cas d'usage chatbot, recherche visuelle, recommandations et modération.")
    bullet(doc, "Passerelles externes : SMTP, SMS, CTP, FirstDelivery/Aramex, TTN — acteurs systèmes participant aux paiements, livraisons et notifications.")

    page_break(doc)

    # =================================================================
    # CHAPITRE 5 — EXIGENCES FONCTIONNELLES
    # =================================================================
    heading(doc, "5. Exigences fonctionnelles mises à jour", level=1)

    justified(doc,
        "Cette section consolide les 19 exigences fonctionnelles initiales (F01 à F19) et les "
        "complète par les exigences ajoutées pendant la réalisation (F20 à F75). Toutes ces "
        "exigences sont implémentées dans le périmètre final livré.")

    heading(doc, "5.1 Exigences originales — état d'implémentation", level=2)
    table(doc,
        ["ID", "Fonctionnalité", "Module(s) NestJS", "Statut"],
        [
            ["F01", "Page d'accueil avec produits phares, promotions, catégories", "products, categories, admin", "Livré"],
            ["F02", "Pages catégorie avec filtres et tri", "categories, products", "Livré"],
            ["F03", "Fiche produit (images, description, prix, tailles, ajout panier)", "products, cart", "Livré"],
            ["F04", "Panier (ajout, suppression, modif. quantités, total)", "cart", "Livré"],
            ["F05", "Tunnel d'achat (validation panier, adresse, confirmation)", "orders, payments", "Livré"],
            ["F06", "Inscription / connexion / mot de passe oublié", "auth, users", "Livré"],
            ["F07", "Profil utilisateur (compte, adresses, historique, préférences)", "users, orders", "Livré"],
            ["F08", "Favoris (wishlist)", "wishlist", "Livré (étendu : collections, partage)"],
            ["F09", "Recherche par nom / référence avec suggestions", "search, ai (visuel)", "Livré"],
            ["F10", "Filtres (catégorie, prix, taille, couleur, dispo)", "products, search", "Livré"],
            ["F11", "Coupons / promotions (code promo + calcul réduction)", "promotions", "Livré (étendu : pricing rules auto)"],
            ["F12", "Demande de retour (formulaire, motif, statut)", "orders (return-request)", "Livré"],
            ["F13", "Produits associés (cross-sell sur la fiche)", "recommendations", "Livré"],
            ["F14", "Assistant Barsha — chatbot LLM", "ai (Ollama)", "Livré"],
            ["F15", "Recommandations IA personnalisées", "recommendations, ai-service", "Livré (multi-stratégies v3)"],
            ["F16", "Recherche visuelle (image → produits similaires)", "ai (CLIP)", "Livré"],
            ["F17", "Google Analytics — suivi trafic, événements", "analytics", "Livré (analytics interne + intégration GA prête)"],
            ["F18", "SEO (balises, breadcrumbs, URLs propres)", "products, cms", "Livré"],
            ["F19", "Thème / charte graphique cohérente avec Barsha", "frontend Angular", "Livré"],
        ],
        col_widths_cm=[1.2, 6.5, 4.0, 4.3],
        first_col_bold=True,
    )

    heading(doc, "5.2 Exigences fonctionnelles ajoutées (post-baseline)", level=2)
    para(doc,
        "Les exigences suivantes ont été ajoutées au périmètre pendant la réalisation et sont "
        "toutes implémentées dans la version finale livrée.")
    table(doc,
        ["ID", "Fonctionnalité", "Module(s) NestJS"],
        [
            ["F20", "Multi-vendeurs (onboarding, KYC, statuts)", "marketplace"],
            ["F21", "Seller fulfillments (produit vendeur expédié indépendamment)", "marketplace"],
            ["F22", "Seller payouts (commission, calcul net, périodes)", "marketplace"],
            ["F23", "Multi-entrepôts (warehouses) avec stock par site", "warehouses"],
            ["F24", "Réservation stock atomique au passage de commande", "warehouses, orders"],
            ["F25", "Safety stock + alertes rupture", "warehouses, alerts"],
            ["F26", "Reviews produits (notes 1-5, votes utiles)", "reviews"],
            ["F27", "Q&A produits (questions clients, réponses staff)", "product-qa"],
            ["F28", "Support helpdesk (tickets, conversations, canned responses)", "support"],
            ["F29", "FAQ et base de connaissance", "faq"],
            ["F30", "Notifications utilisateur multi-canaux (in-app, email, SMS)", "notifications, email, sms"],
            ["F31", "Alertes prix-baisse / back-in-stock", "alerts"],
            ["F32", "Newsletter (campagnes, abonnés, désabonnement)", "newsletter"],
            ["F33", "Lifecycle marketing automation (drips déclenchés par événement)", "lifecycle"],
            ["F34", "Subscriptions (achats récurrents avec pause/skip/cancel)", "subscriptions"],
            ["F35", "Preorder / product drops (réservations, dépôts)", "preorder"],
            ["F36", "Bundles produits", "bundles"],
            ["F37", "Configurator (composer son produit)", "configurator"],
            ["F38", "Dynamic pricing (règles auto + sweep + approbations)", "dynamic-pricing"],
            ["F39", "Gift cards numériques (achat, redemption, balance)", "gift-cards"],
            ["F40", "Programme de fidélité (points, paliers, redemption)", "loyalty"],
            ["F41", "Programme de parrainage (codes, suivi, récompenses)", "referrals"],
            ["F42", "B2B wholesale (comptes, devis, listes de prix)", "b2b"],
            ["F43", "CMS — page builder + révisions + publication", "cms"],
            ["F44", "Outfits / inspirations (par occasion, par produit)", "outfits"],
            ["F45", "Sizing assistant (chartes + profils utilisateurs)", "sizing"],
            ["F46", "Conformité fiscale Tunisie (TTN — émission reçus)", "fiscal"],
            ["F47", "RGPD self-service (export et effacement par le client)", "gdpr"],
            ["F48", "Détection fraude (signaux, file admin, fingerprinting)", "fraud"],
            ["F49", "UGC moderation IA (file, scoring, validation)", "ugc-moderation"],
            ["F50", "Propensity scoring (CLV, churn, next-purchase)", "propensity"],
            ["F51", "Suivi de livraison temps réel (FirstDelivery, Aramex)", "shipping"],
            ["F52", "Webhook transporteur (mise à jour statut auto)", "shipping"],
            ["F53", "Integrations email (SMTP avec tracking pixels + clicks)", "email"],
            ["F54", "Integrations SMS (Twilio, Infobip, console dev)", "sms"],
            ["F55", "Feature flags + A/B testing + rollouts", "feature-flags"],
            ["F56", "Analytics interne (funnel, recently viewed, search queries)", "analytics"],
            ["F57", "Replenishment fournisseurs (suppliers, purchase orders)", "replenishment"],
            ["F58", "Dashboard admin avec KPIs temps réel", "admin"],
            ["F59", "Customer 360° (vue unifiée client)", "admin, wave4"],
            ["F60", "Journal d'activité (audit trail) côté admin", "wave4, observability"],
            ["F61", "Analytics recherche (top queries, no-results)", "analytics"],
            ["F62", "Paniers abandonnés (vue admin + relance auto)", "lifecycle"],
            ["F63", "Mouvements de stock (audit complet)", "analytics"],
            ["F64", "Import / export CSV produits + clients + commandes", "admin, erp"],
            ["F65", "Segmentation clients (tags, notes, signaux)", "wave4"],
            ["F66", "Customer tasks board (Kanban opérationnel)", "wave4"],
            ["F67", "Delivery slots (créneaux de livraison)", "wave4"],
            ["F68", "Pickup locations (points relais)", "wave4"],
            ["F69", "Daily deals (offres flash quotidiennes)", "wave4"],
            ["F70", "AI Stylist (recommandations tenue par occasion)", "ai (stylist)"],
            ["F71", "Chatbot grounding produits (recherche augmentée)", "ai-service"],
            ["F72", "Service worker offline + PWA install", "frontend"],
            ["F73", "CDN-ready (immutable assets, no-cache SW)", "frontend, deploy"],
            ["F74", "Production-safety preflight au boot", "main.ts"],
            ["F75", "Migrations versionnées + drift detection + rollback", "scripts/run-migrations"],
        ],
        col_widths_cm=[1.2, 9.5, 5.3],
        first_col_bold=True,
    )

    page_break(doc)

    # =================================================================
    # CHAPITRE 6 — EXIGENCES NON FONCTIONNELLES
    # =================================================================
    heading(doc, "6. Exigences non fonctionnelles mises à jour", level=1)

    table(doc,
        ["Catégorie", "Exigence", "Implémentation"],
        [
            ["Performance", "Page produit < 3 s en P95 sur 4G mobile", "Service worker + lazy loading Angular + cache headers immutables ; budget CSS / JS surveillé au build."],
            ["Performance", "Indexation Meilisearch < 30 s pour catalogue complet", "Index unique products avec tokenisation FR + synonymes ; reindex incrémental sur events."],
            ["Sécurité", "Authentification JWT + bcrypt + RBAC", "@nestjs/jwt + bcrypt 12 rounds ; rôles user/seller/admin via JwtAuthGuard."],
            ["Sécurité", "Préflight production refuse JWT_SECRET par défaut", "main.ts §16-45 — exit 1 si secret par défaut en NODE_ENV=production."],
            ["Sécurité", "Protection XSS / CSRF / injection", "ValidationPipe global + class-validator + ORM paramétré (TypeORM) + CORS allowlist."],
            ["Sécurité", "Chiffrement HTTPS bout-en-bout", "nginx + Let's Encrypt en production (sample.conf fourni) ; HSTS 1 an."],
            ["Disponibilité", "Dégradation gracieuse en cas de panne externe", "Tous les services externes (SMTP, SMS, Meilisearch, Ollama, CTP) ont un fallback poli, l'app ne crashe jamais."],
            ["Disponibilité", "Healthcheck applicatif", "/health endpoint renvoie le statut des services externes ; Dockerfile HEALTHCHECK paramétré."],
            ["Ergonomie", "Interface intuitive, parcours fluides", "Design system primeng + composants Angular standalone ; storefront premium responsive."],
            ["Ergonomie", "Accessibilité minimale (a11y)", "Sémantique HTML5, ARIA labels sur composants critiques, contrastes vérifiés."],
            ["Responsive", "Mobile, tablette, desktop", "Breakpoints SCSS mobile-first ; testé sur Chrome, Edge, Safari iOS, Firefox."],
            ["Maintenabilité", "Code structuré, modulaire, documenté", "NestJS modules indépendants (>50) + Angular standalone components ; 3 docs techniques (ARCHITECTURE, AI_ARCHITECTURE, DEPLOYMENT)."],
            ["Maintenabilité", "Migrations versionnées avec drift detection", "scripts/run-migrations.ts + table _migration_history + checksums djb2."],
            ["Évolutivité", "Architecture extensible (nouveaux modules sans refonte)", "EventBus interne + outbox persistante (domain_events) ; séparation IA via FastAPI satellite."],
            ["Évolutivité", "DB-agnostic (mssql / postgres / sqlite)", "TypeORM avec configuration multi-driver dans database.module.ts."],
            ["SEO", "Balisage sémantique, URLs propres, sitemap", "Slugs partout (products, categories, cms-pages) ; meta_title et meta_description configurables."],
            ["RGPD / Cookies", "Bandeau consentement + politique confidentialité", "Composants Angular dédiés ; GDPR module backend pour les requêtes export/effacement."],
            ["RGPD / Cookies", "Self-service export et effacement", "Endpoints storefront/gdpr/* + admin/gdpr/run-export et /run-erasure."],
            ["Analytics", "Traçabilité actions utilisateur + KPIs", "Module analytics + funnel_events + admin_log ; Customer 360° dans wave4."],
            ["Observabilité", "Event bus + audit trail", "platform/events module avec EventBusService + outbox + audit (CustomerNote, AdminTask, AuditDiff)."],
            ["Industrialisation", "Déploiement reproductible (docker-compose)", "docker-compose.yml + docker-compose.staging.yml + .env.staging.example."],
            ["Industrialisation", "Documentation runbook", "DEPLOYMENT.md (15 sections) + SOUTENANCE_PREFLIGHT.md."],
        ],
        col_widths_cm=[2.8, 6.5, 6.7],
        first_col_bold=True,
    )

    page_break(doc)

    # =================================================================
    # CHAPITRE 7 — IA
    # =================================================================
    heading(doc, "7. Exigences IA mises à jour", level=1)

    heading(doc, "7.1 Trois briques planifiées (v1)", level=2)
    bullet(doc, "Assistant conversationnel : LLM répondant aux questions clients et guidant l'achat.")
    bullet(doc, "Recommandation personnalisée : suggestions adaptées au profil et comportement.")
    bullet(doc, "Recherche visuelle : recherche par image (CLIP / API vision).")

    heading(doc, "7.2 Cinq briques effectivement livrées (v2)", level=2)
    table(doc,
        ["Brique", "Technologie", "Description"],
        [
            ["Chatbot conversationnel", "Ollama qwen2.5:7b local + fallback Gemini / OpenRouter", "Répond aux questions, propose des produits via grounding Meilisearch, garde le contexte de la conversation. Endpoint NestJS POST /api/ai/chat."],
            ["Recherche visuelle", "CLIP (OpenAI) via PyTorch local", "Encode l'image uploadée en vecteur 512d, kNN cosine sur l'index produits. Endpoint NestJS POST /api/ai/like-this."],
            ["Recommandations multi-stratégies", "scikit-learn + heuristiques métier", "8+ stratégies : trending, new-arrivals, seasonal, editorial, personalized, complementary, cart-based, bundle. Endpoint /api/recommendations/v3."],
            ["Modération UGC", "Pipeline Python (text + image)", "Modère reviews et photos clients via heuristiques + LLM ; file admin avec validation manuelle."],
            ["Propensity scoring (CLV, churn, next-purchase)", "Heuristiques + signaux comportementaux", "Score chaque utilisateur sur trois axes ; alerte les clients à risque de churn."],
            ["AI stylist (bonus)", "Chat structuré sur Ollama", "Répond à 'que porter pour mariage ?' avec une tenue cohérente issue du catalogue."],
        ],
        col_widths_cm=[3.8, 4.5, 7.7],
        first_col_bold=True,
    )

    heading(doc, "7.3 Limites assumées et précautions", level=2)
    bullet(doc, "Le LLM local Qwen 2.5 7B nécessite ~5 GB de RAM ; sans GPU, la génération est de l'ordre de 10-30 tokens/s, suffisant pour un usage démonstrateur.")
    bullet(doc, "Les embeddings CLIP sont calculés au démarrage de l'ai-service et mis en cache ; un produit ajouté apparaît dans la recherche visuelle après une réindexation déclenchée par event.")
    bullet(doc, "Les recommandations sont basées sur des heuristiques + similarité catégorielle/visuelle ; un vrai modèle de recommandation collaborative sur trafic massif est une perspective.")
    bullet(doc, "La modération UGC est non bloquante : un post passe en état pending et n'apparaît publiquement qu'après validation admin.")
    bullet(doc, "Tous les services IA dégradent gracieusement en cas d'indisponibilité : le storefront ne crashe jamais sur une panne IA.")

    page_break(doc)

    # =================================================================
    # CHAPITRE 8 — BACK-OFFICE
    # =================================================================
    heading(doc, "8. Exigences back-office (admin) mises à jour", level=1)

    justified(doc,
        "Le cahier v1 prévoyait un « back-office » sans en détailler le contenu. La version 2 "
        "explicite le périmètre administrateur effectivement livré : plus de 30 pages "
        "fonctionnelles, regroupées en onglets thématiques.")

    table(doc,
        ["Domaine", "Pages back-office Angular"],
        [
            ["Pilotage", "Dashboard KPIs, Customer 360°, Journal d'activité, Analytics IA"],
            ["Catalogue", "Produits, Catégories, Bundles, Outfits, CMS pages, Configurateurs, Sizing charts"],
            ["Stock & approvisionnement", "Warehouses, Mouvements stock, Alertes rupture, Suppliers, Purchase orders"],
            ["Commerce", "Commandes, Retours (RMA), Coupons, Cartes cadeaux, Dynamic pricing, Drops/preorder, Subscriptions"],
            ["Marketplace", "Sellers (validation), Seller fulfillments, Seller payouts"],
            ["Marketing", "Campagnes newsletter, Lifecycle drips, Segments, Banners, A/B tests, Daily deals"],
            ["Relation client", "Support tickets, FAQ, Reviews, Q&A, Notifications broadcast"],
            ["Conformité & sécurité", "Fiscal/TTN, GDPR queue, Fraude (signaux), UGC moderation"],
            ["Opérations", "Tasks board, Delivery slots, Pickup locations, Customer notes/tags, Email analytics, SMS analytics"],
            ["Système", "Feature flags, Plateforme événements, Replenishment B2B, ERP exports"],
        ],
        col_widths_cm=[3.8, 12.2],
        first_col_bold=True,
    )

    page_break(doc)

    # =================================================================
    # CHAPITRE 9 — STOREFRONT CLIENT
    # =================================================================
    heading(doc, "9. Exigences storefront / client mises à jour", level=1)

    table(doc,
        ["Domaine", "Pages / fonctions storefront"],
        [
            ["Découverte", "Page d'accueil + flash sale + featured + recommandations 'Pour vous' + tendances"],
            ["Catalogue", "Catégories (femme/homme/enfant/accessoires/nouveautés/soldes) avec filtres dynamiques + tri + pagination"],
            ["Recherche", "Barre de recherche full-text Meilisearch + suggestions + recherche visuelle (upload image) + page résultats"],
            ["Produit", "Fiche produit complète : galerie zoomable, variantes (couleurs, tailles), avis, Q&A, recommandations cross/up-sell, recently viewed"],
            ["Achat", "Panier persistant + validation, application coupons, calcul taxes/livraison, choix CTP / COD"],
            ["Compte", "Mes commandes, suivi livraison, retours, adresses, profil, fidélité, parrainage, notifications, demandes RGPD"],
            ["Wishlist", "Listes multiples, partage, déplacement vers panier"],
            ["Assistant IA", "Chat ouvrable depuis n'importe quelle page, contexte panier/wishlist injecté"],
            ["Marketplace", "Pages vendeur public + filtre 'vendu par' + indication marketplace sur fiches"],
            ["Inspiration", "Outfits par occasion, daily deals, drops à venir"],
            ["B2B", "Espace pro (devis, listes prix, inscription pro)"],
            ["Support", "FAQ + ouverture de ticket + suivi"],
            ["Légal", "RGPD self-service, mentions légales, CGV/CGU, politique cookies"],
        ],
        col_widths_cm=[3.8, 12.2],
        first_col_bold=True,
    )

    page_break(doc)

    # =================================================================
    # CHAPITRE 10 — MARKETPLACE
    # =================================================================
    heading(doc, "10. Exigences marketplace / vendeur (nouveau)", level=1)

    justified(doc,
        "Le cahier v1 ne mentionnait pas de modèle marketplace. La v2 ajoute un module complet "
        "permettant l'onboarding et la gestion de vendeurs partenaires. Cette extension est "
        "transparente côté client (le storefront reste unifié) mais ajoute trois flux côté admin "
        "et un espace vendeur autonome.")

    heading(doc, "10.1 Onboarding vendeur", level=2)
    bullet(doc, "Formulaire de candidature publique (POST /api/storefront/seller/apply).")
    bullet(doc, "File de validation admin (approve / reject avec motif).")
    bullet(doc, "Statuts : PENDING, APPROVED, REJECTED, SUSPENDED.")
    bullet(doc, "Champs KYC : business_name, legal_name, payout_bank_name, IBAN, taux de commission.")

    heading(doc, "10.2 Catalogue vendeur", level=2)
    bullet(doc, "Chaque produit peut être rattaché à un seller (seller_id nullable).")
    bullet(doc, "Le vendeur gère ses propres produits, prix, stock (via son espace ou via un import).")
    bullet(doc, "Le storefront affiche un badge 'Vendeur partenaire' sur les fiches concernées.")

    heading(doc, "10.3 Fulfillments mixés", level=2)
    bullet(doc, "Une commande peut contenir des items Barsha + items vendeurs.")
    bullet(doc, "Pour chaque item vendeur, un seller_fulfillment est créé avec son cycle de vie indépendant (PENDING → SHIPPED → DELIVERED ou CANCELLED).")
    bullet(doc, "L'OrderStatus global supporte les états PARTIALLY_SHIPPED et PARTIALLY_DELIVERED quand seuls certains items vendeurs sont avancés.")
    bullet(doc, "Lifecycle drips dédiés : seller.fulfillment.shipped, seller.fulfillment.delivered, seller.fulfillment.cancelled.")

    heading(doc, "10.4 Payouts vendeurs", level=2)
    bullet(doc, "Calcul périodique (admin/marketplace/compute-payouts).")
    bullet(doc, "Pour chaque vendeur sur la période : gross_amount = somme des items livrés, commission = gross × commission_rate, net_amount = gross − commission.")
    bullet(doc, "Statuts paiement : PENDING → PROCESSED (après virement bancaire admin).")
    bullet(doc, "Vue admin avec stats globales et liste paginée + vue vendeur 'mes payouts'.")

    page_break(doc)

    # =================================================================
    # CHAPITRE 11 — OPÉRATIONS / DÉPLOIEMENT
    # =================================================================
    heading(doc, "11. Exigences opérationnelles et de déploiement", level=1)

    heading(doc, "11.1 Migrations de schéma", level=2)
    bullet(doc, "Runner de migration standalone (backend/scripts/run-migrations.ts) : pas de dépendance NestJS, lit process.env directement.")
    bullet(doc, "Variantes par moteur (.sql, .postgres.sql, .sqlite.sql) avec fallback.")
    bullet(doc, "Table _migration_history avec checksum djb2 pour drift detection.")
    bullet(doc, "Idempotent — chaque migration utilise IF NOT EXISTS / OBJECT_ID IS NULL.")
    bullet(doc, "Rollback ciblé (--rollback ID).")
    bullet(doc, "Commands : npm run migrate / migrate:dry / migrate:rollback (ts-node) ; migrate:prod / migrate:prod:dry / migrate:prod:rollback (compiled JS, sans ts-node).")

    heading(doc, "11.2 Préflight de sécurité au boot", level=2)
    bullet(doc, "En NODE_ENV=production, refuse de démarrer si JWT_SECRET est vide ou égal au placeholder par défaut (exit 1).")
    bullet(doc, "Avertissements soft (non bloquants) pour : JWT_SECRET court (<32), EMAIL_ENABLED sans SMTP_USER, SMS_ENABLED sans credentials provider, CTP_SANDBOX_MODE != 'false'.")

    heading(doc, "11.3 Configuration par environnement", level=2)
    bullet(doc, "Fichier .env.example exhaustif (38 variables, 9 groupes : DB, JWT, CORS, App URLs, Search, AI, Payment, Email, SMS, Shipping, Loyalty, Alerts, Fiscal, Admin seed).")
    bullet(doc, ".env.staging.example pour le déploiement single-host docker-compose.")
    bullet(doc, "Politique : seul JWT_SECRET est strictement requis ; tous les autres ont une dégradation gracieuse.")

    heading(doc, "11.4 Empaquetage", level=2)
    bullet(doc, "Backend : multi-stage Dockerfile (node:20-alpine builder → runtime), bundle dist + migrations.")
    bullet(doc, "AI service : Dockerfile python:3.11-slim avec cache CLIP weights.")
    bullet(doc, "Frontend : ng build --configuration production → dist/barsha/browser/, servi par nginx (sample.conf + staging.conf fournis).")
    bullet(doc, "docker-compose.yml — pile IA seule (Ollama + ai-service + backend).")
    bullet(doc, "docker-compose.staging.yml — pile complète single-host (MSSQL 2022 + Meilisearch 1.6 + Ollama + ai-service + backend + frontend nginx).")

    heading(doc, "11.5 Observabilité", level=2)
    bullet(doc, "Event bus interne (platform/events) avec outbox persistante (domain_events).")
    bullet(doc, "Audit trail (CustomerNote, OrderComment, AdminTask, AuditDiff) pour les actions administrateur.")
    bullet(doc, "/health endpoint renvoyant le statut des dépendances externes.")
    bullet(doc, "Logs structurés NestJS (Logger) avec préfixes par module.")

    page_break(doc)

    # =================================================================
    # CHAPITRE 12 — CONTRAINTES & HYPOTHÈSES
    # =================================================================
    heading(doc, "12. Contraintes et hypothèses mises à jour", level=1)

    heading(doc, "12.1 Contraintes techniques", level=2)
    bullet(doc, "TypeScript 5.3+ pour le backend, Angular 19 pour le frontend.")
    bullet(doc, "Base de données primaire MSSQL 2022 (postgres et sqlite supportés en fallback).")
    bullet(doc, "Service IA en Python 3.11+ avec PyTorch 2 et transformers 4.")
    bullet(doc, "Ollama avec modèle local (qwen2.5:7b par défaut, paramétrable).")
    bullet(doc, "Meilisearch v1.6+ pour la recherche full-text.")
    bullet(doc, "Java 21 LTS uniquement pour l'outillage (PlantUML), non requis en production.")

    heading(doc, "12.2 Contraintes réglementaires", level=2)
    bullet(doc, "RGPD (UE) — bandeau cookies, politique de confidentialité, self-service export et effacement.")
    bullet(doc, "TTN fiscal Tunisie — émission de reçus pour les commandes ; sandbox par défaut, branchable en live.")
    bullet(doc, "Loi tunisienne sur la protection des données personnelles n° 2004-63 — alignée via les mécanismes RGPD.")

    heading(doc, "12.3 Contraintes financières (estimations indicatives)", level=2)
    bullet(doc, "Hébergement cloud (AWS / Azure / OVH) : 50–150 €/mois en démarrage.")
    bullet(doc, "Meilisearch managé (option) : ~30 €/mois ; auto-hébergé : 0 €.")
    bullet(doc, "Inférence LLM : Ollama auto-hébergé (0 € en CPU) ou cloud Gemini API (paiement à l'usage).")
    bullet(doc, "Domaine + SSL : ~15 €/an (Let's Encrypt gratuit).")
    bullet(doc, "Total infra estimé : 80–250 €/mois pour démarrer.")

    heading(doc, "12.4 Hypothèses retenues", level=2)
    bullet(doc, "Trafic initial < 10 000 visiteurs/jour ; au-delà, dimensionnement du backend et de la DB à revoir.")
    bullet(doc, "Catalogue cible : 1 000 à 10 000 SKU.")
    bullet(doc, "Vendeurs marketplace cibles : moins de 50 partenaires en première année.")
    bullet(doc, "Commandes simultanées : la conception (réservation stock atomique, event bus async) supporte plusieurs centaines de commandes/heure sans modification.")

    page_break(doc)

    # =================================================================
    # CHAPITRE 13 — LIVRABLES
    # =================================================================
    heading(doc, "13. Livrables mis à jour", level=1)

    table(doc,
        ["Livrable", "Statut", "Référence"],
        [
            ["Code source backend NestJS", "Livré", "backend/ (50+ modules, 80+ entités)"],
            ["Code source frontend Angular", "Livré", "src/ (storefront + admin)"],
            ["Code source IA Python", "Livré", "ai-service/ (FastAPI + CLIP + Ollama client)"],
            ["Migrations versionnées + runner", "Livré", "backend/migrations/ + scripts/run-migrations.ts"],
            ["Schéma de données + seeds", "Livré", "src/database/seed.ts + seed-full.ts"],
            ["Documentation architecture", "Livré", "docs/ARCHITECTURE.md, AI_ARCHITECTURE.md, AI_MODULES.md"],
            ["Documentation déploiement", "Livré", "DEPLOYMENT.md (15 sections)"],
            ["Cahier des charges v1 (baseline)", "Conservé", "Cahier_des_charges_Barsha.docx"],
            ["Cahier des charges v2 (final)", "Livré", "docs/Cahier_des_charges_Barsha_v2.docx"],
            ["Rapport PFE jury", "Livré", "docs/Rapport_PFE_Barsha_Soutenance.docx"],
            ["Annexes UML (PlantUML)", "Livré", "docs/Annexes_UML_Barsha.docx + docs/_build/puml/"],
            ["Scénario de démonstration soutenance", "Livré", "docs/DEMO_SCENARIO.md, SOUTENANCE_PREFLIGHT.md"],
            ["Docker compose staging", "Livré", "docker-compose.yml, docker-compose.staging.yml"],
            ["Configuration nginx", "Livré", "deploy/nginx.sample.conf, nginx.staging.conf"],
            ["Templates env (dev + staging)", "Livré", "backend/.env.example, .env.staging.example"],
            ["Rapport de tests (UAT)", "Livré", "docs/TEST_REPORT.md + section soutenance"],
            ["Démonstrateur déployé", "Démonstrable", "docker compose up -d → http://localhost"],
        ],
        col_widths_cm=[5.5, 2.2, 8.3],
        first_col_bold=True,
    )

    page_break(doc)

    # =================================================================
    # CHAPITRE 14 — CRITÈRES DE RECETTE
    # =================================================================
    heading(doc, "14. Critères de recette mis à jour", level=1)

    table(doc,
        ["Critère", "Indicateur de validation", "Statut"],
        [
            ["Modules fonctionnels", "Toutes les exigences haute priorité (F01-F19) sont opérationnelles", "Validé"],
            ["Modules ajoutés (F20+)", "Tous les modules post-baseline livrés et accessibles via l'API", "Validé (50+ modules)"],
            ["Parcours d'achat", "Un utilisateur navigue, ajoute au panier, passe commande sans erreur", "Validé"],
            ["Performance", "Pages principales en < 3 s sur connexion standard", "Validé (frontend optimisé, lazy loading)"],
            ["Responsive", "Affichage correct sur mobile, tablette, desktop", "Validé"],
            ["Assistant IA", "Réponses pertinentes dans ≥ 80 % des cas testés", "Validé (Ollama qwen2.5:7b)"],
            ["Recommandations IA", "Suggestions cohérentes avec le profil utilisateur", "Validé (8+ stratégies, fallback graceful)"],
            ["Recherche visuelle", "Résultats pertinents pour des images de test", "Validé (CLIP cosine top-N)"],
            ["Marketplace", "Vendeur peut postuler, être validé, vendre", "Validé"],
            ["Multi-entrepôts", "Réservation stock atomique sur passage commande", "Validé"],
            ["RGPD self-service", "Client peut demander export et effacement", "Validé"],
            ["Conformité fiscale (TTN)", "Émission reçu fiscal sur chaque commande", "Validé (sandbox actif)"],
            ["Préflight production", "Refus de boot si JWT_SECRET par défaut", "Validé (testé manuellement)"],
            ["Migrations", "Runner applique, vérifie idempotence, détecte drift", "Validé contre MSSQL réel"],
            ["Build de production", "nest build et ng build --configuration production sans erreur", "Validé (zéro erreur, warnings CSS budget seulement)"],
            ["Conformité", "Respect du cahier des charges fonctionnel v2", "Validé"],
        ],
        col_widths_cm=[3.5, 8.0, 4.5],
        first_col_bold=True,
    )

    page_break(doc)

    # =================================================================
    # CHAPITRE 15 — RISQUES
    # =================================================================
    heading(doc, "15. Risques et mitigation mis à jour", level=1)

    table(doc,
        ["Risque", "Impact", "Probabilité", "Mitigation"],
        [
            ["Dérive du périmètre (scope creep)", "Élevé", "Élevée (réalisée)", "Versionnement explicite du cahier (v1 → v2), rapport de mise à jour, gel de fonctionnalité avant soutenance."],
            ["Performance du LLM local insuffisante", "Moyen", "Moyenne", "Fallback cloud Gemini / OpenRouter ; modèle paramétrable (OLLAMA_MODEL) ; mode dégradé poli."],
            ["Indisponibilité d'un service externe (SMTP / CTP / Meilisearch)", "Moyen", "Faible-Moyenne", "Dégradation gracieuse systématique : warning au démarrage, fallback fonctionnel, jamais de crash."],
            ["Drift de schéma DB en production", "Élevé", "Faible", "_migration_history avec checksums djb2 + rapport drift en sortie de runner."],
            ["Boot accidentel en production avec secret par défaut", "Critique", "Faible", "Préflight main.ts qui refuse de démarrer (exit 1 + message FATAL)."],
            ["Schéma initial absent sur DB fraîche", "Élevé", "Moyenne", "Procédure documentée DEPLOYMENT.md §15.3 — bootstrap one-shot en NODE_ENV=development puis switch production."],
            ["Conformité RGPD non respectée sur ex-clientèle UE", "Élevé", "Faible", "Module gdpr complet (export, effacement, vérification) + bandeau cookies + politique."],
            ["Litige fiscal (Tunisie) à la mise en service", "Élevé", "Faible", "Fiscal/TTN branchable, sandbox par défaut, à activer après obtention du compte fournisseur agréé."],
            ["Vendeur marketplace frauduleux", "Moyen", "Moyenne", "Onboarding KYC + workflow d'approbation manuelle + module fraude (signaux)."],
            ["Indisponibilité du jury / de l'environnement de démo", "Moyen", "Faible", "Plan B documenté (SOUTENANCE_PREFLIGHT.md §5) : environnement de secours, fallback talking points."],
            ["Couverture de tests insuffisante", "Moyen", "Élevée", "Documenté en limite assumée ; test plan UAT manuel exhaustif réalisé ; suite jest configurée pour extension future."],
            ["Saturation de l'index Meilisearch", "Faible", "Faible", "Catalogue cible < 10 000 SKU ; reindex incrémental via events."],
        ],
        col_widths_cm=[4.5, 1.8, 2.0, 7.7],
        first_col_bold=True,
    )

    page_break(doc)

    # =================================================================
    # CHAPITRE 16 — TRAÇABILITÉ
    # =================================================================
    heading(doc, "16. Matrice de traçabilité v1 → v2", level=1)

    justified(doc,
        "Cette matrice met en correspondance chaque exigence de la version 1 du cahier des "
        "charges avec son implémentation effective dans le code final. La colonne 'commentaire' "
        "indique les évolutions ou enrichissements éventuels par rapport à la spécification "
        "originale.")

    table(doc,
        ["ID v1", "Exigence v1", "Module(s) NestJS", "Frontend Angular", "État final", "Commentaire"],
        [
            ["F01", "Page d'accueil", "products, categories, admin, storefront", "src/app/components/pages/home", "Livré", "Hero + flash sale + sections featured + recommandations IA + tendances."],
            ["F02", "Pages catégorie", "categories, products", "category", "Livré", "Filtres dynamiques, tri, pagination, breadcrumbs SEO, slugs, Meta tags."],
            ["F03", "Fiche produit", "products, ai (recently-viewed), reviews, product-qa", "detail-produit", "Livré", "Galerie zoomable, variantes, Q&A, reviews, recommandations multi-stratégies."],
            ["F04", "Panier", "cart", "panier", "Livré", "Persistant, application coupons + pricing rules auto."],
            ["F05", "Tunnel d'achat", "orders, payments, promotions, fiscal, lifecycle", "checkout", "Livré", "CTP / COD, calcul taxes, génération reçu fiscal, lifecycle post-achat."],
            ["F06", "Inscription / connexion", "auth, users, otp", "sign", "Livré", "JWT + OTP optionnel + reset-password ; bcrypt 12 rounds."],
            ["F07", "Profil utilisateur", "users, orders, addresses", "compte", "Livré", "Plus : fidélité, parrainage, demandes RGPD, sizing profile."],
            ["F08", "Favoris", "wishlist", "wishlist", "Livré", "Étendu : collections multiples, partage, déplacement vers panier."],
            ["F09", "Recherche", "search, ai (visuel)", "search-modal", "Livré", "Meilisearch + recherche visuelle CLIP + suggestions."],
            ["F10", "Filtres", "products, search", "filtres dans pages catégorie", "Livré", "Filtres dynamiques côté backend ; performance préservée par index."],
            ["F11", "Coupons / promotions", "promotions", "checkout, admin/coupons", "Livré", "Étendu : pricing-rule auto sans saisie de code, gift-cards séparées."],
            ["F12", "Demande de retour", "orders (return-request)", "compte/retour, admin/returns", "Livré", "Self-service depuis le profil + workflow admin."],
            ["F13", "Produits associés", "recommendations", "carrousels sur fiche produit", "Livré", "8+ stratégies ; v3 endpoint dédié."],
            ["F14", "Assistant Barsha (chatbot)", "ai (Ollama)", "chatbot widget", "Livré", "Ollama local + fallback Gemini ; grounding produits."],
            ["F15", "Recommandations IA", "recommendations, ai-service", "carrousels personnalisés", "Livré", "Étendu : trending, new-arrivals, seasonal, editorial, personalized, complementary, cart-based, bundle."],
            ["F16", "Recherche visuelle", "ai", "visual-search modal", "Livré", "CLIP local ; latence acceptable sur CPU."],
            ["F17", "Google Analytics", "analytics", "intégration GA4 prête", "Livré", "Plus : analytics interne (funnel, recently viewed, search queries, stock movements)."],
            ["F18", "SEO", "products, cms, categories", "meta tags, sitemaps, slugs", "Livré", "Slugs sur tous les contenus principaux ; CMS pages avec metadata complète."],
            ["F19", "Charte graphique Barsha", "—", "design system Angular + SCSS", "Livré", "Premium responsive, palette cohérente, typographie travaillée."],
        ],
        col_widths_cm=[1.0, 3.0, 3.5, 3.0, 1.8, 4.7],
        first_col_bold=True,
    )

    page_break(doc)

    # =================================================================
    # CONCLUSION
    # =================================================================
    heading(doc, "17. Conclusion du cahier des charges v2", level=1)

    justified(doc,
        "La présente version 2 du cahier des charges Barsha consolide en un document unique "
        "l'ensemble des exigences, contraintes et livrables effectivement réalisés à l'issue du "
        "projet de fin d'études. Elle remplace formellement la version 1 comme document de "
        "référence, tout en conservant celle-ci dans l'historique afin de tracer l'évolution du "
        "périmètre.")

    justified(doc,
        "Le projet a livré une plateforme dont la richesse fonctionnelle et la profondeur "
        "technique dépassent largement l'ambition initiale : passage d'un démonstrateur e-commerce "
        "intelligent à un véritable écosystème commerce omnicanal industrialisable, doté de "
        "modules marketplace, B2B, conformité réglementaire (RGPD + TTN), automatisation marketing "
        "et observabilité. Les briques d'intelligence artificielle initialement prévues sont "
        "toutes livrées et complétées par deux briques additionnelles (modération UGC et "
        "propensity scoring).")

    justified(doc,
        "Les limitations restantes — couverture de tests automatisés, multi-tenant SaaS, mise en "
        "production cloud avec credentials marchands réels — sont explicitement assumées et "
        "documentées comme perspectives post-PFE.")

    justified(doc,
        "Ce document, conjointement avec le rapport de soutenance et le code source versionné, "
        "constitue la documentation finale du projet et le support de référence pour toute "
        "évolution ultérieure de la plateforme Barsha.")

    # ============== DONE ==============
    out_path = os.path.normpath(os.path.join(
        os.path.dirname(__file__), "..", "Cahier_des_charges_Barsha_v2.docx"))
    doc.save(out_path)
    print(f"OK : {out_path}")
    return out_path


if __name__ == "__main__":
    build()
