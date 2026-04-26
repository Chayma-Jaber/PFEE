"""
Seed Data for Barsha E-Commerce
Imports products from JSON and creates categories, banners, and content
"""
import json
import os
import logging
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.product import Product, Category, ProductVariant
from app.models.content import HomeContent, Banner, PromoSection
from app.models.bundles import ProductBundle, BundleItem

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
PRODUCTS_PATH = os.path.join(DATA_DIR, "barsha_products.json")


def seed_categories(db: Session) -> dict:
    """Create default categories and return mapping"""
    categories_data = [
        {"name": "Femme", "slug": "femme", "position": 1, "is_featured": True,
         "description": "Collection Femme - Mode féminine tunisienne",
         "image_url": "https://barsha.com.tn/assets/images/categories/femme.jpg"},
        {"name": "Homme", "slug": "homme", "position": 2, "is_featured": True,
         "description": "Collection Homme - Mode masculine tunisienne",
         "image_url": "https://barsha.com.tn/assets/images/categories/homme.jpg"},
        {"name": "Enfant", "slug": "enfant", "position": 3, "is_featured": True,
         "description": "Collection Enfant - Mode pour les petits",
         "image_url": "https://barsha.com.tn/assets/images/categories/enfant.jpg"},
        {"name": "Accessoires", "slug": "accessoires", "position": 4, "is_featured": True,
         "description": "Accessoires de mode",
         "image_url": "https://barsha.com.tn/assets/images/categories/accessoires.jpg"},
        {"name": "Nouveautés", "slug": "nouveautes", "position": 5, "is_featured": True,
         "description": "Les dernières nouveautés",
         "image_url": "https://barsha.com.tn/assets/images/categories/nouveautes.jpg"},
        {"name": "Soldes", "slug": "soldes", "position": 6, "is_featured": True,
         "description": "Articles en promotion",
         "image_url": "https://barsha.com.tn/assets/images/categories/soldes.jpg"},
    ]

    # Sub-categories for Femme
    femme_subcategories = [
        {"name": "Robes", "slug": "robes-femme", "position": 1},
        {"name": "T-shirts", "slug": "tshirts-femme", "position": 2},
        {"name": "Pantalons", "slug": "pantalons-femme", "position": 3},
        {"name": "Chemises", "slug": "chemises-femme", "position": 4},
        {"name": "Vestes", "slug": "vestes-femme", "position": 5},
        {"name": "Jupes", "slug": "jupes-femme", "position": 6},
        {"name": "Pulls & Cardigans", "slug": "pulls-cardigans-femme", "position": 7},
    ]

    # Sub-categories for Homme
    homme_subcategories = [
        {"name": "T-shirts", "slug": "tshirts-homme", "position": 1},
        {"name": "Chemises", "slug": "chemises-homme", "position": 2},
        {"name": "Pantalons", "slug": "pantalons-homme", "position": 3},
        {"name": "Vestes", "slug": "vestes-homme", "position": 4},
        {"name": "Pulls & Sweats", "slug": "pulls-sweats-homme", "position": 5},
        {"name": "Shorts", "slug": "shorts-homme", "position": 6},
    ]

    category_map = {}

    # Create main categories
    for cat_data in categories_data:
        existing = db.query(Category).filter(Category.slug == cat_data["slug"]).first()
        if not existing:
            cat = Category(**cat_data, is_active=True)
            db.add(cat)
            db.flush()
            category_map[cat_data["name"].lower()] = cat
            logger.info(f"Created category: {cat_data['name']}")
        else:
            category_map[cat_data["name"].lower()] = existing

    # Create sub-categories for Femme
    femme_cat = category_map.get("femme")
    if femme_cat:
        for sub_data in femme_subcategories:
            existing = db.query(Category).filter(Category.slug == sub_data["slug"]).first()
            if not existing:
                sub = Category(
                    name=sub_data["name"],
                    slug=sub_data["slug"],
                    position=sub_data["position"],
                    parent_id=femme_cat.id,
                    is_active=True
                )
                db.add(sub)
                db.flush()
                category_map[sub_data["slug"]] = sub

    # Create sub-categories for Homme
    homme_cat = category_map.get("homme")
    if homme_cat:
        for sub_data in homme_subcategories:
            existing = db.query(Category).filter(Category.slug == sub_data["slug"]).first()
            if not existing:
                sub = Category(
                    name=sub_data["name"],
                    slug=sub_data["slug"],
                    position=sub_data["position"],
                    parent_id=homme_cat.id,
                    is_active=True
                )
                db.add(sub)
                db.flush()
                category_map[sub_data["slug"]] = sub

    db.commit()
    return category_map


def seed_products_from_json(db: Session, category_map: dict, limit: int = 100):
    """Import products from JSON file"""
    if not os.path.exists(PRODUCTS_PATH):
        logger.warning(f"Products file not found: {PRODUCTS_PATH}")
        return

    try:
        with open(PRODUCTS_PATH, "r", encoding="utf-8") as f:
            products_data = json.load(f)
    except Exception as e:
        logger.error(f"Error reading products file: {e}")
        return

    imported = 0
    for item in products_data[:limit]:
        try:
            # Check if product already exists
            existing = db.query(Product).filter(Product.external_id == item["id"]).first()
            if existing:
                continue

            # Determine category
            genre = (item.get("genre") or "").lower()
            category = None
            if "femme" in genre:
                category = category_map.get("femme")
            elif "homme" in genre:
                category = category_map.get("homme")
            elif "enfant" in genre or "kid" in genre:
                category = category_map.get("enfant")

            # Create slug
            nom = item.get("nom", "Produit")
            slug = f"{item['id']}-{nom.lower().replace(' ', '-').replace('/', '-')}"
            slug = ''.join(c if c.isalnum() or c == '-' else '' for c in slug)[:100]

            # Check for existing slug
            slug_exists = db.query(Product).filter(Product.slug == slug).first()
            if slug_exists:
                slug = f"{slug}-{item['id']}"

            # Get price
            prix = item.get("prix") or item.get("currentPrice") or 0
            prix_promo = item.get("prix_promo") or item.get("promoPrice")

            # Determine if on discount
            is_discount = prix_promo is not None and prix_promo < prix
            current_price = prix_promo if is_discount else prix
            discount_value = int(((prix - current_price) / prix) * 100) if is_discount and prix > 0 else 0

            # Create SKU
            sku = item.get("reference") or f"BRSH-{item['id']}"

            # Get image URL
            image_url = item.get("image") or item.get("firstImg") or ""
            if isinstance(image_url, dict):
                image_url = image_url.get("url", "")

            # Create product
            product = Product(
                sku=sku,
                title=nom,
                slug=slug,
                description=item.get("description", ""),
                short_description=item.get("description", "")[:200] if item.get("description") else None,
                price=prix,
                current_price=current_price,
                discount=is_discount,
                discount_value=discount_value,
                famille=genre.upper() if genre else None,
                first_image_url=image_url,
                is_active=True,
                is_available=True,
                is_new=False,
                is_featured=imported < 20,  # First 20 products are featured
                external_id=item["id"],
                id_origin=item["id"],
                total_stock=0
            )

            # Add category relationship
            if category:
                product.categories.append(category)

            db.add(product)
            db.flush()

            # Create variants from declinaisons
            declinaisons = item.get("declinaisons", [])
            total_stock = 0
            for dec in declinaisons:
                couleur = dec.get("couleur")
                taille = dec.get("taille")
                stock = dec.get("stock", 0)
                total_stock += stock

                variant = ProductVariant(
                    product_id=product.id,
                    color=couleur,
                    size=taille,
                    quantity=stock,
                    is_active=True
                )
                db.add(variant)

            # Update total stock
            product.total_stock = total_stock

            imported += 1
            if imported % 50 == 0:
                db.commit()
                logger.info(f"Imported {imported} products...")

        except Exception as e:
            logger.error(f"Error importing product {item.get('id')}: {e}")
            continue

    db.commit()
    logger.info(f"Successfully imported {imported} products")


def seed_banners(db: Session):
    """Create homepage banners"""
    banners_data = [
        {
            "name": "Hero Banner 1",
            "location": "home_hero",
            "title": "Nouvelle Collection",
            "subtitle": "Découvrez les dernières tendances de la mode tunisienne",
            "desktop_image_url": "https://barsha.com.tn/assets/images/banners/hero-1.jpg",
            "mobile_image_url": "https://barsha.com.tn/assets/images/banners/hero-1-mobile.jpg",
            "cta_text": "Découvrir",
            "cta_url": "/shop",
            "position": 1,
            "is_active": True
        },
        {
            "name": "Hero Banner 2",
            "location": "home_hero",
            "title": "Soldes d'Été",
            "subtitle": "Jusqu'à -50% sur une sélection d'articles",
            "desktop_image_url": "https://barsha.com.tn/assets/images/banners/hero-2.jpg",
            "mobile_image_url": "https://barsha.com.tn/assets/images/banners/hero-2-mobile.jpg",
            "cta_text": "En profiter",
            "cta_url": "/categorie/soldes",
            "position": 2,
            "is_active": True
        },
        {
            "name": "Category Banner Femme",
            "location": "category_femme",
            "title": "Collection Femme",
            "subtitle": "Élégance et style au quotidien",
            "desktop_image_url": "https://barsha.com.tn/assets/images/banners/femme.jpg",
            "cta_text": "Voir la collection",
            "cta_url": "/categorie/femme",
            "position": 1,
            "is_active": True
        },
        {
            "name": "Category Banner Homme",
            "location": "category_homme",
            "title": "Collection Homme",
            "subtitle": "Style masculin moderne",
            "desktop_image_url": "https://barsha.com.tn/assets/images/banners/homme.jpg",
            "cta_text": "Voir la collection",
            "cta_url": "/categorie/homme",
            "position": 1,
            "is_active": True
        }
    ]

    for banner_data in banners_data:
        existing = db.query(Banner).filter(Banner.name == banner_data["name"]).first()
        if not existing:
            banner = Banner(**banner_data)
            db.add(banner)
            logger.info(f"Created banner: {banner_data['name']}")

    db.commit()


def seed_home_content(db: Session):
    """Create homepage sections"""
    sections_data = [
        {
            "section": "hero",
            "title": "Bienvenue chez Barsha",
            "subtitle": "Votre destination mode en Tunisie",
            "position": 1,
            "is_active": True
        },
        {
            "section": "featured_categories",
            "title": "Nos Collections",
            "subtitle": "Découvrez nos catégories phares",
            "position": 2,
            "is_active": True
        },
        {
            "section": "new_arrivals",
            "title": "Nouveautés",
            "subtitle": "Les derniers articles ajoutés",
            "position": 3,
            "is_active": True
        },
        {
            "section": "bestsellers",
            "title": "Meilleures Ventes",
            "subtitle": "Les articles les plus populaires",
            "position": 4,
            "is_active": True
        },
        {
            "section": "promo",
            "title": "Offres Spéciales",
            "subtitle": "Profitez de nos promotions exclusives",
            "position": 5,
            "is_active": True
        }
    ]

    for section_data in sections_data:
        existing = db.query(HomeContent).filter(HomeContent.section == section_data["section"]).first()
        if not existing:
            section = HomeContent(**section_data)
            db.add(section)
            logger.info(f"Created section: {section_data['section']}")

    db.commit()


def seed_promo_sections(db: Session):
    """Create promotional banners"""
    promos_data = [
        {
            "name": "Free Shipping",
            "text": "Livraison gratuite à partir de 150 TND",
            "sub_text": "Partout en Tunisie",
            "bg_color": "#000000",
            "text_color": "#ffffff",
            "position": 1,
            "is_active": True
        },
        {
            "name": "Newsletter Discount",
            "text": "-10% sur votre première commande",
            "sub_text": "Inscrivez-vous à notre newsletter",
            "btn_text": "S'inscrire",
            "btn_link": "#newsletter",
            "bg_color": "#8B4513",
            "text_color": "#ffffff",
            "position": 2,
            "is_active": True
        }
    ]

    for promo_data in promos_data:
        existing = db.query(PromoSection).filter(PromoSection.name == promo_data["name"]).first()
        if not existing:
            promo = PromoSection(**promo_data)
            db.add(promo)
            logger.info(f"Created promo: {promo_data['name']}")

    db.commit()


def seed_bundles(db: Session):
    """Create sample product bundles for testing"""
    # Get some products to create bundles
    products = db.query(Product).filter(Product.is_active == True).limit(20).all()

    if len(products) < 6:
        logger.warning("Not enough products to create bundles")
        return

    bundles_data = [
        {
            "name": "Pack Essentiel Femme",
            "description": "Ensemble complet avec t-shirt, pantalon et accessoires pour un look casual parfait",
            "discount_percentage": 15.0,
            "position": 1,
            "product_indices": [0, 1, 2]  # First 3 products
        },
        {
            "name": "Pack Weekend Homme",
            "description": "Tenue decontractee ideale pour le weekend - chemise, jean et sneakers",
            "discount_percentage": 20.0,
            "position": 2,
            "product_indices": [3, 4, 5]  # Products 4-6
        },
        {
            "name": "Pack Bureau Chic",
            "description": "Look professionnel elegant avec chemise, pantalon et ceinture assortie",
            "discount_percentage": 12.0,
            "position": 3,
            "product_indices": [6, 7]  # Products 7-8
        },
        {
            "name": "Pack Sport & Detente",
            "description": "Ensemble sportswear confortable pour vos activites de loisirs",
            "discount_percentage": 25.0,
            "position": 4,
            "product_indices": [8, 9, 10]  # Products 9-11
        }
    ]

    for bundle_data in bundles_data:
        existing = db.query(ProductBundle).filter(ProductBundle.name == bundle_data["name"]).first()
        if existing:
            continue

        # Get products for this bundle
        product_indices = bundle_data.pop("product_indices")
        bundle_products = [products[i] for i in product_indices if i < len(products)]

        if not bundle_products:
            continue

        # Use first product image as bundle image
        bundle_data["image_url"] = bundle_products[0].first_image_url

        bundle = ProductBundle(
            name=bundle_data["name"],
            description=bundle_data["description"],
            discount_percentage=bundle_data["discount_percentage"],
            position=bundle_data["position"],
            image_url=bundle_data["image_url"],
            is_active=True
        )
        db.add(bundle)
        db.flush()

        # Add products to bundle
        for idx, product in enumerate(bundle_products):
            item = BundleItem(
                bundle_id=bundle.id,
                product_id=str(product.id),
                quantity=1,
                position=idx
            )
            db.add(item)

        logger.info(f"Created bundle: {bundle_data['name']} with {len(bundle_products)} products")

    db.commit()


def run_all_seeds(db: Session, products_limit: int = 200):
    """Run all seed functions"""
    logger.info("Starting database seeding...")

    try:
        # Seed categories first
        logger.info("Seeding categories...")
        category_map = seed_categories(db)

        # Seed products
        logger.info("Seeding products from JSON...")
        seed_products_from_json(db, category_map, limit=products_limit)

        # Seed banners
        logger.info("Seeding banners...")
        seed_banners(db)

        # Seed home content
        logger.info("Seeding home content...")
        seed_home_content(db)

        # Seed promo sections
        logger.info("Seeding promo sections...")
        seed_promo_sections(db)

        # Seed bundles
        logger.info("Seeding product bundles...")
        seed_bundles(db)

        logger.info("Database seeding completed successfully!")
        return True

    except Exception as e:
        logger.error(f"Error during seeding: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
