export type AdminModuleContextKey =
  | 'warehouses'
  | 'fraud'
  | 'subscriptions'
  | 'dynamicPricing'
  | 'featureFlags'
  | 'marketplace'
  | 'b2b'
  | 'preorder'
  | 'configurator'
  | 'lifecycle'
  | 'replenishment'
  | 'cms'
  | 'erp'
  | 'fiscal'
  | 'ugcModeration'
  | 'gdpr'
  | 'platform'
  | 'advanced'
  | 'wave2'
  | 'wave3'
  | 'wave4';

export interface AdminModuleContext {
  explanation: string;
  utility: string;
  seededExamples: string[];
}

export const ADMIN_MODULE_CONTEXT: Record<AdminModuleContextKey, AdminModuleContext> = {
  warehouses: {
    explanation:
      'Ce module centralise les entrepots, les quantites par site, les seuils de securite et les ajustements de stock par produit.',
    utility:
      'Il sert a eviter les ruptures, mieux repartir les commandes entre les sites et savoir rapidement ou se trouve le stock disponible.',
    seededExamples: [
      'Clients seedes reels: Sarah Ben Ali, Ahmed Trabelsi, Ines Maaloul.',
      'Produits reels seedes: T SHIRT #1731, CARDIGAN #1573, PULL #1656.',
      'Villes seedes utilisees dans le projet: Tunis, La Marsa, Sousse, Sfax.',
    ],
  },
  fraud: {
    explanation:
      'Ce module regroupe les commandes detectees comme sensibles selon un score de risque, des regles metier et des signaux de verification.',
    utility:
      'Il aide l equipe a bloquer les commandes suspectes avant expedition et a reduire les pertes liees aux paiements ou aux comptes a risque.',
    seededExamples: [
      'Clients seedes reels: Youssef Hammami, Amira Jebali, Karim Gharbi.',
      'Commandes seedes realistes: references ORD-202600001 a ORD-202600025.',
      'Produits reels associes aux commandes: T SHIRT #1296, T SHIRT #1246, POLO #1691.',
    ],
  },
  subscriptions: {
    explanation:
      'Ce module gere les abonnements recurrents, les prochaines echeances, les echecs de paiement et le traitement manuel des cycles dus.',
    utility:
      'Il permet de piloter un revenu recurrent, de suivre les abonnements actifs et de limiter le churn grace au dunning.',
    seededExamples: [
      'Clients seedes reels: Fatma Bouazizi, Aya Kefi, Mariem Sassi.',
      'Produits reels adaptes aux abonnements: T SHIRT #1731, PULL #1656.',
      'Base clients seedee depuis backend/src/database/seed.ts avec emails et telephones realistes.',
    ],
  },
  dynamicPricing: {
    explanation:
      'Ce module applique ou propose des changements de prix selon l age du stock, la demande, la conversion ou une logique de destockage.',
    utility:
      'Il aide a proteger la marge, accelerer les ventes sur les references lentes et reagir plus vite aux variations de demande.',
    seededExamples: [
      'Produits reels seedes: T SHIRT #1731, CARDIGAN #1573, PULL #1656, POLO #1691.',
      'Prix reels issus du catalogue seed: 25.9 TND, 29.9 TND, 59.9 TND.',
      'Le catalogue provient du fichier backend/data/barsha_products.json.',
    ],
  },
  featureFlags: {
    explanation:
      'Ce module active des fonctionnalites par pourcentage, segment ou variante afin de deployer progressivement une nouveaute ou lancer un test A/B.',
    utility:
      'Il sert a limiter le risque en production, comparer deux experiences et mesurer l impact avant generalisation.',
    seededExamples: [
      'Segments clients reels seeds: NEW, LOYAL, VIP, AT_RISK.',
      'Exemples de clients seedes pour tests: Sarah Ben Ali, Ahmed Trabelsi, Walid Hamdi.',
      'Tests possibles sur des produits reels comme T SHIRT #1731 et CARDIGAN #1573.',
    ],
  },
  marketplace: {
    explanation:
      'Ce module gere l onboarding des vendeurs tiers, le suivi de leur statut et le calcul des payouts apres commission.',
    utility:
      'Il permet a la plateforme de vendre au dela du stock Barsha tout en gardant un controle financier et operationnel.',
    seededExamples: [
      'Produits reels du catalogue utilisables en demo marketplace: T SHIRT #1296, POLO #1691.',
      'Periodes de payout basees sur les commandes seedes ORD-202600001 a ORD-202600025.',
      'Base clients seedee realiste pour valider des parcours acheteur multi-vendeurs.',
    ],
  },
  b2b: {
    explanation:
      'Ce module suit les comptes entreprise, les remises par tier, les conditions de paiement et les demandes de devis.',
    utility:
      'Il sert a gerer des ventes wholesale avec validation commerciale, credit, remises negociees et devis structurés.',
    seededExamples: [
      'Clients seedes reels reutilisables comme contacts: Ahmed Trabelsi, Riadh Selmi, Walid Hamdi.',
      'Produits reels adaptes aux devis: T SHIRT #1731, T SHIRT #1246, CARDIGAN #1573.',
      'Catalogues et prix reels seedes depuis backend/data/barsha_products.json.',
    ],
  },
  preorder: {
    explanation:
      'Ce module permet de programmer des pre-commandes et des drops limites avec capacite, acompte et liste d attente.',
    utility:
      'Il est utile pour lancer une reference avant reception stock, creer de la rarete et mesurer la demande en amont.',
    seededExamples: [
      'Produits reels adaptes aux drops: CARDIGAN #1573, PULL #1656, POLO #1691.',
      'Clients seedes reels pour reservations: Sarah Ben Ali, Amira Jebali, Mariem Sassi.',
      'Les fiches produit reelles proviennent du catalogue Barsha seede dans le projet.',
    ],
  },
  configurator: {
    explanation:
      'Ce module construit des coffrets cadeaux, tenues ou kits a partir de slots et de pools de produits autorises.',
    utility:
      'Il sert a augmenter le panier moyen, proposer des bundles coherents et laisser le client composer une offre encadree.',
    seededExamples: [
      'Produits reels pour composition: T SHIRT #1731, CARDIGAN #1573, PULL #1656.',
      'Clients seedes reels: Ines Maaloul, Aya Kefi, Sarah Ben Ali.',
      'Les produits reels sont issus du catalogue Barsha et exposes avec leurs prix TND.',
    ],
  },
  lifecycle: {
    explanation:
      'Ce module orchestre des sequences automatiques comme welcome, panier abandonne, post-achat, post-livraison et winback.',
    utility:
      'Il aide a garder le contact au bon moment, recuperer du chiffre d affaires et automatiser les relances sans surcharge manuelle.',
    seededExamples: [
      'Clients seedes reels: Sarah Ben Ali, Fatma Bouazizi, Mehdi Chaabane.',
      'Commandes seedes utilisees pour les triggers: ORD-202600001 a ORD-202600025.',
      'Produits reels visibles dans les relances: T SHIRT #1731, CARDIGAN #1573.',
    ],
  },
  replenishment: {
    explanation:
      'Ce module prevoit les ruptures, suggere des reapprovisionnements et genere des bons de commande fournisseurs.',
    utility:
      'Il sert a securiser la disponibilite produit, prioriser les achats et accelerer le travail de l equipe approvisionnement.',
    seededExamples: [
      'Produits reels suivis en stock: T SHIRT #1296, T SHIRT #1731, PULL #1656.',
      'Villes et entrepots seeds autour de Tunis, La Marsa, Sousse et Sfax.',
      'Historique de commandes seedes pour etablir un forecast realiste.',
    ],
  },
  cms: {
    explanation:
      'Ce module gere des pages editoriales headless versionnees avec blocs, SEO, publication et restauration des revisions.',
    utility:
      'Il permet de publier des campagnes, pages marque ou landing pages sans toucher au code et avec un historique propre.',
    seededExamples: [
      'Produits reels reutilisables dans les blocs product-list: T SHIRT #1731, CARDIGAN #1573, POLO #1691.',
      'Locales gerees dans le projet: fr, ar, en.',
      'Le catalogue de reference est le meme que celui expose sur le storefront Barsha.',
    ],
  },
  erp: {
    explanation:
      'Ce module prepare les exports comptables et ERP sous forme de lignes de facture et de resume GL.',
    utility:
      'Il facilite l integration avec la comptabilite et evite de reconstruire manuellement les donnees de vente.',
    seededExamples: [
      'Clients seedes reels sur les factures: Sarah Ben Ali, Ahmed Trabelsi, Amira Jebali.',
      'Commandes seedes realistes: references ORD-202600001 a ORD-202600025.',
      'Produits reels exportables: T SHIRT #1731, T SHIRT #1246, CARDIGAN #1573.',
    ],
  },
  fiscal: {
    explanation:
      'Ce module suit les recus fiscaux, le statut TTN et le calcul de TVA mensuelle pour la conformite tunisienne.',
    utility:
      'Il sert a garder une piste fiscale propre, reemettre les recus en erreur et preparer les declarations.',
    seededExamples: [
      'Clients seedes reels: Fatma Bouazizi, Youssef Hammami, Aya Kefi.',
      'Commandes seedes realistes transformables en recus fiscaux: ORD-202600001 a ORD-202600025.',
      'Montants produits reels en TND issus du seed catalogue Barsha.',
    ],
  },
  ugcModeration: {
    explanation:
      'Ce module analyse les contenus clients avec un score global, des signaux NSFW, spam et qualite avant publication.',
    utility:
      'Il aide a proteger la marque, accelerer la moderation et garder uniquement les avis et visuels exploitables.',
    seededExamples: [
      'Clients seedes reels: Ines Maaloul, Mariem Sassi, Sarah Ben Ali.',
      'Produits reels mentionnables dans les avis: T SHIRT #1731, PULL #1656.',
      'Le projet contient deja des reviews client seedes reliees a des produits reels.',
    ],
  },
  gdpr: {
    explanation:
      'Ce module suit les demandes d export, d effacement et de rectification avec verification et journalisation.',
    utility:
      'Il sert a traiter les obligations RGPD sans casser l historique fiscal ni perdre la tracabilite des actions admin.',
    seededExamples: [
      'Clients seedes reels: Sarah Ben Ali, Ahmed Trabelsi, Aya Kefi, Walid Hamdi.',
      'Donnees seedes realistes: email, telephone, adresses et historiques de commandes.',
      'Les profils clients proviennent directement de backend/src/database/seed.ts.',
    ],
  },
  platform: {
    explanation:
      'Ce module donne une vue d ensemble sur les evenements de domaine, la sante HTTP, les erreurs recentes et les latences.',
    utility:
      'Il permet de diagnostiquer rapidement un incident, comprendre les flux metier et surveiller la stabilite de la plateforme.',
    seededExamples: [
      'Evenements derives des parcours reels de commandes seedes et d actions client.',
      'Routes observees autour des modules orders, products, marketplace et lifecycle.',
      'Clients et produits reels seeds alimentent les scenarios applicatifs visibles ici.',
    ],
  },
  advanced: {
    explanation:
      'Ce bloc regroupe les outils d analyse et d operation comme le Customer 360, le journal admin, la recherche, les paniers abandonnes ou le SEO.',
    utility:
      'Il sert de cockpit transverse pour comprendre les clients, corriger le catalogue et piloter les actions marketing ou support.',
    seededExamples: [
      'Clients seedes reels: Sarah Ben Ali, Ahmed Trabelsi, Fatma Bouazizi.',
      'Produits reels affichables dans les vues analytics: T SHIRT #1731, CARDIGAN #1573.',
      'Historique de commandes, tickets et reviews deja seedes dans le backend.',
    ],
  },
  wave2: {
    explanation:
      'Wave 2 concentre les outils d optimisation operationnelle comme les tendances, le funnel, les synonymes, les vedettes et l auto-annulation.',
    utility:
      'Elle permet d ameliorer le catalogue, le merchandising et la conversion a partir de signaux deja observes sur la boutique.',
    seededExamples: [
      'Produits reels seeds: T SHIRT #1731, T SHIRT #1296, POLO #1691.',
      'Clients seedes reels: Ines Maaloul, Mehdi Chaabane, Sarah Ben Ali.',
      'Commandes seedes realistes utilisees pour les tendances et le funnel.',
    ],
  },
  wave3: {
    explanation:
      'Wave 3 couvre le merchandising intelligent avec blocs homepage, A/B tests, segments email, ordre produit et expeditions.',
    utility:
      'Elle sert a personnaliser la vitrine, tester des hypotheses business et rendre la logistique visible dans le back-office.',
    seededExamples: [
      'Produits reels homepage et merchandising: T SHIRT #1731, CARDIGAN #1573, POLO #1691.',
      'Segments clients seeds: VIP, LOYAL, NEW, AT_RISK.',
      'Commandes et expeditions demo relies aux references ORD-202600001 a ORD-202600025.',
    ],
  },
  wave4: {
    explanation:
      'Wave 4 rassemble les outils CRM, ops et BI comme tags client, taches, SLA support, churn, deals, UGC, slots et audit.',
    utility:
      'Elle aide l equipe a piloter les priorites terrain, la retention et les operations avancees depuis un seul espace.',
    seededExamples: [
      'Clients seedes reels: Sarah Ben Ali, Mariem Sassi, Walid Hamdi.',
      'Produits reels pour deals et analyses: T SHIRT #1731, PULL #1656, CARDIGAN #1573.',
      'Tickets, commandes et reviews seedes realistes pour alimenter le CRM.',
    ],
  },
};
