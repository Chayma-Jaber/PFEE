# -*- coding: utf-8 -*-
"""
Generate docs/Rapport_PFE_Barsha_Soutenance.docx — full jury-quality PFE report.
Written in French, structured per the canonical PFE/génie logiciel layout.
Target: 50+ pages reflecting the real final implementation.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from build_helpers import (
    Document, set_default_styles, set_a4_margins,
    heading, para, justified, bullet, numbered,
    code_block, page_break, image, table, add_toc, page_numbers,
    Cm, Pt, RGBColor, WD_ALIGN_PARAGRAPH,
)


def cover_page(doc):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("UNIVERSITÉ — INSTITUT — ÉCOLE"); r.bold = True; r.font.size = Pt(13)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("[à compléter avec le nom de l'établissement]"); r.italic = True; r.font.size = Pt(11)

    for _ in range(3):
        doc.add_paragraph()

    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("MÉMOIRE DE PROJET DE FIN D'ÉTUDES"); r.bold = True; r.font.size = Pt(16)
    r.font.color.rgb = RGBColor(0x1F, 0x3A, 0x5F)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Spécialité Génie Logiciel"); r.italic = True; r.font.size = Pt(12)

    for _ in range(3):
        doc.add_paragraph()

    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Conception, développement et industrialisation d'une plateforme e-commerce intelligente avec marketplace multi-vendeurs et briques d'intelligence artificielle"); r.bold = True; r.font.size = Pt(20)
    r.font.color.rgb = RGBColor(0x1F, 0x3A, 0x5F)

    for _ in range(2):
        doc.add_paragraph()

    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("— Plateforme Barsha —"); r.italic = True; r.font.size = Pt(18)

    for _ in range(5):
        doc.add_paragraph()

    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Présenté par"); r.font.size = Pt(11)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Wassim MAROUANI"); r.bold = True; r.font.size = Pt(14)

    doc.add_paragraph()
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Encadrant académique"); r.font.size = Pt(11)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("[Nom de l'encadrant à compléter]"); r.italic = True; r.font.size = Pt(12)

    for _ in range(3):
        doc.add_paragraph()

    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Année universitaire 2025 — 2026"); r.font.size = Pt(12)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Soutenance — Avril 2026"); r.font.size = Pt(12)

    page_break(doc)


def dedicace(doc):
    heading(doc, "Dédicace", level=1)
    for _ in range(2):
        doc.add_paragraph()

    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("À mes parents,"); r.italic = True; r.font.size = Pt(13)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("dont la patience et le soutien indéfectibles ont rendu ce parcours possible.")
    r.italic = True; r.font.size = Pt(12)

    doc.add_paragraph()
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("À mes enseignants,"); r.italic = True; r.font.size = Pt(13)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("qui m'ont transmis non seulement des connaissances mais une exigence de rigueur.")
    r.italic = True; r.font.size = Pt(12)

    doc.add_paragraph()
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("À mes amis et camarades,"); r.italic = True; r.font.size = Pt(13)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("qui ont su accompagner les longues nuits de code et les doutes inhérents à tout projet d'envergure.")
    r.italic = True; r.font.size = Pt(12)

    page_break(doc)


def remerciements(doc):
    heading(doc, "Remerciements", level=1)
    justified(doc,
        "Je tiens en premier lieu à exprimer mes sincères remerciements à mon encadrant "
        "académique pour son accompagnement régulier, ses conseils éclairés et la rigueur "
        "qu'il a su m'imposer tout au long de ce projet de fin d'études. Ses retours critiques "
        "ont nettement contribué à la qualité du livrable final.")
    justified(doc,
        "J'exprime également ma reconnaissance à l'ensemble des enseignants de la formation "
        "Génie Logiciel, dont l'enseignement a constitué le socle théorique et pratique sur "
        "lequel ce travail a pu se construire. Les compétences mobilisées — architecture "
        "logicielle, bases de données, intelligence artificielle, génie des systèmes — sont "
        "le fruit direct de leurs cours et de leurs travaux dirigés.")
    justified(doc,
        "Mes remerciements s'adressent aux membres du jury pour le temps qu'ils consacrent à "
        "l'évaluation de ce mémoire et de la soutenance associée. Leurs questions et leurs "
        "remarques constituent une étape précieuse de la professionnalisation.")
    justified(doc,
        "Je remercie par ailleurs les contributeurs des nombreuses bibliothèques open source "
        "utilisées dans ce projet — NestJS, Angular, TypeORM, FastAPI, PyTorch, Ollama, "
        "Meilisearch, PrimeNG, parmi tant d'autres. La qualité de leur travail rend possible "
        "la réalisation, en quelques mois, de plateformes que des équipes complètes auraient "
        "naguère mis plusieurs années à construire.")
    justified(doc,
        "Enfin, je remercie ma famille et mes proches pour leur patience et leur soutien moral "
        "tout au long de cette période exigeante.")
    page_break(doc)


def resume_fr(doc):
    heading(doc, "Résumé", level=1)
    justified(doc,
        "Ce projet de fin d'études porte sur la conception, le développement et "
        "l'industrialisation d'une plateforme e-commerce intelligente baptisée Barsha, destinée "
        "à une marque tunisienne de prêt-à-porter. Initialement cadré comme un démonstrateur "
        "intégrant trois briques d'intelligence artificielle (assistant conversationnel, moteur "
        "de recommandation et recherche visuelle), le projet a connu une expansion fonctionnelle "
        "majeure pour devenir un véritable écosystème commerce omnicanal.")
    justified(doc,
        "La plateforme finale est constituée de trois composants principaux : un front-end "
        "Angular 19 unifiant un storefront grand public et un back-office administrateur de "
        "plus de trente pages ; une API métier NestJS 10 organisée en plus de cinquante modules "
        "indépendants exposant plus de quatre cents endpoints REST ; un service IA Python "
        "FastAPI autonome combinant Ollama (LLM local Qwen 2.5 7B), CLIP (embeddings d'images) "
        "et un moteur de recommandation multi-stratégies. La couche de données s'appuie sur "
        "Microsoft SQL Server avec plus de quatre-vingts entités, complétée par Meilisearch "
        "pour la recherche textuelle.")
    justified(doc,
        "Au-delà des fonctionnalités e-commerce classiques, la plateforme intègre une "
        "marketplace multi-vendeurs avec gestion des fulfillments mixés et des payouts, un "
        "module de gestion multi-entrepôts avec réservation atomique de stock, des modules de "
        "conformité réglementaire (RGPD self-service côté client, TTN fiscal Tunisie), un "
        "moteur d'automatisation marketing (lifecycle drips), un module B2B wholesale, ainsi "
        "qu'un système d'observabilité (event bus interne, audit trail).")
    justified(doc,
        "Le projet a été industrialisé avec un système de migrations versionnées, un préflight "
        "de sécurité au démarrage refusant tout secret par défaut en production, une "
        "configuration Docker compose multi-services et une documentation opérationnelle "
        "complète. Le mémoire détaille la démarche méthodologique, les choix d'architecture, "
        "les défis techniques rencontrés et les solutions apportées, ainsi que les perspectives "
        "post-projet.")
    para(doc, "Mots-clés", bold=True)
    justified(doc,
        "E-commerce, intelligence artificielle, NestJS, Angular, marketplace, microservices, "
        "Ollama, CLIP, recherche visuelle, recommandation, RGPD, TTN, multi-vendeurs, "
        "multi-entrepôts, lifecycle marketing, observabilité, migrations versionnées, "
        "industrialisation logicielle.")
    page_break(doc)


def abstract_en(doc):
    heading(doc, "Abstract", level=1)
    justified(doc,
        "This final-year graduation project covers the design, development and industrialisation "
        "of an intelligent e-commerce platform named Barsha, targeting a Tunisian fashion "
        "brand. Originally scoped as a demonstrator integrating three AI building blocks "
        "(conversational assistant, recommendation engine, visual search), the project has "
        "undergone a major functional expansion and has become a full-fledged omnichannel "
        "commerce ecosystem.")
    justified(doc,
        "The delivered platform is composed of three main components: an Angular 19 front-end "
        "that unifies a consumer storefront and a 30-plus-page administrator back-office; "
        "a NestJS 10 business API organised into more than fifty independent modules exposing "
        "more than four hundred REST endpoints; and a standalone Python FastAPI AI service "
        "combining Ollama (local Qwen 2.5 7B LLM), CLIP (image embeddings) and a multi-strategy "
        "recommendation engine. The data layer relies on Microsoft SQL Server with more than "
        "eighty entities, complemented by Meilisearch for full-text search.")
    justified(doc,
        "Beyond standard e-commerce features, the platform includes a multi-seller "
        "marketplace with mixed-fulfillment and payout management, a multi-warehouse stock "
        "module with atomic reservation, regulatory compliance modules (GDPR self-service for "
        "customers, TTN fiscal compliance for Tunisia), a marketing automation engine "
        "(lifecycle drips), a B2B wholesale module, and an observability stack (internal event "
        "bus, audit trail).")
    justified(doc,
        "The project has been industrialised with a versioned migration system, a startup "
        "production-safety preflight rejecting any default secret in production, a multi-service "
        "Docker Compose configuration and a complete operational documentation. This thesis "
        "details the methodology, the architectural choices, the technical challenges encountered "
        "and the solutions applied, as well as the post-project perspectives.")
    para(doc, "Keywords", bold=True)
    justified(doc,
        "E-commerce, artificial intelligence, NestJS, Angular, marketplace, microservices, "
        "Ollama, CLIP, visual search, recommendation, GDPR, TTN, multi-seller, multi-warehouse, "
        "lifecycle marketing, observability, versioned migrations, software industrialisation.")
    page_break(doc)


def liste_figures(doc):
    heading(doc, "Liste des figures", level=1)
    figs = [
        ("Figure 1", "Diagramme de cas d'utilisation de la plateforme Barsha"),
        ("Figure 2", "Architecture logicielle globale"),
        ("Figure 3", "Diagramme de déploiement (staging single-host)"),
        ("Figure 4", "Diagramme de classes (extrait du domaine commerce, marketplace et IA)"),
        ("Figure 5", "Modèle conceptuel de données (extrait — schéma relationnel MSSQL)"),
        ("Figure 6", "Séquence — authentification (login + JWT refresh)"),
        ("Figure 7", "Séquence — passage de commande (panier → paiement → notifications)"),
        ("Figure 8", "Séquence — recommandations IA personnalisées"),
        ("Figure 9", "Séquence — recherche visuelle (image → produits similaires)"),
        ("Figure 10", "Séquence — expédition et suivi de livraison"),
        ("Figure 11", "Séquence — gestion admin (création produit + indexation Meilisearch)"),
        ("Figure 12", "Activité — tunnel d'achat Barsha"),
    ]
    t = doc.add_table(rows=len(figs), cols=2)
    for i, (k, v) in enumerate(figs):
        c1, c2 = t.rows[i].cells
        c1.text = ""; r = c1.paragraphs[0].add_run(k); r.bold = True; r.font.size = Pt(11)
        c2.text = ""; r = c2.paragraphs[0].add_run(v); r.font.size = Pt(11)
        c1.width = Cm(2.6); c2.width = Cm(13.4)
    page_break(doc)


def liste_tableaux(doc):
    heading(doc, "Liste des tableaux", level=1)
    tabs = [
        ("Tableau 1", "Évolution quantitative entre cahier v1 et version finale"),
        ("Tableau 2", "Comparaison Barsha avec les principales plateformes existantes"),
        ("Tableau 3", "Stack technique retenue par couche"),
        ("Tableau 4", "Inventaire des modules NestJS par domaine fonctionnel"),
        ("Tableau 5", "Modules IA et stratégies de recommandation"),
        ("Tableau 6", "Plan de tests UAT et résultats par flux"),
        ("Tableau 7", "Variables d'environnement par groupe (extrait)"),
        ("Tableau 8", "Risques résiduels et mitigations"),
        ("Tableau 9", "Bilan compétences mobilisées"),
    ]
    t = doc.add_table(rows=len(tabs), cols=2)
    for i, (k, v) in enumerate(tabs):
        c1, c2 = t.rows[i].cells
        c1.text = ""; r = c1.paragraphs[0].add_run(k); r.bold = True; r.font.size = Pt(11)
        c2.text = ""; r = c2.paragraphs[0].add_run(v); r.font.size = Pt(11)
        c1.width = Cm(2.6); c2.width = Cm(13.4)
    page_break(doc)


def liste_acronymes(doc):
    heading(doc, "Liste des acronymes et abréviations", level=1)
    acr = [
        ("API", "Application Programming Interface"),
        ("B2B", "Business-to-Business"),
        ("B2C", "Business-to-Consumer"),
        ("CDN", "Content Delivery Network"),
        ("CLIP", "Contrastive Language-Image Pre-training (modèle OpenAI)"),
        ("CLV", "Customer Lifetime Value"),
        ("CMS", "Content Management System"),
        ("COD", "Cash On Delivery (paiement à la livraison)"),
        ("CORS", "Cross-Origin Resource Sharing"),
        ("CRM", "Customer Relationship Management"),
        ("CSRF", "Cross-Site Request Forgery"),
        ("CTP", "Click-to-Pay (passerelle de paiement tunisienne)"),
        ("DI", "Dependency Injection"),
        ("DTO", "Data Transfer Object"),
        ("ER", "Entity-Relationship (modèle)"),
        ("ERP", "Enterprise Resource Planning"),
        ("FCM", "Firebase Cloud Messaging (non utilisé ici, à titre indicatif)"),
        ("GDPR / RGPD", "Règlement Général sur la Protection des Données"),
        ("HTTP / HTTPS", "Hypertext Transfer Protocol / Secure"),
        ("IA / AI", "Intelligence Artificielle / Artificial Intelligence"),
        ("JWT", "JSON Web Token"),
        ("KPI", "Key Performance Indicator"),
        ("LLM", "Large Language Model"),
        ("LTS", "Long-Term Support"),
        ("MSSQL", "Microsoft SQL Server"),
        ("MVC", "Model-View-Controller"),
        ("ORM", "Object-Relational Mapping"),
        ("OTP", "One-Time Password"),
        ("PFE", "Projet de Fin d'Études"),
        ("PWA", "Progressive Web Application"),
        ("RBAC", "Role-Based Access Control"),
        ("REST", "Representational State Transfer"),
        ("RMA", "Return Merchandise Authorization"),
        ("SaaS", "Software as a Service"),
        ("SCSS", "Sassy Cascading Style Sheets"),
        ("SDK", "Software Development Kit"),
        ("SEO", "Search Engine Optimization"),
        ("SKU", "Stock Keeping Unit"),
        ("SMS", "Short Message Service"),
        ("SMTP", "Simple Mail Transfer Protocol"),
        ("SPA", "Single-Page Application"),
        ("SQL", "Structured Query Language"),
        ("SSL / TLS", "Secure Sockets Layer / Transport Layer Security"),
        ("SSR", "Server-Side Rendering"),
        ("SW", "Service Worker"),
        ("TND", "Dinar tunisien"),
        ("TTN", "Tunisia Trade Network (passerelle fiscale)"),
        ("TypeORM", "Object-Relational Mapper TypeScript"),
        ("UAT", "User Acceptance Testing"),
        ("UGC", "User-Generated Content"),
        ("UML", "Unified Modeling Language"),
        ("UX / UI", "User eXperience / User Interface"),
        ("VPN", "Virtual Private Network"),
        ("XSS", "Cross-Site Scripting"),
    ]
    t = doc.add_table(rows=len(acr), cols=2)
    for i, (k, v) in enumerate(acr):
        c1, c2 = t.rows[i].cells
        c1.text = ""; r = c1.paragraphs[0].add_run(k); r.bold = True; r.font.size = Pt(10)
        c2.text = ""; r = c2.paragraphs[0].add_run(v); r.font.size = Pt(10)
        c1.width = Cm(3.0); c2.width = Cm(13.0)
    page_break(doc)


def introduction(doc):
    heading(doc, "Introduction générale", level=1)
    justified(doc,
        "Le commerce en ligne représente aujourd'hui une part déterminante de l'activité des "
        "marques de prêt-à-porter et de mode, à plus forte raison dans un contexte où les "
        "comportements d'achat post-pandémie se sont durablement digitalisés. Cette tendance, "
        "structurelle dans les pays développés, gagne rapidement les économies émergentes ; "
        "le marché tunisien, sur lequel s'inscrit la marque Barsha commanditaire de ce projet, "
        "n'échappe pas à cette dynamique. Néanmoins, les marques nationales tunisiennes "
        "souffrent d'un retard manifeste en matière d'expérience digitale : les plateformes "
        "généralistes captent l'essentiel du trafic, et les marques pure player nationales "
        "peinent à proposer une expérience à la hauteur de leur identité de marque.")

    justified(doc,
        "Le projet de fin d'études détaillé dans ce mémoire s'inscrit dans cette problématique. "
        "Il vise à concevoir, développer et industrialiser une plateforme e-commerce "
        "intelligente, capable d'offrir à Barsha un canal de vente digital différencié et "
        "performant, augmenté par des modules d'intelligence artificielle apportant une réelle "
        "valeur ajoutée — recommandations personnalisées, recherche visuelle, assistant "
        "conversationnel.")

    justified(doc,
        "Au cours de la phase de réalisation, le périmètre initial a connu une expansion "
        "considérable. Aux fonctionnalités e-commerce de base (catalogue, panier, commande) se "
        "sont progressivement ajoutées des thématiques structurantes : marketplace "
        "multi-vendeurs, gestion multi-entrepôts, conformité réglementaire (RGPD et fiscal "
        "tunisien), automatisation marketing, observabilité, et industrialisation au sens "
        "complet du terme (configuration par environnement, migrations versionnées, "
        "déploiement reproductible). Ce qui était initialement un démonstrateur technique est "
        "devenu, au terme du projet, un véritable écosystème commerce omnicanal — une "
        "évolution que ce mémoire s'attache à documenter et à analyser.")

    justified(doc,
        "Le mémoire est organisé en neuf chapitres. Le premier pose le contexte général, "
        "l'organisation, et la problématique. Le deuxième présente l'étude de l'existant "
        "(plateformes concurrentes, solutions du marché) et l'analyse des besoins. Le troisième "
        "détaille la conception et l'architecture de la solution retenue. Le quatrième couvre "
        "la modélisation UML et le modèle de données. Le cinquième documente la réalisation "
        "et l'implémentation effective des principaux modules. Le sixième chapitre est consacré "
        "aux briques d'intelligence artificielle. Le septième présente la démarche de tests, "
        "validation et qualité. Le huitième aborde le déploiement, l'exploitation et "
        "l'industrialisation. Le neuvième propose un bilan critique du projet, identifie les "
        "apports et les limites, et trace les perspectives. Une conclusion générale, une "
        "bibliographie et un ensemble d'annexes (codes PlantUML des diagrammes, extraits de "
        "configuration, scripts de migration) complètent le document.")

    justified(doc,
        "Tout au long de ce mémoire, le souci a été de rester aussi proche que possible du code "
        "réellement livré : chaque diagramme reflète des entités existantes, chaque chiffre est "
        "vérifiable dans le dépôt, et chaque choix d'architecture est étayé par une "
        "justification opérationnelle. Cette exigence de fidélité distingue, je l'espère, le "
        "présent rapport d'un exercice purement théorique.")
    page_break(doc)


# ============================================================================
# CHAPITRE 1
# ============================================================================
def chapitre_1(doc):
    heading(doc, "Chapitre 1 — Contexte général et cadrage du projet", level=1)

    heading(doc, "1.1 Contexte économique et sectoriel", level=2)
    justified(doc,
        "Le marché tunisien du e-commerce représente, selon les chiffres consolidés des "
        "rapports sectoriels publiés en 2024-2025, un volume d'affaires en croissance annuelle "
        "à deux chiffres, porté principalement par la digitalisation des moyens de paiement "
        "(Click-to-Pay, e-Dinar, COD), l'amélioration de la couverture logistique nationale "
        "(FirstDelivery, Aramex Tunisie), et la généralisation de l'usage du smartphone. Dans "
        "ce paysage, la mode et le prêt-à-porter constituent l'une des verticales les plus "
        "dynamiques, mais aussi l'une des plus concurrentielles : les acheteurs comparent les "
        "offres, abandonnent leur panier, attendent une expérience à la hauteur de celle "
        "qu'ils connaissent sur les plateformes internationales (Zara, H&M, Asos, Shein).")

    justified(doc,
        "Pour une marque nationale comme Barsha, deux constats émergent. D'une part, la simple "
        "présence en ligne ne suffit plus : il faut une expérience digitale différenciée, "
        "capable de capter et de fidéliser le visiteur sans qu'il bascule chez un concurrent. "
        "D'autre part, l'intelligence artificielle, longtemps cantonnée aux acteurs "
        "internationaux les plus avancés, est désormais accessible — via des modèles open "
        "source (Qwen, LLaMA), des bibliothèques mûres (PyTorch, transformers) et des services "
        "cloud à la demande (Gemini, OpenRouter) — à un projet d'envergure raisonnable. Le "
        "moment est donc particulièrement favorable pour l'intégration d'IA dans une plateforme "
        "e-commerce nationale.")

    heading(doc, "1.2 Présentation de l'organisme commanditaire", level=2)
    justified(doc,
        "Barsha est une marque tunisienne de prêt-à-porter destinée principalement à une "
        "clientèle féminine, masculine et enfant. Son positionnement combine tendances "
        "internationales et codes esthétiques locaux. L'entreprise dispose d'un réseau de "
        "boutiques physiques et souhaite désormais doubler ce canal d'une présence digitale "
        "complète. Les enjeux opérationnels sont multiples :")
    bullet(doc, "Élargir la base clientèle au-delà des zones géographiques couvertes par les boutiques.")
    bullet(doc, "Capter une clientèle plus jeune, native du digital, qui privilégie l'achat en ligne.")
    bullet(doc, "Disposer d'un canal direct permettant de contrôler l'expérience de marque (par opposition aux marketplaces tierces qui imposent leur identité).")
    bullet(doc, "Créer une infrastructure capable, à moyen terme, d'héberger d'autres marques partenaires (logique marketplace).")
    bullet(doc, "Améliorer la rentabilité par la personnalisation et la rétention client.")

    heading(doc, "1.3 Problématique", level=2)
    justified(doc,
        "La problématique centrale du projet peut être formulée comme suit : « Comment concevoir "
        "et industrialiser une plateforme e-commerce tunisienne capable de rivaliser, en termes "
        "d'expérience utilisateur, de pertinence des recommandations, et de robustesse "
        "opérationnelle, avec les plateformes internationales — tout en respectant les "
        "contraintes locales (paiement, fiscalité, livraison) et les ressources d'un projet de "
        "fin d'études ? »")

    justified(doc,
        "Plusieurs sous-questions découlent de cette problématique générale :")
    bullet(doc, "Quelle architecture logicielle permet de concilier richesse fonctionnelle (e-commerce + marketplace + IA + conformité) et maintenabilité par un développeur unique sur la durée d'un projet de fin d'études ?")
    bullet(doc, "Quelles briques d'intelligence artificielle apportent une valeur réelle et démontrable, par opposition à un usage cosmétique ou marketing ?")
    bullet(doc, "Comment intégrer ces briques sans introduire de point de défaillance unique : que se passe-t-il quand le LLM est indisponible ?")
    bullet(doc, "Comment concilier conformité réglementaire (RGPD, fiscal tunisien) et fluidité du parcours utilisateur ?")
    bullet(doc, "Comment industrialiser le déploiement de telle sorte qu'une mise en production réelle soit envisageable dans un délai raisonnable post-projet ?")

    heading(doc, "1.4 Objectifs initiaux", level=2)
    justified(doc,
        "Au moment du cadrage initial, formalisé dans la version 1 du cahier des charges, trois "
        "objectifs principaux avaient été retenus :")
    numbered(doc, "Concevoir et développer une plateforme e-commerce complète comprenant catalogue, panier, tunnel d'achat, gestion compte et back-office d'administration.")
    numbered(doc, "Intégrer trois briques d'intelligence artificielle apportant une plus-value mesurable : un assistant conversationnel basé sur un LLM, un moteur de recommandation personnalisé, et une fonctionnalité de recherche visuelle.")
    numbered(doc, "Livrer un démonstrateur fonctionnel, déployé en environnement de démonstration, accompagné d'une documentation technique et utilisateur.")

    heading(doc, "1.5 Objectifs finaux (après expansion de périmètre)", level=2)
    justified(doc,
        "Au cours de la réalisation, les objectifs ont été enrichis pour répondre aux exigences "
        "d'industrialisation et aux besoins métier qui se sont précisés. Les objectifs finaux, "
        "formellement consignés dans la version 2 du cahier des charges, sont les suivants :")
    numbered(doc, "Tous les objectifs initiaux, conservés et étendus.")
    numbered(doc, "Construire une marketplace multi-vendeurs (onboarding KYC, gestion des fulfillments mixés, calcul des payouts).")
    numbered(doc, "Implémenter une gestion multi-entrepôts avec réservation atomique de stock, safety stock et alertes.")
    numbered(doc, "Intégrer la conformité réglementaire RGPD (côté client, en self-service) et la conformité fiscale tunisienne (TTN, branchable).")
    numbered(doc, "Construire un moteur de marketing automation (lifecycle drips déclenchés par événement métier).")
    numbered(doc, "Industrialiser le déploiement (Docker, migrations versionnées, préflight de sécurité, runbook documenté).")
    numbered(doc, "Mettre en place une couche d'observabilité (event bus, audit trail, journal d'activité administrateur).")
    numbered(doc, "Étendre le périmètre IA avec deux briques additionnelles : modération de contenus utilisateurs et propensity scoring.")

    heading(doc, "1.6 Méthodologie de gestion de projet", level=2)
    justified(doc,
        "Le projet a été conduit en mode itératif, par vagues successives (« waves ») de "
        "fonctionnalités. Chaque wave couvrait une thématique cohérente — wave 1 : socle "
        "e-commerce ; wave 2 : storefront extensions ; wave 3 : opérations ; wave 4 : "
        "automation et CRM — et donnait lieu à une validation interne avant le passage à la "
        "suivante. Cette approche a permis de garder en permanence une plateforme "
        "déployable et démontrable, et d'incorporer les retours utilisateurs au fil de l'eau. "
        "Elle s'inspire des méthodologies agiles classiques (Scrum, Kanban) tout en restant "
        "compatible avec un projet conduit par un développeur unique : pas de cérémonies "
        "formelles, mais une discipline de versionnement (Git, branches feature), de revue de "
        "code automatisée (TypeScript strict, ESLint), et de tests UAT manuels systématiques "
        "à chaque incrément.")

    heading(doc, "1.7 Planning effectif", level=2)
    table(doc,
        ["Phase", "Activités clés", "Période"],
        [
            ["Cadrage", "Cahier des charges v1, étude existant, choix techniques", "Sept. 2025"],
            ["Conception socle", "Architecture, modèles, schéma BD, premiers diagrammes UML", "Oct. 2025"],
            ["Wave 1 — socle e-commerce", "Auth, products, categories, cart, orders, payments, search", "Nov. 2025"],
            ["Wave 2 — storefront", "Storefront Angular, design, recommendations v1, chatbot", "Déc. 2025"],
            ["Wave 3 — opérations", "Reviews, Q&A, support, FAQ, notifications, alerts, lifecycle", "Janv. 2026"],
            ["Wave 4 — CRM & ops", "Customer 360°, tasks, signaux, journal d'activité, fraud", "Févr. 2026"],
            ["Marketplace & multi-WH", "Sellers, fulfillments, payouts, warehouses, replenishment", "Mars 2026"],
            ["Conformité & IA bonus", "GDPR, fiscal/TTN, propensity, ugc-moderation, B2B", "Mars 2026"],
            ["Industrialisation", "Migrations runner, préflight, docker-compose staging", "Avril 2026"],
            ["UAT, finalisation, soutenance", "Tests bout-en-bout, rapport, soutenance", "Avril 2026"],
        ],
        col_widths_cm=[4.0, 9.0, 3.0],
        first_col_bold=True,
    )

    page_break(doc)


# ============================================================================
# CHAPITRE 2
# ============================================================================
def chapitre_2(doc):
    heading(doc, "Chapitre 2 — Étude de l'existant et analyse des besoins", level=1)

    heading(doc, "2.1 Étude de l'existant", level=2)
    justified(doc,
        "Avant d'esquisser une solution, il est nécessaire d'examiner l'existant : quelles "
        "plateformes occupent le marché du e-commerce de mode en Tunisie et au-delà, et "
        "comment se positionnent leurs fonctionnalités par rapport aux objectifs du projet "
        "Barsha ? Cinq familles de solutions ont été étudiées.")

    heading(doc, "2.1.1 Plateformes internationales pure player (Zalando, Asos, Shein)", level=3)
    justified(doc,
        "Ces acteurs disposent de moyens techniques et marketing colossaux. Leurs plateformes "
        "intègrent depuis longtemps des moteurs de recommandation sophistiqués (collaborative "
        "filtering à grande échelle, embeddings produits), des chatbots d'assistance, des "
        "essayages virtuels (AR), et une logistique mondiale. Leur expérience sert de référence "
        "absolue. Elles sont toutefois inaccessibles dans leur intégralité à un projet de fin "
        "d'études, à la fois pour des raisons d'échelle (volumes de données, infrastructure) et "
        "de coût (développement, maintenance, équipes).")

    heading(doc, "2.1.2 Plateformes SaaS générales (Shopify, WooCommerce, Magento)", level=3)
    justified(doc,
        "Ces solutions packagées permettent à une marque de monter rapidement une boutique en "
        "ligne sans développement personnalisé. Leurs avantages — rapidité de mise en œuvre, "
        "écosystème de plugins, communauté — ont été pesés. Leurs limitations dans le contexte "
        "Barsha sont importantes : (i) coût récurrent qui devient significatif à mesure que la "
        "boutique grandit, (ii) personnalisation limitée pour des intégrations IA "
        "non-standards, (iii) dépendance forte au prestataire, (iv) intégration imparfaite avec "
        "les passerelles tunisiennes (CTP, FirstDelivery), (v) absence de conformité fiscale "
        "TTN native. Ces solutions n'ont donc pas été retenues comme socle.")

    heading(doc, "2.1.3 Plateformes nationales tunisiennes (Mytek, Jumia Tunisie)", level=3)
    justified(doc,
        "Ces acteurs sont familiers du marché local, intègrent CTP et le COD, mais leur "
        "expérience utilisateur reste centrée sur la transaction et peu différenciante. Aucun "
        "module d'IA visible côté client, peu de personnalisation. Leur étude a essentiellement "
        "permis de valider les contraintes locales (modes de paiement, modes de livraison, "
        "structure des adresses, codes postaux).")

    heading(doc, "2.1.4 Briques open source d'IA e-commerce", level=3)
    justified(doc,
        "L'écosystème open source offre désormais des briques techniquement solides pour "
        "chaque besoin IA : Ollama et les modèles open source (Qwen, LLaMA, Mistral) couvrent "
        "le besoin LLM, OpenAI CLIP couvre le besoin vision, scikit-learn et la suite "
        "transformers couvrent la recommandation. Ces briques ont été sélectionnées pour le "
        "projet en raison de leur maturité, de leur licence permissive et de l'absence de coût "
        "récurrent — un facteur déterminant pour un projet académique.")

    heading(doc, "2.1.5 Comparaison synthétique", level=3)
    table(doc,
        ["Critère", "Zara/Asos", "Shopify", "Mytek/Jumia TN", "Barsha (notre projet)"],
        [
            ["Catalogue + panier + commande", "Oui", "Oui", "Oui", "Oui"],
            ["Recommandations IA personnalisées", "Avancées", "Plugin payant", "Aucune", "8+ stratégies natives"],
            ["Recherche visuelle", "Oui (limitée)", "Plugin", "Aucune", "CLIP local"],
            ["Chatbot LLM", "Oui", "Plugin", "Aucun", "Ollama local + fallback cloud"],
            ["Marketplace multi-vendeurs", "Oui", "Plugin", "Oui (Jumia)", "Oui natif"],
            ["Conformité fiscale Tunisie (TTN)", "—", "Non", "Oui", "Oui (branchable)"],
            ["Intégration CTP / Konnekt", "—", "Plugin tiers", "Oui", "Oui natif"],
            ["RGPD self-service", "Oui", "Manuel", "Variable", "Oui complet"],
            ["Personnalisation totale du code", "—", "Limitée", "Non (SaaS)", "Oui (open source)"],
            ["Coût récurrent", "Élevé", "Élevé (€€)", "Variable", "Faible (auto-hébergement)"],
        ],
        col_widths_cm=[4.5, 2.5, 2.5, 2.8, 3.7],
        first_col_bold=True,
    )

    heading(doc, "2.2 Analyse des besoins", level=2)
    justified(doc,
        "L'analyse des besoins a été conduite par décomposition en trois acteurs principaux — "
        "client final, administrateur, et vendeur partenaire — auxquels s'ajoutent les "
        "exigences transverses (sécurité, performance, conformité). Pour chaque acteur, les "
        "besoins ont été recueillis par revue de plateformes existantes, échanges avec la "
        "marque commanditaire, et apprentissage des contraintes au fil de l'implémentation.")

    heading(doc, "2.2.1 Besoins du client final", level=3)
    bullet(doc, "Naviguer un catalogue clair, rapide, esthétiquement à la hauteur de la marque.")
    bullet(doc, "Trouver rapidement un produit (recherche textuelle, filtres, recherche visuelle).")
    bullet(doc, "Comparer, ajouter au panier, finaliser sans friction (tunnel court, paiement multi-canal).")
    bullet(doc, "Suivre sa commande, gérer ses retours en self-service.")
    bullet(doc, "Recevoir des recommandations pertinentes, sans intrusion.")
    bullet(doc, "Gérer son compte, ses adresses, sa wishlist, ses notifications.")
    bullet(doc, "Bénéficier d'un programme de fidélité et de parrainage clair.")
    bullet(doc, "Pouvoir exercer ses droits RGPD sans contacter le support.")

    heading(doc, "2.2.2 Besoins de l'administrateur", level=3)
    bullet(doc, "Disposer d'un dashboard avec les KPIs métier en temps réel.")
    bullet(doc, "Gérer le catalogue (produits, catégories, stocks par entrepôt) sans intervention dev.")
    bullet(doc, "Suivre et traiter les commandes, retours, demandes RGPD, demandes vendeur.")
    bullet(doc, "Configurer les promotions (coupons, pricing rules, drops, daily deals).")
    bullet(doc, "Lancer et superviser des campagnes marketing automatisées (lifecycle, newsletter).")
    bullet(doc, "Disposer d'un audit trail des actions sensibles.")
    bullet(doc, "Importer et exporter des données (catalogue, clients, commandes).")
    bullet(doc, "Configurer les feature flags et les A/B tests.")
    bullet(doc, "Modérer le contenu utilisateur (avis, photos, Q&A).")
    bullet(doc, "Gérer la conformité fiscale et déclencher les opérations TTN au besoin.")

    heading(doc, "2.2.3 Besoins du vendeur partenaire", level=3)
    bullet(doc, "Postuler simplement à la marketplace via un formulaire public.")
    bullet(doc, "Recevoir une réponse claire (validation ou rejet motivé).")
    bullet(doc, "Gérer son catalogue, son stock et ses prix une fois validé.")
    bullet(doc, "Suivre ses ventes, ses fulfillments, ses payouts.")
    bullet(doc, "Disposer d'un canal de communication avec l'admin (notifications, support).")

    heading(doc, "2.2.4 Besoins transverses", level=3)
    bullet(doc, "Sécurité : authentification robuste, protection des données sensibles, prévention XSS/CSRF/injection.")
    bullet(doc, "Performance : chargement < 3 s sur les pages principales, expérience mobile fluide.")
    bullet(doc, "Disponibilité : dégradation gracieuse en cas de panne d'un service externe ; pas de point de défaillance unique côté IA.")
    bullet(doc, "Conformité : RGPD côté client, TTN côté fiscal, traçabilité des actions admin.")
    bullet(doc, "Maintenabilité : code modulaire, documenté, testable.")
    bullet(doc, "Évolutivité : possibilité d'ajouter de nouveaux modules (ex. nouveau mode de paiement) sans refonte.")
    bullet(doc, "Industrialisation : déploiement reproductible, configuration par environnement, observabilité.")

    heading(doc, "2.3 Spécification fonctionnelle (synthèse)", level=2)
    justified(doc,
        "L'inventaire complet des exigences fonctionnelles est consigné dans la version 2 du "
        "cahier des charges joint à ce mémoire. Pour rappel synthétique, le périmètre final "
        "couvre 75 exigences fonctionnelles dont 19 issues du cadrage initial (F01-F19) et 56 "
        "ajoutées au fil de la réalisation (F20-F75). Ces exigences se déploient à travers "
        "plus de 50 modules NestJS, plus de 80 entités, et plus de 400 endpoints REST.")

    heading(doc, "2.4 Spécification non fonctionnelle (synthèse)", level=2)
    justified(doc,
        "Les exigences non fonctionnelles retenues couvrent les axes performance, sécurité, "
        "disponibilité, ergonomie, responsive, maintenabilité, évolutivité, SEO, RGPD/cookies, "
        "analytics, observabilité et industrialisation. Chacune est associée à un mécanisme "
        "concret d'implémentation décrit en chapitre 5.")

    page_break(doc)


# ============================================================================
# CHAPITRE 3 — Conception et architecture
# ============================================================================
def chapitre_3(doc):
    heading(doc, "Chapitre 3 — Conception et architecture de la solution", level=1)

    heading(doc, "3.1 Vision architecturale", level=2)
    justified(doc,
        "Plusieurs critères ont guidé la conception architecturale : (i) la séparation claire "
        "des préoccupations, qui permet de raisonner sur chaque couche indépendamment ; (ii) "
        "la résilience aux pannes des services externes, garantie par la dégradation gracieuse "
        "systématique ; (iii) la testabilité, par l'injection de dépendances et la modularité ; "
        "(iv) l'extensibilité, par un event bus interne et des interfaces explicites ; (v) la "
        "possibilité d'industrialiser le tout via Docker compose.")

    justified(doc,
        "La solution retenue est une architecture multi-couches, orientée services :")
    bullet(doc, "Une couche présentation Angular 19 unifiant deux applications (storefront grand public et back-office administrateur), partageant la même base de code et le même design system.")
    bullet(doc, "Une couche reverse-proxy / CDN (nginx + Cloudflare), assurant TLS, cache statique, et rate limiting.")
    bullet(doc, "Une couche application centrale en NestJS 10, organisée en plus de 50 modules indépendants, chacun encapsulant un domaine métier (orders, products, marketplace, fiscal, gdpr…).")
    bullet(doc, "Un service satellite Python FastAPI (ai-service), spécialisé dans les calculs lourds (CLIP, recommandations) et l'orchestration du LLM via Ollama.")
    bullet(doc, "Une couche données combinant MSSQL 2022 (base relationnelle métier) et Meilisearch (index de recherche).")
    bullet(doc, "Un ensemble de services externes intégrés : SMTP, SMS, CTP/Konnekt, FirstDelivery/Aramex, TTN, Gemini/OpenRouter (fallback IA cloud).")

    image(doc, "architecture.png", width_cm=15.5,
          caption="Architecture logicielle globale", fig_num=2)

    heading(doc, "3.2 Choix technologiques détaillés", level=2)

    heading(doc, "3.2.1 Frontend : Angular 19", level=3)
    justified(doc,
        "Le choix d'Angular 19 plutôt que React ou Next.js (initialement envisagé dans le "
        "cahier v1) repose sur trois arguments. Premièrement, Angular est un framework "
        "opinionné qui impose une structure rigoureuse, particulièrement adaptée à un projet "
        "de grande taille mené par un développeur unique : la séparation modules / composants / "
        "services, l'injection de dépendances native, la gestion de la réactivité par RxJS, "
        "constituent un cadre dans lequel la complexité reste gérable. Deuxièmement, le "
        "modèle standalone components introduit dans Angular 14+ permet d'éviter le "
        "boilerplate des modules NgModule traditionnels tout en gardant les avantages "
        "structurels du framework. Troisièmement, l'écosystème PrimeNG offre une bibliothèque "
        "de composants UI matures qui accélèrent significativement le développement du "
        "back-office.")

    heading(doc, "3.2.2 Backend principal : NestJS 10", level=3)
    justified(doc,
        "NestJS a été retenu comme socle de l'API métier pour des raisons similaires : "
        "framework opinionné inspiré d'Angular, avec injection de dépendances, modules, "
        "décorateurs et un découpage controller / service / repository qui correspond bien à "
        "une architecture en couches. Le découpage en plus de 50 modules NestJS indépendants — "
        "chacun avec ses entities, services, controllers et DTOs — a permis de gérer "
        "l'expansion fonctionnelle sans dette structurelle. La compatibilité avec TypeScript "
        "5 et l'écosystème npm a permis de mutualiser les types entre frontend et backend "
        "(DTOs partagés via interfaces).")

    heading(doc, "3.2.3 ORM et base de données", level=3)
    justified(doc,
        "TypeORM a été choisi comme ORM. Il combine deux avantages clés : (i) la possibilité "
        "de définir le schéma directement par les classes décorées (Entity), avec "
        "synchronisation automatique en développement ; (ii) le support multi-driver permettant "
        "de cibler MSSQL, PostgreSQL ou SQLite selon l'environnement. Le moteur primaire en "
        "production est MSSQL 2022, choisi pour sa robustesse, ses performances sur les "
        "requêtes complexes et son intégration native dans l'écosystème Microsoft (l'environnement "
        "de développement utilise SQL Server Developer Edition).")

    heading(doc, "3.2.4 Service IA : Python + FastAPI + Ollama + CLIP", level=3)
    justified(doc,
        "Plutôt que d'intégrer les briques IA directement dans le backend NestJS — ce qui "
        "aurait imposé d'utiliser des bindings Node.js de PyTorch, peu mûrs — le choix a été "
        "fait de séparer ces calculs dans un service Python autonome. Cette séparation présente "
        "trois avantages : (i) accès natif à PyTorch et transformers, qui sont l'écosystème "
        "de référence pour l'IA moderne ; (ii) possibilité de redémarrer ou de scaler "
        "indépendamment le service IA sans toucher au backend principal ; (iii) modularité — "
        "le backend peut tomber sans perturber l'IA, et inversement. Ollama est utilisé comme "
        "runtime pour le LLM Qwen 2.5 7B (open source, multilingue, performant à cette taille). "
        "CLIP est utilisé pour les embeddings d'images dans la recherche visuelle.")

    heading(doc, "3.2.5 Recherche : Meilisearch", level=3)
    justified(doc,
        "Pour la recherche textuelle, Meilisearch a été préféré à Elasticsearch et à Algolia. "
        "Ses atouts : très bonne tokenisation française et gestion native des accents et des "
        "synonymes, une API REST minimaliste, une faible empreinte mémoire (typiquement "
        "100-200 Mo pour un index de quelques milliers de produits), et une licence open "
        "source MIT. Algolia offre des performances similaires mais avec un coût récurrent qui "
        "pèse rapidement.")

    heading(doc, "3.2.6 Infrastructure : Docker", level=3)
    justified(doc,
        "Le projet est livré avec une configuration Docker Compose double : "
        "docker-compose.yml pour la pile IA seule, et docker-compose.staging.yml pour la pile "
        "complète (MSSQL + Meilisearch + Ollama + ai-service + backend NestJS + frontend "
        "nginx). Cette dualité permet aux développeurs de travailler en local avec une partie "
        "des services dockerisés, tout en autorisant un déploiement single-host complet via "
        "le compose staging.")

    heading(doc, "3.3 Stack technique synthétique", level=2)
    table(doc,
        ["Couche", "Technologie", "Version", "Rôle"],
        [
            ["Frontend", "Angular", "19.x", "SPA storefront + admin"],
            ["Frontend", "TypeScript", "5.6", "Langage principal frontend"],
            ["Frontend", "PrimeNG", "19.x", "Bibliothèque de composants UI"],
            ["Frontend", "RxJS", "7.8", "Programmation réactive"],
            ["Frontend", "SCSS", "—", "Styles + design system Barsha"],
            ["Frontend", "Service Worker", "Angular SW", "Offline + PWA"],
            ["Backend", "NestJS", "10.4", "Framework API métier"],
            ["Backend", "TypeScript", "5.3", "Langage principal backend"],
            ["Backend", "TypeORM", "0.3.20", "ORM + migrations"],
            ["Backend", "MSSQL", "2022", "Base de données relationnelle"],
            ["Backend", "JWT (@nestjs/jwt)", "10.2", "Authentification"],
            ["Backend", "bcrypt", "5.1", "Hachage mots de passe"],
            ["Backend", "Meilisearch SDK", "0.39", "Client recherche"],
            ["IA", "FastAPI", "0.109+", "Service IA REST"],
            ["IA", "Ollama", "latest", "Runtime LLM"],
            ["IA", "Qwen 2.5", "7B", "LLM principal"],
            ["IA", "CLIP", "OpenAI", "Embeddings images"],
            ["IA", "PyTorch", "2.x", "Framework deep learning"],
            ["IA", "Transformers (HF)", "4.30+", "Modèles HuggingFace"],
            ["Infra", "Docker", "—", "Conteneurisation"],
            ["Infra", "Docker Compose", "—", "Orchestration single-host"],
            ["Infra", "nginx", "1.27", "Reverse-proxy + TLS + cache"],
            ["Infra", "Cloudflare (option)", "—", "CDN + DDoS"],
            ["Infra", "Java 21", "—", "Outillage PlantUML uniquement"],
        ],
        col_widths_cm=[2.5, 4.0, 2.5, 7.0],
        first_col_bold=True,
    )

    heading(doc, "3.4 Architecture événementielle interne", level=2)
    justified(doc,
        "Le backend NestJS implémente une architecture événementielle interne via le module "
        "platform/events. Chaque opération métier significative — création de commande, "
        "expédition, demande de retour, fulfillment vendeur — émet un domain event sur un bus "
        "in-process, complété par une outbox persistante (table domain_events). Les "
        "consommateurs (envoi d'email, génération de reçu fiscal, déclenchement d'un drip "
        "lifecycle, indexation Meilisearch) s'abonnent aux événements qui les concernent. "
        "Cette approche, inspirée de l'event sourcing léger, présente plusieurs avantages :")
    bullet(doc, "Découplage : un nouveau consommateur (par exemple un export ERP) peut être branché sans modification du producteur.")
    bullet(doc, "Traçabilité : la table domain_events conserve l'historique pour audit ou rejouabilité.")
    bullet(doc, "Résilience : si un consommateur (ex. SMTP) est en panne, l'événement reste en outbox et est rejoué.")
    bullet(doc, "Testabilité : un test peut s'abonner aux événements pour vérifier qu'une opération métier a bien émis ce qu'il fallait.")

    heading(doc, "3.5 Sécurité et authentification", level=2)
    justified(doc,
        "L'authentification repose sur JWT, avec deux jetons par utilisateur : un access token "
        "à durée courte (1440 minutes par défaut) pour les requêtes courantes, et un refresh "
        "token plus long (7 jours) pour la rotation. Les mots de passe sont hashés via bcrypt "
        "à 12 rounds. Le contrôle d'accès est basé sur les rôles (RBAC) : visitor, customer, "
        "seller, admin. Les guards NestJS (JwtAuthGuard, RolesGuard, SellerGuard, AdminGuard) "
        "filtrent les routes selon le rôle requis.")

    justified(doc,
        "Le préflight de production introduit dans main.ts refuse formellement de démarrer le "
        "serveur si JWT_SECRET est vide ou laissé à la valeur par défaut. Cette précaution, "
        "absente du cahier initial, a été ajoutée à la suite d'une analyse de risques : un "
        "déploiement accidentel avec un secret connu publiquement compromettrait l'ensemble "
        "des sessions utilisateur. Le préflight émet également des warnings non bloquants pour "
        "les configurations dégradées (SMTP/SMS/CTP non configurés en production).")

    page_break(doc)


# ============================================================================
# CHAPITRE 4 — Modélisation
# ============================================================================
def chapitre_4(doc):
    heading(doc, "Chapitre 4 — Modélisation", level=1)

    heading(doc, "4.1 Approche méthodologique UML", level=2)
    justified(doc,
        "La modélisation s'appuie sur le langage UML 2.5 dans ses notations principales : cas "
        "d'utilisation pour la couche fonctionnelle, classes pour le modèle objet, séquence "
        "pour les interactions dynamiques, activité pour les flux métier, et déploiement pour "
        "l'architecture physique. Tous les diagrammes du présent chapitre sont produits avec "
        "PlantUML, dont les sources sont versionnées dans le dépôt et reproduites en annexe A.")

    heading(doc, "4.2 Diagramme de cas d'utilisation", level=2)
    justified(doc,
        "Le diagramme de cas d'utilisation synthétise l'ensemble des interactions entre les "
        "acteurs et le système. Il met en évidence cinq acteurs principaux (visiteur, client, "
        "vendeur marketplace, administrateur, système IA) et un acteur logique pour les "
        "passerelles externes. Les cas d'utilisation sont regroupés en trois grands paquets : "
        "storefront (utilisateurs finaux), espace vendeur (marketplace) et back-office "
        "administrateur. Les relations « include » indiquent les cas faisant systématiquement "
        "intervenir le système IA ou les services externes.")
    image(doc, "use_cases.png", width_cm=16.0,
          caption="Diagramme de cas d'utilisation de la plateforme Barsha", fig_num=1)

    heading(doc, "4.3 Diagramme de classes", level=2)
    justified(doc,
        "Le diagramme de classes ci-dessous présente un extrait du modèle objet, centré sur "
        "les entités de domaine commerce, marketplace et IA. L'extrait choisi est représentatif "
        "des relations clés ; le modèle complet, qui couvre plus de quatre-vingts entités, est "
        "dérivable à partir du dossier backend/src/*/entities/ du dépôt source. Les "
        "associations multiples (ex. User 1—* Order, Product 1—* ProductStock) reflètent le "
        "schéma TypeORM effectif.")
    image(doc, "class_diagram.png", width_cm=16.0,
          caption="Diagramme de classes (extrait — domaine commerce, marketplace et IA)", fig_num=4)

    heading(doc, "4.4 Modèle conceptuel de données (MCD / ER)", level=2)
    justified(doc,
        "Le modèle de données est exprimé directement dans la base via les définitions "
        "d'entités TypeORM. Le diagramme ER ci-dessous extrait les principales tables et "
        "relations, en respectant la nomenclature MSSQL utilisée (nvarchar, decimal, etc.) "
        "avec les types et les contraintes effectives. Les clés primaires sont notées <<PK>>, "
        "les clés étrangères <<FK>> et les contraintes d'unicité <<UK>>.")
    image(doc, "er_model.png", width_cm=16.0,
          caption="Modèle conceptuel de données (extrait — schéma relationnel MSSQL)", fig_num=5)

    heading(doc, "4.5 Diagrammes de séquence", level=2)
    justified(doc,
        "Six diagrammes de séquence sont fournis pour les interactions clés du système. Ils "
        "couvrent l'authentification, le passage de commande, les recommandations IA, la "
        "recherche visuelle, l'expédition / suivi de livraison, et la gestion administrateur "
        "(création produit + indexation Meilisearch). Chaque diagramme reflète des appels "
        "réellement effectués dans le code, avec les noms exacts des controllers, services et "
        "endpoints.")

    heading(doc, "4.5.1 Authentification", level=3)
    image(doc, "seq_auth.png", width_cm=15.5,
          caption="Diagramme de séquence — authentification (login + JWT refresh)", fig_num=6)

    heading(doc, "4.5.2 Passage de commande", level=3)
    image(doc, "seq_order.png", width_cm=15.5,
          caption="Diagramme de séquence — passage de commande (panier → paiement → notifications)", fig_num=7)

    heading(doc, "4.5.3 Recommandations IA personnalisées", level=3)
    image(doc, "seq_reco.png", width_cm=15.5,
          caption="Diagramme de séquence — recommandations IA personnalisées", fig_num=8)

    heading(doc, "4.5.4 Recherche visuelle", level=3)
    image(doc, "seq_visual.png", width_cm=15.5,
          caption="Diagramme de séquence — recherche visuelle (image → produits similaires)", fig_num=9)

    heading(doc, "4.5.5 Expédition et suivi de livraison", level=3)
    image(doc, "seq_shipping.png", width_cm=15.5,
          caption="Diagramme de séquence — expédition et suivi de livraison", fig_num=10)

    heading(doc, "4.5.6 Gestion administrateur (création produit)", level=3)
    image(doc, "seq_admin.png", width_cm=15.5,
          caption="Diagramme de séquence — gestion admin (création produit + indexation Meilisearch)", fig_num=11)

    heading(doc, "4.6 Diagramme d'activité — tunnel d'achat", level=2)
    justified(doc,
        "Le tunnel d'achat est une opération critique qui engage plusieurs sous-systèmes "
        "(stock, paiement, fiscal, notifications). Le diagramme d'activité ci-dessous explicite "
        "le flux complet, y compris les branchements conditionnels (compte existant ou non, "
        "coupon valide ou non, méthode de paiement, stock disponible ou non) et les "
        "embranchements parallèles asynchrones (envoi email, SMS, génération de reçu fiscal, "
        "déclenchement de drip lifecycle).")
    image(doc, "activity_checkout.png", width_cm=14.5,
          caption="Diagramme d'activité — tunnel d'achat Barsha", fig_num=12)

    page_break(doc)


# ============================================================================
# CHAPITRE 5 — Réalisation et implémentation
# ============================================================================
def chapitre_5(doc):
    heading(doc, "Chapitre 5 — Réalisation et implémentation", level=1)

    heading(doc, "5.1 Organisation du dépôt source", level=2)
    justified(doc,
        "Le dépôt Git du projet est organisé en monorepo, avec à la racine trois sous-dossiers "
        "principaux : backend/ pour l'application NestJS, ai-service/ pour le service Python, "
        "et src/ (à la racine) pour l'application Angular. Cette structure mono-dépôt facilite "
        "le partage de typages (DTOs), la cohérence des versions et le déploiement coordonné. "
        "Les artefacts opérationnels (Docker, nginx, env templates) sont également au niveau "
        "racine, dans le dossier deploy/ et à la racine.")

    code_block(doc,
        "PFEE/\n"
        "├── backend/                  # NestJS 10 — API métier\n"
        "│   ├── src/\n"
        "│   │   ├── ai/, orders/, products/, marketplace/, ...\n"
        "│   │   ├── database/         # seed scripts\n"
        "│   │   ├── common/           # filters, guards, interceptors\n"
        "│   │   ├── platform/         # event bus, observability, schedulers\n"
        "│   │   ├── app.module.ts\n"
        "│   │   └── main.ts           # bootstrap + production preflight\n"
        "│   ├── migrations/           # versionned SQL migrations\n"
        "│   ├── scripts/              # run-migrations.ts standalone runner\n"
        "│   ├── Dockerfile\n"
        "│   └── package.json\n"
        "├── ai-service/               # FastAPI Python — IA\n"
        "│   ├── main.py, engines/\n"
        "│   ├── Dockerfile\n"
        "│   └── requirements.txt\n"
        "├── src/                      # Angular 19 — storefront + admin\n"
        "│   ├── app/components/       # storefront\n"
        "│   ├── app/features/admin/   # back-office\n"
        "│   └── environements/\n"
        "├── docs/                     # documentation, diagrammes, rapport\n"
        "├── deploy/                   # nginx confs, cloudflare rules\n"
        "├── docker-compose.yml\n"
        "├── docker-compose.staging.yml\n"
        "├── .env.staging.example\n"
        "└── DEPLOYMENT.md\n"
    )

    heading(doc, "5.2 Inventaire des modules NestJS", level=2)
    justified(doc,
        "Les plus de 50 modules NestJS qui composent le backend peuvent être regroupés en "
        "neuf domaines fonctionnels :")
    table(doc,
        ["Domaine", "Modules NestJS"],
        [
            ["Core commerce", "auth, users, products, categories, cart, orders, payments, promotions, search, wishlist, shipping"],
            ["Marketplace & fulfillment", "marketplace, warehouses, replenishment"],
            ["IA & personnalisation", "ai, recommendations, propensity, ugc-moderation"],
            ["CRM & opérations", "reviews, product-qa, support, faq, notifications, alerts, newsletter, lifecycle, email, sms"],
            ["Conformité & sécurité", "fiscal, gdpr, fraud"],
            ["Commerce avancé", "subscriptions, preorder, bundles, configurator, dynamic-pricing, gift-cards, loyalty, referrals"],
            ["B2B", "b2b"],
            ["Contenu & expérience", "cms, outfits, sizing, feature-flags"],
            ["Analytics & infra", "analytics, admin, storefront, wave4, media, erp, health, platform/events, platform/observability, platform/schedulers"],
        ],
        col_widths_cm=[3.5, 12.5],
        first_col_bold=True,
    )

    heading(doc, "5.3 Patterns récurrents", level=2)

    heading(doc, "5.3.1 Pattern Module / Service / Controller / Repository", level=3)
    justified(doc,
        "Chaque module NestJS suit un pattern uniforme : un fichier *.module.ts qui déclare les "
        "providers et exports, un service *.service.ts qui contient la logique métier et "
        "manipule les repositories TypeORM, un ou plusieurs controllers *.controller.ts qui "
        "exposent les endpoints HTTP, et un dossier entities/ regroupant les définitions de "
        "tables. Les DTOs (Data Transfer Objects) sont rangés dans dto/ et validés via "
        "class-validator. Les guards et interceptors transverses sont dans common/.")

    heading(doc, "5.3.2 Pattern de dégradation gracieuse", level=3)
    justified(doc,
        "Tout appel à un service externe est encapsulé dans un try/catch qui en cas d'erreur "
        "logge un warning et renvoie une valeur par défaut neutre (tableau vide pour une "
        "recherche, false pour un envoi d'email, message poli pour un appel IA). Cette "
        "discipline empêche toute panne externe de propager une exception non gérée qui "
        "casserait l'application.")
    code_block(doc,
        'async sendOrderConfirmation(order: Order): Promise<{ sent: boolean }> {\n'
        '  if (!this.config.get("email.enabled")) {\n'
        '    this.logger.log(`[email] disabled — order ${order.id} confirmation logged only`);\n'
        '    return { sent: false };\n'
        '  }\n'
        '  try {\n'
        '    await this.transporter.sendMail({ ... });\n'
        '    return { sent: true };\n'
        '  } catch (e) {\n'
        '    this.logger.warn(`SMTP failed: ${e.message} — falling back to log`);\n'
        '    return { sent: false };\n'
        '  }\n'
        '}\n'
    )

    heading(doc, "5.3.3 Pattern d'événements de domaine", level=3)
    justified(doc,
        "Chaque opération métier significative émet un événement sur le bus interne via "
        "EventBusService.emit(eventName, payload). Les consommateurs s'abonnent via "
        "EventBusService.on(eventName, handler) et sont automatiquement appelés. La table "
        "domain_events conserve une trace persistante de chaque émission, ce qui permet de "
        "rejouer ou auditer les flux a posteriori.")

    heading(doc, "5.4 Implémentation de fonctions clés (extraits)", level=2)

    heading(doc, "5.4.1 Création d'une commande (extrait OrdersService)", level=3)
    justified(doc,
        "La création d'une commande est le flux le plus complexe du backend. Il enchaîne, "
        "dans une transaction logique : application des règles de pricing automatique, "
        "réservation atomique du stock multi-entrepôts, création de la commande et de ses "
        "items, déclenchement du paiement, émission d'un événement de domaine. L'extrait "
        "ci-dessous illustre la séquence (commentaires non strictement issus du code, mais "
        "fidèles à sa logique) :")
    code_block(doc,
        'async create(dto: CreateOrderDto, userId: number): Promise<Order> {\n'
        '  const cart = await this.cartService.getActiveCart(userId);\n'
        '  const priced = await this.promotions.applyAutoDiscounts(cart);\n'
        '  await this.warehouses.reserveStock(priced.items);\n'
        '  const order = this.orderRepo.create({\n'
        '    user_id: userId,\n'
        '    address_id: dto.addressId,\n'
        '    items: priced.items.map(i => ({ ... })),\n'
        '    total: priced.total,\n'
        '    status: OrderStatus.PENDING,\n'
        '  });\n'
        '  await this.orderRepo.save(order);\n'
        '  await this.payments.initiate(order, dto.paymentMethod);\n'
        '  this.bus.emit("order.placed", { orderId: order.id, userId });\n'
        '  return order;\n'
        '}\n'
    )

    heading(doc, "5.4.2 Préflight de production (main.ts)", level=3)
    justified(doc,
        "Le préflight de sécurité au boot est implémenté dans main.ts, en tête de la fonction "
        "bootstrap(), avant même l'instanciation de l'application Nest. Il refuse formellement "
        "le démarrage si JWT_SECRET est manquant ou égal au placeholder, et émet des warnings "
        "non bloquants pour les configurations dégradées :")
    code_block(doc,
        'if (process.env.NODE_ENV === "production") {\n'
        '  const jwtSecret = process.env.JWT_SECRET || "";\n'
        '  if (!jwtSecret || jwtSecret === "barsha-dev-secret-CHANGE-IN-PRODUCTION") {\n'
        '    console.error("[FATAL] NODE_ENV=production but JWT_SECRET is unset or default.");\n'
        '    console.error("[FATAL] Generate: openssl rand -base64 64");\n'
        '    process.exit(1);\n'
        '  }\n'
        '  if (jwtSecret.length < 32) {\n'
        '    console.warn("[WARN] JWT_SECRET < 32 chars — recommend at least 64.");\n'
        '  }\n'
        '  if (process.env.EMAIL_ENABLED === "true" && !process.env.SMTP_USER) {\n'
        '    console.warn("[WARN] EMAIL_ENABLED=true but SMTP_USER empty — emails will fail.");\n'
        '  }\n'
        '  // … autres warnings (SMS, CTP)\n'
        '}\n'
    )

    heading(doc, "5.4.3 Migrations versionnées (extrait run-migrations.ts)", level=3)
    justified(doc,
        "Le runner de migration parcourt les fichiers backend/migrations/<date>_<name>/up.sql "
        "dans l'ordre alphabétique, applique ceux qui ne sont pas déjà inscrits dans la table "
        "_migration_history, et calcule un checksum djb2 pour détecter toute édition "
        "ultérieure (drift). Trois subtilités méritent d'être soulignées : (i) le runner est "
        "standalone (aucune dépendance NestJS), pour pouvoir s'exécuter sans ts-node en "
        "production ; (ii) il choisit la variante .sql, .postgres.sql ou .sqlite.sql selon "
        "DB_TYPE ; (iii) pour MSSQL, il splitte les batches sur le séparateur GO que le driver "
        "Tedious ne reconnaît pas nativement.")

    heading(doc, "5.5 Front-end Angular — points saillants", level=2)
    justified(doc,
        "Le front-end est constitué de composants standalone Angular 19, ce qui permet "
        "d'éviter le boilerplate des NgModule traditionnels. Chaque page est un composant "
        "standalone qui importe uniquement ses dépendances (CommonModule, FormsModule, "
        "PrimeNG modules nécessaires). Les services Angular (CartService, AuthService, "
        "ChatService, RecommendationService, AnalyticsService) encapsulent les appels à "
        "l'API et la gestion d'état.")

    justified(doc,
        "Le storefront et le back-office partagent la même base de code mais sont "
        "logiquement séparés via le router : /<lang>/* pour le storefront, /admin/* pour "
        "l'administration. Un service worker (Angular SW) est activé exclusivement en build "
        "de production, fournissant la mise en cache des assets statiques et un mode offline "
        "minimal.")

    heading(doc, "5.6 Service IA Python — points saillants", level=2)
    justified(doc,
        "Le service ai-service est une application FastAPI qui expose quatre endpoints "
        "principaux : /chat (chatbot), /recommend (recommandations), /like-this (recherche "
        "visuelle), /moderate (modération UGC). Au démarrage, il charge les poids CLIP en "
        "RAM, calcule les embeddings de tous les produits du catalogue (cache disque) et "
        "ouvre une connexion HTTP keep-alive vers Ollama. Toute requête IA aboutit à un "
        "appel local (pas d'aller-retour cloud), ce qui maintient la latence à un niveau "
        "acceptable même sur CPU.")

    page_break(doc)


# ============================================================================
# CHAPITRE 6 — IA
# ============================================================================
def chapitre_6(doc):
    heading(doc, "Chapitre 6 — Intelligence artificielle et personnalisation", level=1)

    heading(doc, "6.1 Vision IA du projet", level=2)
    justified(doc,
        "L'intelligence artificielle, dans le projet Barsha, n'est ni un gadget marketing ni "
        "une démonstration technologique gratuite. Elle est intégrée à des points précis du "
        "parcours utilisateur où elle apporte une valeur démontrable : guider l'utilisateur "
        "qui ne sait pas formuler sa requête, lui présenter des produits qu'il n'aurait pas "
        "trouvés autrement, l'assister en cas de question. Le principe directeur est : si la "
        "brique IA est indisponible, l'expérience reste fonctionnelle, simplement moins "
        "personnalisée.")

    heading(doc, "6.2 Inventaire des briques IA livrées", level=2)
    table(doc,
        ["Brique", "Modèle / technologie", "Endpoint NestJS", "Endpoint ai-service"],
        [
            ["Chatbot conversationnel", "Qwen 2.5 7B (Ollama) + fallback Gemini/OpenRouter", "POST /api/ai/chat", "POST /chat"],
            ["Recherche visuelle", "CLIP ViT-B/32 (OpenAI)", "POST /api/ai/like-this", "POST /like-this"],
            ["Recommandations multi-stratégies", "Heuristiques + similarité catégorielle/visuelle", "GET /api/recommendations/v3", "POST /recommend"],
            ["Modération UGC", "Heuristiques texte + LLM (Qwen)", "POST /api/admin/ugc-moderation/run-pipeline", "POST /moderate"],
            ["Propensity scoring", "Heuristiques + signaux comportementaux", "GET /api/admin/propensity/score/:userId", "—"],
            ["AI stylist (bonus)", "Chat structuré (Ollama) + grounding catalogue", "POST /api/ai/stylist", "POST /stylist"],
        ],
        col_widths_cm=[3.0, 5.0, 4.5, 3.5],
        first_col_bold=True,
    )

    heading(doc, "6.3 Chatbot conversationnel", level=2)
    justified(doc,
        "Le chatbot est exposé en bas à droite de chaque page du storefront. Il accepte des "
        "questions en français, détecte les intentions (recherche d'un produit, question "
        "FAQ, demande de support, conseil de style) et répond en s'appuyant sur deux "
        "ressources : (i) le contexte conversationnel (historique de la session), (ii) un "
        "grounding produits via Meilisearch (les 5-10 produits les plus pertinents pour la "
        "requête sont injectés en contexte avant l'appel LLM, ce qui réduit drastiquement "
        "les hallucinations).")

    justified(doc,
        "L'orchestration côté NestJS est minimaliste : le AiController POST /api/ai/chat "
        "transmet la requête à l'ai-service. Côté Python, FastAPI :")
    numbered(doc, "Détermine si la requête est un message chat ou un appel produit (via heuristique sur les mots-clés).")
    numbered(doc, "Effectue une recherche Meilisearch top-5 avec la requête.")
    numbered(doc, "Construit un prompt structuré : « Tu es Barsha, un assistant shopping. Voici 5 produits du catalogue : ... Réponds à la question : ... ».")
    numbered(doc, "Envoie le prompt à Ollama (Qwen 2.5 7B).")
    numbered(doc, "Si Ollama échoue ou met plus de 10 secondes, bascule sur Gemini ou OpenRouter (selon les credentials configurés).")
    numbered(doc, "Renvoie la réponse + la liste des produits cités, pour que le frontend puisse afficher des cartes produit cliquables.")

    heading(doc, "6.4 Recherche visuelle (CLIP)", level=2)
    justified(doc,
        "La recherche visuelle permet à l'utilisateur de coller ou téléverser une image et de "
        "trouver les produits similaires du catalogue. Elle s'appuie sur le modèle CLIP, qui "
        "encode aussi bien les images que les textes dans un espace vectoriel commun de "
        "dimension 512.")

    justified(doc,
        "Le pipeline est le suivant :")
    numbered(doc, "Au démarrage de l'ai-service, on charge CLIP ViT-B/32 et on calcule l'embedding de chaque image produit du catalogue (cache disque dans /root/.cache).")
    numbered(doc, "Pour chaque requête /like-this, on encode l'image utilisateur en un vecteur 512d.")
    numbered(doc, "On calcule la similarité cosinus avec tous les vecteurs produits.")
    numbered(doc, "On retourne les top-N produits triés par score décroissant.")

    justified(doc,
        "Le coût computationnel est dominé par l'encodage de l'image utilisateur (≈ 200-500 ms "
        "sur CPU). La similarité cosinus avec quelques milliers de produits est négligeable "
        "(< 50 ms). L'expérience utilisateur reste donc fluide. La pertinence des résultats "
        "est satisfaisante sur un catalogue homogène (mode prêt-à-porter), et démonstrablement "
        "meilleure que la recherche textuelle sur des requêtes visuelles (« robe rouge à "
        "fleurs avec ceinture »).")

    heading(doc, "6.5 Recommandations multi-stratégies", level=2)
    justified(doc,
        "Le moteur de recommandation expose plus de huit stratégies, sélectionnables via le "
        "paramètre strategy de l'endpoint /api/recommendations/v3 :")
    bullet(doc, "trending — produits les plus consultés / achetés sur 7 jours (calcul backend pur).")
    bullet(doc, "new-arrivals — produits récemment ajoutés au catalogue.")
    bullet(doc, "seasonal — produits associés à la saison courante (basé sur tags).")
    bullet(doc, "editorial — sélections curatées par l'admin (table dédiée).")
    bullet(doc, "personalized — basé sur l'historique utilisateur (recently_viewed, wishlist, orders).")
    bullet(doc, "complementary — produits achetés conjointement (co-occurrence sur les commandes).")
    bullet(doc, "cart-based — recommandations issues du contenu du panier courant.")
    bullet(doc, "bundle — bundles configurés par l'admin auxquels le produit appartient.")
    bullet(doc, "similar — produits visuellement similaires (CLIP) à un produit donné.")

    justified(doc,
        "Chaque stratégie a un fallback : si trending ne retourne rien (catalogue tout récent), "
        "on bascule sur new-arrivals ; si personalized n'a pas assez de signal (utilisateur "
        "anonyme), on bascule sur trending ; etc. Cette logique de cascade est centralisée "
        "dans RecommendationsService.recommend().")

    heading(doc, "6.6 Modération UGC", level=2)
    justified(doc,
        "La modération automatique des contenus utilisateurs (avis, photos, questions Q&A) "
        "passe par un pipeline en deux étapes : (i) une étape texte basée sur des "
        "heuristiques + un appel LLM pour scorer la toxicité, le hors-sujet et le spam ; "
        "(ii) une étape image (si applicable) basée sur des heuristiques NSFW. Les contenus "
        "scorés au-dessus d'un seuil sont placés dans la file admin (status PENDING_REVIEW) "
        "pour validation manuelle. Cette logique non-bloquante préserve la fluidité — un "
        "client qui poste un avis voit son contenu soumis immédiatement, mais ne s'affiche "
        "publiquement qu'après validation.")

    heading(doc, "6.7 Propensity scoring", level=2)
    justified(doc,
        "Le module propensity calcule, pour chaque utilisateur, trois scores agrégés :")
    bullet(doc, "CLV (Customer Lifetime Value) : valeur cumulée pondérée des commandes, projetée sur 12 mois.")
    bullet(doc, "Churn risk : probabilité de désengagement, basée sur la fréquence et la récence des interactions.")
    bullet(doc, "Next-purchase timing : estimation de la fenêtre de prochaine commande probable.")

    justified(doc,
        "Ces scores alimentent les segments de lifecycle marketing (le drip 'winback' cible "
        "automatiquement les utilisateurs avec churn_risk élevé) et la vue Customer 360° "
        "côté admin. L'implémentation reste heuristique (pas de vrai modèle ML supervisé) "
        "mais fournit un signal exploitable sans nécessiter d'historique massif.")

    heading(doc, "6.8 Mode dégradé et résilience", level=2)
    justified(doc,
        "Toutes les briques IA suivent un protocole de dégradation gracieuse strict :")
    bullet(doc, "Si Ollama est indisponible, le chatbot bascule sur Gemini ou OpenRouter, et à défaut renvoie une réponse pré-rédigée (« Je suis indisponible pour le moment, voici notre FAQ »).")
    bullet(doc, "Si CLIP n'est pas chargé, la recherche visuelle renvoie un message « fonctionnalité temporairement indisponible » et l'UI reste fonctionnelle.")
    bullet(doc, "Si l'ai-service ne répond pas, les recommandations basculent sur des stratégies pure-backend (trending, new-arrivals).")
    bullet(doc, "Si Meilisearch est indisponible, la recherche textuelle renvoie un tableau vide (pas d'erreur côté UI).")
    bullet(doc, "Aucun de ces fallbacks ne casse le storefront ni l'admin.")

    page_break(doc)


# ============================================================================
# CHAPITRE 7 — Tests, validation et qualité
# ============================================================================
def chapitre_7(doc):
    heading(doc, "Chapitre 7 — Tests, validation et qualité", level=1)

    heading(doc, "7.1 Stratégie de tests", level=2)
    justified(doc,
        "La stratégie de tests retenue combine quatre niveaux : tests unitaires (jest + "
        "ts-jest), tests d'intégration (sur DB SQLite en mémoire), tests UAT manuels "
        "exhaustifs, et tests de bout-en-bout via les endpoints de production. Le projet "
        "étant conduit par un développeur unique sur une durée limitée, l'effort a été "
        "concentré sur les niveaux qui apportent le maximum de signal : tests d'intégration "
        "pour les services critiques (auth, orders, payments) et UAT manuel pour la "
        "couverture fonctionnelle large.")

    heading(doc, "7.2 Plan de tests UAT", level=2)
    justified(doc,
        "Un plan de tests UAT couvre l'ensemble des flux métier majeurs. Chaque flux est "
        "testé sur le storefront et, le cas échéant, sur le back-office.")
    table(doc,
        ["Flux", "Étapes", "Résultat attendu", "Statut"],
        [
            ["Inscription + connexion", "1. /sign 2. saisie email + mdp 3. POST /api/auth/register 4. login", "Compte créé, JWT renvoyé, redirection profil", "OK"],
            ["Navigation catalogue", "1. /tn/femme 2. filtres (prix, taille) 3. tri", "Pagination, filtres réactifs, tri stable", "OK"],
            ["Ajout au panier", "1. fiche produit 2. choix variante 3. ajouter", "Compteur panier mis à jour, toast confirmation", "OK"],
            ["Application coupon", "1. /panier 2. saisie WELCOME10 3. validate", "Réduction appliquée, total mis à jour", "OK"],
            ["Tunnel d'achat (CTP)", "1. /checkout 2. adresse 3. CTP sandbox 4. confirm", "Commande créée, statut PAID, email + SMS envoyés", "OK"],
            ["Tunnel d'achat (COD)", "Idem mais paiement COD", "Commande créée, statut PENDING (paiement à la livraison)", "OK"],
            ["Demande de retour", "1. /compte/commandes 2. retour 3. motif", "RMA créée, statut PENDING, email envoyé", "OK"],
            ["Recherche textuelle", "Saisie 'robe rouge'", "Résultats Meilisearch pertinents, latence < 200 ms", "OK"],
            ["Recherche visuelle", "Upload image robe", "Top-N produits visuellement similaires, latence < 1.5 s", "OK"],
            ["Chatbot", "« Quelles robes pour mariage ? »", "Réponse cohérente avec produits cités, < 5 s", "OK"],
            ["Recommandations", "Page d'accueil connecté", "8+ stratégies retournent des suggestions cohérentes", "OK"],
            ["Demande RGPD export", "/compte/rgpd → demander export", "Demande créée, traitable côté admin", "OK"],
            ["Validation vendeur", "Admin → marketplace queue → approve", "Statut SELLER passé à APPROVED, email envoyé", "OK"],
            ["Création produit", "Admin → produits → nouveau", "Produit créé, indexé Meilisearch, visible storefront", "OK"],
            ["Préflight production", "Démarrage avec JWT_SECRET par défaut", "App refuse de démarrer (exit 1, [FATAL])", "OK"],
            ["Migrations apply (MSSQL)", "npm run migrate:prod", "Migrations appliquées, idempotent au 2nd run", "OK"],
        ],
        col_widths_cm=[3.5, 5.5, 5.5, 1.5],
        first_col_bold=True,
    )

    heading(doc, "7.3 Tests de qualité statique", level=2)
    bullet(doc, "Compilation TypeScript en mode strict — zéro erreur sur backend (npm run build) et frontend (ng build --configuration production).")
    bullet(doc, "ESLint avec règles standards NestJS et Angular.")
    bullet(doc, "Validation runtime des DTOs via class-validator (whitelist + transform automatique).")
    bullet(doc, "Audit des dépendances npm (npm audit) — pas de vulnérabilité critique au moment du livrable.")

    heading(doc, "7.4 Validation des points critiques", level=2)
    justified(doc,
        "Trois points particulièrement sensibles ont fait l'objet d'une validation explicite :")
    bullet(doc, "Préflight production : testé manuellement avec JWT_SECRET vide et avec le placeholder. Dans les deux cas, l'application sort en exit 1 avec messages [FATAL] explicites.")
    bullet(doc, "Migrations bout-en-bout MSSQL : testées contre une instance MSSQL réelle. Premier run applique 2 migrations en ~400 ms ; deuxième run signale 'already applied' (idempotent).")
    bullet(doc, "Dégradation gracieuse : test manuel avec Meilisearch éteint, SMTP unreachable, ai-service éteint, Ollama éteint. L'application boote, les pages se chargent, les warnings sont émis, l'expérience reste fonctionnelle.")

    heading(doc, "7.5 Limites assumées de la couverture de tests", level=2)
    justified(doc,
        "La couverture de tests automatisés reste partielle. Les modules critiques (auth, "
        "orders, payments) disposent de tests unitaires de leurs principaux services, mais "
        "l'intégralité des plus de 50 modules n'est pas couverte. Cette limite, explicitement "
        "assumée, est due au choix d'investir l'effort de développement dans la richesse "
        "fonctionnelle plutôt que dans la couverture exhaustive de tests. Le projet livre en "
        "contrepartie un plan de tests UAT manuel formel et reproductible.")

    page_break(doc)


# ============================================================================
# CHAPITRE 8 — Déploiement
# ============================================================================
def chapitre_8(doc):
    heading(doc, "Chapitre 8 — Déploiement, exploitation et industrialisation", level=1)

    heading(doc, "8.1 Stratégie de déploiement", level=2)
    justified(doc,
        "L'industrialisation du projet a été conduite avec deux objectifs : (i) rendre le "
        "déploiement reproductible (n'importe quel développeur, sur n'importe quelle machine, "
        "doit pouvoir reproduire l'environnement complet), (ii) rendre la mise en production "
        "envisageable à court terme (toutes les briques doivent passer en mode production "
        "sans réécriture). Trois artefacts principaux y contribuent : Docker compose, le "
        "système de migrations versionnées, et le préflight de sécurité.")

    image(doc, "deployment.png", width_cm=15.5,
          caption="Diagramme de déploiement (staging single-host)", fig_num=3)

    heading(doc, "8.2 Configuration par environnement", level=2)
    justified(doc,
        "La configuration applicative est entièrement pilotée par variables d'environnement, "
        "consolidées dans deux fichiers templates : backend/.env.example pour le développement "
        "et .env.staging.example pour le déploiement single-host docker-compose. Ces fichiers "
        "documentent l'ensemble des 38 variables organisées en 9 groupes :")
    table(doc,
        ["Groupe", "Variables principales"],
        [
            ["App core", "NODE_ENV, PORT, DEBUG"],
            ["Database", "DB_TYPE, DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME, DB_POOL_SIZE"],
            ["JWT / Auth", "JWT_SECRET, JWT_ALGORITHM, JWT_ACCESS_TOKEN_EXPIRE_MINUTES, JWT_REFRESH_TOKEN_EXPIRE_DAYS"],
            ["CORS", "CORS_ORIGINS, CORS_ALLOW_CREDENTIALS, CORS_MAX_AGE"],
            ["App URLs", "APP_URL, FRONTEND_URL"],
            ["Search (Meilisearch)", "MEILISEARCH_URL, MEILISEARCH_TOKEN"],
            ["AI services", "AI_SERVICE_URL, OLLAMA_URL, OLLAMA_MODEL, GEMINI_API_KEY, OPENROUTER_API_KEY"],
            ["Payment (CTP)", "CTP_MERCHANT_ID, CTP_API_KEY, CTP_SECRET_KEY, CTP_API_URL, CTP_SANDBOX_MODE"],
            ["Email (SMTP)", "EMAIL_ENABLED, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM, EMAIL_FROM_NAME"],
            ["SMS", "SMS_ENABLED, SMS_PROVIDER, SMS_FROM, SMS_TWILIO_*, SMS_INFOBIP_*"],
            ["Shipping", "FIRST_DELIVERY_*, ARAMEX_*"],
            ["Loyalty / Alerts", "LOYALTY_*, ALERTS_*"],
            ["Fiscal (TTN)", "FISCAL_TTN_ENABLED, FISCAL_TTN_ENDPOINT, FISCAL_TTN_API_KEY, FISCAL_ISSUER_MATRICULE"],
            ["Admin seed", "ADMIN_EMAIL, ADMIN_PASSWORD"],
        ],
        col_widths_cm=[3.5, 12.5],
        first_col_bold=True,
    )

    heading(doc, "8.3 Migrations versionnées", level=2)
    justified(doc,
        "Le système de migrations couvre trois besoins : (i) versionnement (chaque migration "
        "est un fichier SQL nommé par date), (ii) idempotence (chaque migration utilise des "
        "guards IF NOT EXISTS / OBJECT_ID IS NULL), (iii) drift detection (chaque application "
        "stocke un checksum djb2 du fichier ; toute édition ultérieure est signalée). Le "
        "runner backend/scripts/run-migrations.ts est standalone — aucune dépendance NestJS — "
        "et lit ses paramètres directement depuis process.env, ce qui le rend compilable en "
        "JS et exécutable sur un hôte de production sans ts-node.")

    code_block(doc,
        "# Workflow type pour un déploiement\n"
        "cd backend\n"
        "npm ci\n"
        "npm run build\n"
        "npm run build:scripts          # compile le runner en dist/scripts/\n"
        "npm run migrate:prod:dry       # dry-run pour vérifier\n"
        "npm run migrate:prod           # apply\n"
        "NODE_ENV=production node dist/main.js\n"
    )

    heading(doc, "8.4 Préflight de sécurité au boot", level=2)
    justified(doc,
        "Implémenté en tête de bootstrap() dans main.ts, le préflight refuse formellement de "
        "démarrer en NODE_ENV=production si JWT_SECRET est vide ou égal au placeholder. Il "
        "émet aussi des warnings non bloquants pour les configurations dégradées : "
        "JWT_SECRET court (< 32 caractères), EMAIL_ENABLED=true sans SMTP_USER, SMS_ENABLED "
        "sans credentials provider, CTP_SANDBOX_MODE != 'false'. La philosophie est : "
        "« degraded > down ». L'application boote dans un mode dégradé contrôlé plutôt que "
        "de refuser le démarrage sur une mauvaise configuration récupérable.")

    heading(doc, "8.5 Empaquetage Docker", level=2)
    justified(doc,
        "Trois Dockerfiles sont fournis (backend, ai-service, et nginx via image officielle), "
        "avec deux configurations Docker Compose :")
    bullet(doc, "docker-compose.yml — la pile IA seule (Ollama + ai-service + backend), pour les développeurs travaillant en local avec leur propre DB.")
    bullet(doc, "docker-compose.staging.yml — la pile complète (MSSQL 2022 + Meilisearch 1.6 + Ollama + ai-service + backend + frontend nginx), pour un déploiement single-host représentatif d'un environnement de production.")

    justified(doc,
        "Le compose staging utilise des healthchecks et la condition service_healthy de "
        "Docker pour garantir l'ordre de démarrage : MSSQL et Meilisearch doivent être prêts "
        "avant que le backend ne tente de se connecter. Les volumes persistent les données "
        "MSSQL et Meilisearch entre redémarrages.")

    heading(doc, "8.6 Reverse-proxy nginx et CDN", level=2)
    justified(doc,
        "Deux fichiers nginx sont fournis : deploy/nginx.sample.conf pour un déploiement "
        "natif avec TLS (Let's Encrypt) et HSTS, et deploy/nginx.staging.conf pour le compose "
        "staging (sans TLS, hostnames de containers). Les deux configurations partagent les "
        "principes : cache long sur les assets hashés, no-cache strict sur le service worker "
        "et /index.html, no-store sur /api/, rate limit léger sur l'API, gzip activé.")

    justified(doc,
        "Une recette Cloudflare est par ailleurs documentée (deploy/cloudflare-rules.md) "
        "pour le passage à un CDN public : la règle critique est de ne jamais cacher "
        "/ngsw-worker.js au niveau CDN, car ce fichier sert de source de vérité pour les "
        "mises à jour applicatives.")

    heading(doc, "8.7 Procédure first-boot sur DB fraîche", level=2)
    justified(doc,
        "Une particularité opérationnelle, documentée dans DEPLOYMENT.md §15.3, mérite "
        "d'être mentionnée : sur une base de données vierge, le simple npm run migrate:prod "
        "ne suffit pas, car les 2 migrations versionnées ne couvrent que des deltas "
        "post-baseline. Les 80+ tables d'entités sont créées par TypeORM synchronize:true, "
        "qui n'est actif qu'en NODE_ENV=development. La procédure first-boot est donc :")
    numbered(doc, "Démarrage en NODE_ENV=development pour que synchronize crée toutes les tables (~25 secondes).")
    numbered(doc, "Arrêt du serveur.")
    numbered(doc, "npm run migrate:prod pour appliquer les deltas.")
    numbered(doc, "Démarrage en NODE_ENV=production pour usage réel.")

    justified(doc,
        "Ce point est documenté comme une limitation à corriger post-projet (génération d'une "
        "migration baseline qui dumperait l'intégralité du schéma initial), mais ne constitue "
        "pas un blocage opérationnel.")

    page_break(doc)


# ============================================================================
# CHAPITRE 9 — Bilan
# ============================================================================
def chapitre_9(doc):
    heading(doc, "Chapitre 9 — Bilan, apports et perspectives", level=1)

    heading(doc, "9.1 Bilan fonctionnel", level=2)
    justified(doc,
        "À l'issue du projet, les 19 exigences fonctionnelles initiales (F01-F19) sont toutes "
        "livrées et opérationnelles. À ces exigences se sont ajoutées 56 exigences "
        "supplémentaires (F20-F75) couvrant les thématiques marketplace, multi-entrepôts, "
        "lifecycle marketing, conformité réglementaire, B2B, observabilité et industrialisation. "
        "L'écart entre le périmètre prévu et le périmètre livré est documenté de façon "
        "exhaustive dans la version 2 du cahier des charges.")

    heading(doc, "9.2 Bilan technique", level=2)
    justified(doc,
        "Sur le plan technique, le projet a livré environ 80 000 lignes de code applicatif "
        "(backend NestJS + frontend Angular + ai-service Python), plus de 50 modules NestJS "
        "indépendants, plus de 80 entités TypeORM, plus de 400 endpoints REST documentés "
        "via Swagger, et 12 diagrammes UML versionnés. La compilation TypeScript stricte "
        "passe sans erreur (zéro warning bloquant) et la build de production frontend Angular "
        "produit un bundle optimisé avec service worker.")

    heading(doc, "9.3 Bilan industrialisation", level=2)
    justified(doc,
        "Trois apports d'industrialisation distinguent ce projet d'un démonstrateur classique :")
    bullet(doc, "Préflight de sécurité au boot : aucun déploiement accidentel avec un secret par défaut n'est possible.")
    bullet(doc, "Migrations versionnées avec drift detection : le schéma de production est traçable et reproductible.")
    bullet(doc, "Configuration Docker compose staging single-host : un environnement représentatif d'une production peut être levé en une commande.")

    heading(doc, "9.4 Apports pédagogiques et méthodologiques", level=2)
    justified(doc,
        "Le projet a permis de mobiliser et de consolider un large spectre de compétences :")
    table(doc,
        ["Domaine", "Compétences mobilisées"],
        [
            ["Architecture logicielle", "Design en couches, modularité, event-driven, séparation services"],
            ["Backend Node.js", "NestJS, TypeORM, JWT, validation, guards, interceptors, decorators"],
            ["Frontend web", "Angular 19, RxJS, standalone components, design system, service worker, PWA"],
            ["Intelligence artificielle", "LLM (Ollama), embeddings (CLIP), pipeline ML (PyTorch), recommandation multi-stratégies"],
            ["Base de données", "Modélisation MCD, MSSQL, requêtes complexes, ORM, migrations"],
            ["Sécurité", "JWT, bcrypt, RBAC, XSS/CSRF/injection, préflight, secrets management"],
            ["DevOps", "Docker, Docker Compose, nginx, environnements, CI-friendly scripts, observabilité"],
            ["Conformité", "RGPD (export, effacement, consentement), TTN fiscal Tunisie"],
            ["Méthodologie", "Cadrage, cahier des charges, modélisation UML, tests UAT, documentation"],
            ["Communication", "Documentation technique (~10 docs), rapport mémoire, soutenance"],
        ],
        col_widths_cm=[3.5, 12.5],
        first_col_bold=True,
    )

    heading(doc, "9.5 Limites identifiées", level=2)
    bullet(doc, "Couverture de tests automatisés partielle — l'effort a privilégié la richesse fonctionnelle.")
    bullet(doc, "Multi-tenant SaaS non couvert — le code est mono-tenant, l'extension SaaS reste une perspective.")
    bullet(doc, "Mise en production réelle non effectuée — credentials marchands CTP, fiscal TTN, transporteurs sont à obtenir.")
    bullet(doc, "Fallback SQLite cassé — les entités utilisent des types nvarchar(MAX) MSSQL-spécifiques.")
    bullet(doc, "Bootstrap DB fraîche en deux temps — une migration baseline reste à produire.")

    heading(doc, "9.6 Perspectives", level=2)
    bullet(doc, "Court terme : compléter la couverture de tests automatisés (objectif 70 % de coverage sur les services critiques) ; produire la migration baseline pour permettre un first-boot en une commande.")
    bullet(doc, "Moyen terme : passer en production réelle avec credentials marchands, configuration cloud (AWS / Azure / OVH), SLA de disponibilité, monitoring (Datadog, New Relic ou alternatives open source).")
    bullet(doc, "Moyen terme : enrichir le moteur de recommandation par un vrai modèle collaboratif sur trafic réel (matrix factorization, deep learning sur séquences).")
    bullet(doc, "Long terme : extension multi-tenant pour héberger d'autres marques que Barsha (logique SaaS).")
    bullet(doc, "Long terme : application mobile native (React Native ou Flutter) qui s'appuierait sur l'API NestJS existante.")
    bullet(doc, "Long terme : essayage virtuel par AR (intégration de modèles de pose 3D et de tissus).")

    heading(doc, "9.7 Risques résiduels", level=2)
    table(doc,
        ["Risque", "Probabilité", "Impact", "Mitigation"],
        [
            ["Drift de schéma DB en production", "Faible", "Élevé", "Drift detection + ne jamais éditer une migration appliquée"],
            ["Indisponibilité d'un service externe", "Moyenne", "Faible (graceful)", "Dégradation gracieuse systématique (testée)"],
            ["Compromission JWT_SECRET en production", "Faible", "Critique", "Préflight refuse le boot avec secret par défaut"],
            ["Saturation index Meilisearch", "Faible", "Moyen", "Catalogue cible < 10 k SKU ; reindex incrémental"],
            ["Litige conformité RGPD", "Faible", "Élevé", "Module gdpr complet (export, effacement, audit)"],
            ["Litige fiscal Tunisie", "Faible", "Élevé", "Module fiscal/TTN branchable, sandbox par défaut"],
        ],
        col_widths_cm=[5.0, 2.5, 2.5, 6.0],
        first_col_bold=True,
    )

    page_break(doc)


# ============================================================================
# Conclusion
# ============================================================================
def conclusion(doc):
    heading(doc, "Conclusion générale", level=1)

    justified(doc,
        "Le projet de fin d'études détaillé dans ce mémoire s'est donné pour objectif initial "
        "de concevoir et développer une plateforme e-commerce intelligente pour la marque "
        "Barsha. À ce premier objectif sont venus s'ajouter, au fil de la réalisation, des "
        "objectifs d'industrialisation et d'extension fonctionnelle qui ont fait évoluer le "
        "projet vers un véritable écosystème commerce omnicanal.")

    justified(doc,
        "Le livrable final dépasse largement le périmètre initial : plus de 50 modules "
        "NestJS, plus de 80 entités, plus de 400 endpoints REST, un service IA Python "
        "autonome combinant LLM local Ollama et embeddings CLIP, un front-end Angular 19 "
        "comprenant un storefront premium et un back-office de plus de 30 pages, une "
        "marketplace multi-vendeurs avec gestion de fulfillments et de payouts, des modules "
        "de conformité réglementaire (RGPD, TTN), un moteur d'automation marketing, et une "
        "industrialisation complète (Docker, migrations versionnées, préflight de sécurité, "
        "documentation opérationnelle).")

    justified(doc,
        "Sur le plan méthodologique, le projet illustre la capacité d'un développeur unique "
        "à conduire, sur une durée limitée, une réalisation logicielle d'envergure, à "
        "condition d'adopter une discipline rigoureuse — versionnement systématique, "
        "modularité forte, dégradation gracieuse comme principe directeur, et documentation "
        "concomitante au code. La méthodologie itérative par vagues fonctionnelles a permis "
        "de garder en permanence une plateforme déployable et démontrable.")

    justified(doc,
        "Sur le plan technique, le projet a permis de mobiliser un large spectre de "
        "compétences en architecture logicielle, en développement web full-stack, en "
        "intelligence artificielle, en bases de données, en sécurité et en DevOps. Il "
        "constitue à mes yeux un apprentissage approfondi et structurant.")

    justified(doc,
        "Plusieurs perspectives s'ouvrent à l'issue du projet : extension de la couverture "
        "de tests automatisés, mise en production réelle avec credentials marchands, "
        "enrichissement du moteur de recommandation par un vrai modèle collaboratif sur "
        "trafic réel, extension multi-tenant pour la logique SaaS, et déclinaison mobile "
        "native. Aucune de ces perspectives n'implique de remise en cause de l'architecture "
        "actuelle — toutes sont des extensions naturelles sur le socle livré.")

    justified(doc,
        "Au-delà de la dimension technique et académique, le projet illustre, je l'espère, "
        "qu'il est aujourd'hui possible — pour une marque tunisienne, avec des moyens "
        "raisonnables et des briques open source — de construire une plateforme digitale "
        "comparable, en richesse fonctionnelle et en qualité d'expérience, aux plateformes "
        "internationales. La barrière à l'entrée du e-commerce intelligent s'est "
        "effondrée ; ce qui reste différenciant, c'est la rigueur d'exécution et "
        "l'attention au détail.")

    page_break(doc)


# ============================================================================
# Bibliographie
# ============================================================================
def bibliographie(doc):
    heading(doc, "Bibliographie", level=1)

    heading(doc, "Ouvrages et articles", level=2)
    para(doc,
        "[1] FOWLER, Martin. Patterns of Enterprise Application Architecture. Addison-Wesley, "
        "2002. Référence canonique sur les patterns de couches, repository et services.")
    para(doc,
        "[2] EVANS, Eric. Domain-Driven Design — Tackling Complexity in the Heart of "
        "Software. Addison-Wesley, 2003. Cadre conceptuel pour le découpage en "
        "bounded contexts qui inspire l'organisation des modules NestJS.")
    para(doc,
        "[3] NEWMAN, Sam. Building Microservices. O'Reilly, 2nd edition, 2021. Discussion "
        "des trade-offs micro-services vs monolithe modulaire — base du choix d'un "
        "monolithe modulaire NestJS + service IA satellite.")
    para(doc,
        "[4] RADFORD, Alec et al. Learning Transferable Visual Models From Natural "
        "Language Supervision. arXiv:2103.00020, 2021. Article fondateur de CLIP, "
        "modèle utilisé pour la recherche visuelle.")
    para(doc,
        "[5] BAI, Jinze et al. Qwen Technical Report. arXiv:2309.16609, 2023. Rapport "
        "technique sur la famille de LLM Qwen, dont la version 2.5 7B est utilisée "
        "comme assistant conversationnel local.")
    para(doc,
        "[6] CHEN, Jianbo et al. Wide & Deep Learning for Recommender Systems. arXiv:1606.07792, "
        "2016. Référence sur les systèmes de recommandation industriels.")

    heading(doc, "Webographie", level=2)
    para(doc, "[W1] Documentation officielle NestJS — https://docs.nestjs.com/")
    para(doc, "[W2] Documentation officielle Angular — https://angular.dev/")
    para(doc, "[W3] Documentation officielle TypeORM — https://typeorm.io/")
    para(doc, "[W4] Documentation officielle FastAPI — https://fastapi.tiangolo.com/")
    para(doc, "[W5] Ollama — https://ollama.com/")
    para(doc, "[W6] Meilisearch documentation — https://docs.meilisearch.com/")
    para(doc, "[W7] OpenAI CLIP repository — https://github.com/openai/CLIP")
    para(doc, "[W8] PrimeNG documentation — https://primeng.org/")
    para(doc, "[W9] OWASP Top 10 — https://owasp.org/www-project-top-ten/")
    para(doc, "[W10] RGPD — règlement (UE) 2016/679 — https://eur-lex.europa.eu/eli/reg/2016/679/oj")
    para(doc, "[W11] PlantUML — https://plantuml.com/")
    para(doc, "[W12] Docker Compose — https://docs.docker.com/compose/")
    para(doc, "[W13] Tunisia Trade Network (TTN) — https://www.ttn.tn/")
    para(doc, "[W14] Click-to-Pay (CTP) Tunisie — https://www.konnect.network/")

    page_break(doc)


# ============================================================================
# Annexes
# ============================================================================
def annexes(doc):
    heading(doc, "Annexes", level=1)

    heading(doc, "Annexe A — Codes sources PlantUML", level=2)
    justified(doc,
        "Les sources PlantUML de l'ensemble des diagrammes UML utilisés dans ce mémoire "
        "sont versionnées dans le dépôt sous docs/_build/puml/ et reproduites en "
        "intégralité dans le document complémentaire docs/Annexes_UML_Barsha.docx. "
        "Ce document complémentaire est joint au mémoire principal afin de permettre la "
        "régénération des diagrammes (commande : "
        "java -jar plantuml.jar -tpng <fichier>.puml).")
    para(doc, "Les douze diagrammes annexés sont :", italic=True)
    bullet(doc, "01_use_cases.puml — Diagramme de cas d'utilisation")
    bullet(doc, "02_architecture.puml — Architecture logicielle")
    bullet(doc, "03_deployment.puml — Diagramme de déploiement")
    bullet(doc, "04_class_diagram.puml — Diagramme de classes")
    bullet(doc, "05_er_model.puml — Modèle conceptuel de données")
    bullet(doc, "06_seq_auth.puml — Séquence authentification")
    bullet(doc, "07_seq_order.puml — Séquence passage de commande")
    bullet(doc, "08_seq_recommendation.puml — Séquence recommandations")
    bullet(doc, "09_seq_visual_search.puml — Séquence recherche visuelle")
    bullet(doc, "10_seq_shipping.puml — Séquence expédition")
    bullet(doc, "11_seq_admin.puml — Séquence gestion admin")
    bullet(doc, "12_activity_checkout.puml — Activité tunnel d'achat")

    heading(doc, "Annexe B — Variables d'environnement (extrait .env.example)", level=2)
    code_block(doc,
        "# ─── App core ───────────────────────────────────────────────────────────────\n"
        "NODE_ENV=development        # development | staging | production\n"
        "PORT=8000\n"
        "\n"
        "# ─── Database ───────────────────────────────────────────────────────────────\n"
        "DB_TYPE=mssql\n"
        "DB_HOST=DESKTOP-KOR5QAB\n"
        "DB_PORT=1433\n"
        "DB_USERNAME=admin\n"
        "DB_PASSWORD=admin123\n"
        "DB_NAME=barsha\n"
        "\n"
        "# ─── JWT (REQUIRED IN PRODUCTION) ───────────────────────────────────────────\n"
        "# Generate with: openssl rand -base64 64\n"
        "JWT_SECRET=barsha-dev-secret-CHANGE-IN-PRODUCTION\n"
        "JWT_ALGORITHM=HS256\n"
        "\n"
        "# ─── CORS ───────────────────────────────────────────────────────────────────\n"
        "CORS_ORIGINS=http://localhost:4200,https://barsha.com.tn\n"
        "\n"
        "# ─── Search (Meilisearch) ───────────────────────────────────────────────────\n"
        "MEILISEARCH_URL=http://localhost:7700\n"
        "MEILISEARCH_TOKEN=\n"
        "\n"
        "# ─── AI services ────────────────────────────────────────────────────────────\n"
        "AI_SERVICE_URL=http://localhost:8001\n"
        "OLLAMA_URL=http://localhost:11434\n"
        "OLLAMA_MODEL=qwen2.5:7b\n"
        "GEMINI_API_KEY=\n"
        "OPENROUTER_API_KEY=\n"
        "\n"
        "# ─── Payment (CTP) ──────────────────────────────────────────────────────────\n"
        "CTP_API_URL=https://api.sandbox.ctp.tn\n"
        "CTP_SANDBOX_MODE=true\n"
    )

    heading(doc, "Annexe C — Extrait Dockerfile backend", level=2)
    code_block(doc,
        "FROM node:20-alpine AS builder\n"
        "WORKDIR /app\n"
        "COPY package*.json ./\n"
        "RUN npm ci\n"
        "COPY . .\n"
        "RUN npx nest build && npm run build:scripts\n"
        "\n"
        "FROM node:20-alpine AS runtime\n"
        "ENV NODE_ENV=production\n"
        "WORKDIR /app\n"
        "COPY package*.json ./\n"
        "RUN npm ci --omit=dev\n"
        "COPY --from=builder /app/dist ./dist\n"
        "COPY --from=builder /app/migrations ./migrations\n"
        "EXPOSE 8000\n"
        "HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \\\n"
        "  CMD wget -qO- http://localhost:8000/health || exit 1\n"
        'CMD ["node", "dist/main.js"]\n'
    )

    heading(doc, "Annexe D — Extrait docker-compose.staging.yml", level=2)
    code_block(doc,
        "services:\n"
        "  mssql:\n"
        "    image: mcr.microsoft.com/mssql/server:2022-latest\n"
        "    environment:\n"
        '      ACCEPT_EULA: "Y"\n'
        "      MSSQL_SA_PASSWORD: ${DB_PASSWORD}\n"
        "    ports: [\"1433:1433\"]\n"
        "    healthcheck:\n"
        '      test: ["CMD-SHELL", "/opt/mssql-tools18/bin/sqlcmd -S localhost ..."]\n'
        "  meilisearch:\n"
        "    image: getmeili/meilisearch:v1.6\n"
        "    ports: [\"7700:7700\"]\n"
        "  ollama:\n"
        "    image: ollama/ollama:latest\n"
        "    ports: [\"11434:11434\"]\n"
        "  ai-service:\n"
        "    build: { context: ./ai-service }\n"
        "  backend:\n"
        "    build: { context: ./backend }\n"
        "    env_file: .env.staging\n"
        "    depends_on:\n"
        "      mssql: { condition: service_healthy }\n"
        "      meilisearch: { condition: service_healthy }\n"
        "  frontend:\n"
        "    image: nginx:1.27-alpine\n"
        "    ports: [\"80:80\"]\n"
        "    volumes:\n"
        "      - ./dist/barsha/browser:/usr/share/nginx/html:ro\n"
    )

    heading(doc, "Annexe E — Procédure de soutenance", level=2)
    justified(doc,
        "Le scénario de démonstration et les talking points de fallback sont consolidés dans "
        "deux documents joints au dépôt : docs/DEMO_SCENARIO.md (scénario en 8 étapes pour 15-20 "
        "minutes de démo) et docs/SOUTENANCE_PREFLIGHT.md (checklist T-30 minutes + plan B en "
        "cas de panne en direct). Ces documents sont consultables en parallèle du présent "
        "rapport et constituent le support opérationnel pour la soutenance.")

    heading(doc, "Annexe F — Glossaire métier", level=2)
    table(doc,
        ["Terme", "Définition"],
        [
            ["B2B / B2C", "Modèles de vente entre entreprises / d'entreprise à consommateur final."],
            ["COD (Cash On Delivery)", "Paiement à la livraison, mode très répandu en Tunisie."],
            ["Drip (lifecycle)", "Séquence d'emails déclenchée automatiquement par un événement métier (welcome, panier abandonné…)."],
            ["Fulfillment", "Processus d'expédition d'une commande, de la préparation à la remise au transporteur."],
            ["KYC", "Know Your Customer — procédure de vérification d'identité (vendeur, client B2B)."],
            ["Marketplace", "Plateforme hébergeant plusieurs vendeurs distincts."],
            ["Payout", "Reversement d'une période à un vendeur partenaire, après déduction de la commission."],
            ["RMA", "Return Merchandise Authorization — procédure formelle de retour produit."],
            ["Safety stock", "Stock minimal préservé pour absorber les variations de demande."],
            ["Sandbox", "Environnement de test fourni par une passerelle externe (CTP, TTN, transporteurs)."],
            ["SKU", "Stock Keeping Unit — référence unique d'un article au niveau le plus fin (taille, couleur)."],
            ["Slug", "Identifiant URL-friendly (ex. 'robe-fleurs-rouge')."],
            ["TTN", "Tunisia Trade Network — passerelle fiscale tunisienne pour les reçus."],
            ["Wholesale", "Vente en gros à des professionnels (B2B)."],
        ],
        col_widths_cm=[3.0, 13.0],
        first_col_bold=True,
    )


def build():
    doc = Document()
    set_default_styles(doc)
    set_a4_margins(doc)
    page_numbers(doc.sections[0])

    cover_page(doc)
    dedicace(doc)
    remerciements(doc)
    resume_fr(doc)
    abstract_en(doc)
    add_toc(doc)
    liste_figures(doc)
    liste_tableaux(doc)
    liste_acronymes(doc)
    introduction(doc)

    chapitre_1(doc)
    chapitre_2(doc)
    chapitre_3(doc)
    chapitre_4(doc)
    chapitre_5(doc)
    chapitre_6(doc)
    chapitre_7(doc)
    chapitre_8(doc)
    chapitre_9(doc)
    conclusion(doc)
    bibliographie(doc)
    annexes(doc)

    out_path = os.path.normpath(os.path.join(
        os.path.dirname(__file__), "..", "Rapport_PFE_Barsha_Soutenance.docx"))
    doc.save(out_path)
    print(f"OK : {out_path}")
    return out_path


if __name__ == "__main__":
    build()
