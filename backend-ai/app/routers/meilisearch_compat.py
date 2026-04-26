"""
MeiliSearch Compatibility Router
Provides endpoints that mimic MeiliSearch API for frontend compatibility
"""
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, Any, Dict, List
import json
import re
import logging

from app.core.database import get_db
from app.models.product import Product, Category
from app.models.content import HomeContent, Banner, PromoSection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/indexes", tags=["MeiliSearch Compatibility"])


def meili_response(hits: List[Dict], query: str = "", total: Optional[int] = None) -> Dict:
    """Format response in MeiliSearch style"""
    return {
        "hits": hits,
        "query": query,
        "processingTimeMs": 1,
        "limit": len(hits),
        "offset": 0,
        "estimatedTotalHits": total if total is not None else len(hits)
    }


def parse_filter(filter_str: str) -> Dict[str, Any]:
    """Parse MeiliSearch-style filter string into conditions"""
    conditions = {}
    if not filter_str:
        return conditions

    # Handle simple equality: field = value or field=value
    eq_match = re.findall(r'(\w+(?:\.\w+)?)\s*=\s*["\']?([^"\']+)["\']?', filter_str)
    for field, value in eq_match:
        # Normalize boolean values
        if value.lower() == 'true':
            conditions[field] = True
        elif value.lower() == 'false':
            conditions[field] = False
        else:
            conditions[field] = value

    # Handle IN clauses: field IN [val1, val2]
    in_match = re.search(r'(\w+)\s+IN\s+\[([^\]]+)\]', filter_str, re.IGNORECASE)
    if in_match:
        field = in_match.group(1)
        values = [v.strip().strip('"\'') for v in in_match.group(2).split(',')]
        conditions[f"{field}_in"] = values

    # Handle OR conditions: field = val1 OR field = val2
    or_matches = re.findall(r'id\s*=\s*(\d+)', filter_str)
    if len(or_matches) > 1:
        conditions['id_in'] = [int(x) for x in or_matches]

    return conditions


def parse_sort(sort_list: List[str]) -> List[tuple]:
    """Parse MeiliSearch-style sort array into (field, direction) tuples"""
    sorts = []
    for sort_item in sort_list:
        if ':' in sort_item:
            field, direction = sort_item.split(':')
            sorts.append((field.strip(), direction.strip().lower()))
        else:
            sorts.append((sort_item.strip(), 'asc'))
    return sorts


# ═══════════════════════════════════════════════════════════════════════════════
# HOMEPAGE & CONTENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/web-hp/search")
@router.post("/web-hp/search")
async def search_web_hp(db: Session = Depends(get_db)):
    """Homepage data - returns banners, featured products, promo sections, and pages for category navigation"""
    try:
        # Get homepage sections
        sections = db.query(HomeContent).filter(HomeContent.is_active == True).order_by(HomeContent.position).all()

        # Get active banners
        banners = db.query(Banner).filter(Banner.is_active == True).order_by(Banner.position).all()

        # Get promo sections
        promos = db.query(PromoSection).filter(PromoSection.is_active == True).order_by(PromoSection.position).all()

        # Get all categories for building pages structure
        all_categories = db.query(Category).filter(Category.is_active == True).order_by(Category.position).all()

        # Get featured categories
        featured_categories = [c for c in all_categories if c.is_featured]

        # Build pages structure for category component (legacy support)
        # Each top-level category becomes a "page" with its subcategories
        pages = []
        top_level_cats = [c for c in all_categories if c.parent_id is None]

        for cat in top_level_cats:
            # Get subcategories
            subcats = [c for c in all_categories if c.parent_id == cat.id]

            page = {
                "id": cat.id,
                "relatedTo": str(cat.id),
                "title": cat.name,
                "description": cat.description,
                "bannerUrl": cat.banner_url,
                "imageUrl": cat.image_url,
                "categories": [{
                    "id": sc.id,
                    "title": sc.name,
                    "linkTo": f"/shop?category={sc.id}",
                    "media": {
                        "url": sc.image_url or "/assets/images/placeholder.jpg"
                    }
                } for sc in subcats]
            }
            pages.append(page)

        hits = [{
            "id": 1,
            "sections": [s.to_dict() for s in sections] if sections else [],
            "banners": [b.to_dict() for b in banners] if banners else [],
            "promos": [p.to_dict() for p in promos] if promos else [],
            "featuredCategories": [c.to_dict() for c in featured_categories] if featured_categories else [],
            "pages": pages,
            "siteConfig": {
                "logo": "/assets/images/logo.png",
                "siteName": "Barsha",
                "currency": "TND",
                "locale": "fr-TN"
            }
        }]

        return meili_response(hits, "")
    except Exception as e:
        logger.error(f"Error in web-hp search: {e}")
        return meili_response([{
            "id": 1,
            "sections": [],
            "banners": [],
            "promos": [],
            "featuredCategories": [],
            "pages": [],
            "siteConfig": {"logo": "/assets/images/logo.png", "siteName": "Barsha"}
        }], "")


@router.get("/web-chp/search")
@router.post("/web-chp/search")
async def search_web_chp(db: Session = Depends(get_db)):
    """Homepage carousel/hero data - returns in expected frontend format with slides array"""
    try:
        # Get hero banners
        banners = db.query(Banner).filter(
            Banner.is_active == True,
            Banner.location == "home_hero"
        ).order_by(Banner.position).all()

        # Build slides array in expected frontend format
        slides = []
        if banners:
            for b in banners:
                banner_dict = b.to_dict() if hasattr(b, 'to_dict') else {}
                slides.append({
                    "id": getattr(b, 'id', 1),
                    "media": {
                        "url": banner_dict.get('desktopImageUrl') or banner_dict.get('image_url') or "/assets/images/hero-banner.jpg",
                        "medium": {
                            "url": banner_dict.get('desktopImageUrl') or banner_dict.get('image_url') or "/assets/images/hero-banner.jpg"
                        },
                        "name": banner_dict.get('title', 'Barsha Hero Banner')
                    },
                    "mob_media": {
                        "url": banner_dict.get('mobileImageUrl') or banner_dict.get('mobile_image_url') or "/assets/images/hero-banner-mobile.jpg",
                        "medium": {
                            "url": banner_dict.get('mobileImageUrl') or banner_dict.get('mobile_image_url') or "/assets/images/hero-banner-mobile.jpg"
                        }
                    },
                    "logo": {
                        "url": "/assets/images/logo.png",
                        "name": "BARSHA Logo"
                    },
                    "title": banner_dict.get('title', 'Nouvelle Collection'),
                    "subtitle": banner_dict.get('subtitle', 'Découvrez les dernières tendances'),
                    "ctaText": banner_dict.get('ctaText', 'Découvrir'),
                    "ctaUrl": banner_dict.get('ctaUrl', '/shop')
                })
        else:
            # Default slide when no banners in DB
            slides.append({
                "id": 1,
                "media": {
                    "url": "/assets/images/hero-banner.jpg",
                    "medium": {"url": "/assets/images/hero-banner.jpg"},
                    "name": "Barsha Hero Banner"
                },
                "mob_media": {
                    "url": "/assets/images/hero-banner-mobile.jpg",
                    "medium": {"url": "/assets/images/hero-banner-mobile.jpg"}
                },
                "logo": {
                    "url": "/assets/images/logo.png",
                    "name": "BARSHA Logo"
                },
                "title": "Nouvelle Collection",
                "subtitle": "Découvrez les dernières tendances",
                "ctaText": "Découvrir",
                "ctaUrl": "/shop"
            })

        # Build the response in expected frontend format
        hit = {
            "id": 1,
            "slides": slides,
            "navBtns": [
                {"text": "Pour Elle", "linkTo": "1-femme", "bgColor": "#000000"},
                {"text": "Pour Lui", "linkTo": "2-homme", "bgColor": "#ffffff"}
            ],
            "siteConfig": {
                "logo": "/assets/images/logo.png",
                "siteName": "Barsha",
                "currency": "TND",
                "locale": "fr-TN"
            }
        }

        return meili_response([hit], "")
    except Exception as e:
        logger.error(f"Error in web-chp search: {e}")
        # Return fallback with expected structure
        return meili_response([{
            "id": 1,
            "slides": [{
                "id": 1,
                "media": {"url": "/assets/images/hero-banner.jpg", "medium": {"url": "/assets/images/hero-banner.jpg"}, "name": "Barsha"},
                "mob_media": {"url": "/assets/images/hero-banner-mobile.jpg", "medium": {"url": "/assets/images/hero-banner-mobile.jpg"}},
                "logo": {"url": "/assets/images/logo.png", "name": "BARSHA Logo"},
                "title": "Bienvenue chez Barsha",
                "subtitle": "Mode Tunisienne",
                "ctaText": "Découvrir",
                "ctaUrl": "/shop"
            }],
            "navBtns": [
                {"text": "Pour Elle", "linkTo": "1-femme", "bgColor": "#000000"},
                {"text": "Pour Lui", "linkTo": "2-homme", "bgColor": "#ffffff"}
            ],
            "siteConfig": {"logo": "/assets/images/logo.png", "siteName": "Barsha"}
        }], "")


# ═══════════════════════════════════════════════════════════════════════════════
# CATEGORIES ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/categories/search")
@router.post("/categories/search")
async def search_categories(
    request: Request,
    db: Session = Depends(get_db)
):
    """Search categories"""
    try:
        # Parse body for POST requests
        body = {}
        if request.method == "POST":
            try:
                body = await request.json()
            except:
                pass

        query = body.get("q", "")
        limit = body.get("limit", 100)
        filter_str = body.get("filter", "")

        # Build query
        q = db.query(Category).filter(Category.is_active == True)

        if query:
            q = q.filter(Category.name.ilike(f"%{query}%"))

        # Parse filters
        conditions = parse_filter(filter_str)
        if "parentCategory" in conditions:
            q = q.filter(Category.parent_id == int(conditions["parentCategory"]))

        categories = q.order_by(Category.position).limit(limit).all()

        # Transform to expected format with nested subcategories
        def build_category_tree(cat: Category) -> Dict:
            children = db.query(Category).filter(
                Category.parent_id == cat.id,
                Category.is_active == True
            ).order_by(Category.position).all()

            return {
                "id": cat.id,
                "idOrigin": cat.id,
                "name": cat.name,
                "link": f"/categorie/{cat.slug}",
                "publicName": cat.name,
                "position": cat.position,
                "parentCategory": cat.parent_id,
                "metaTitle": cat.meta_title,
                "keywords": "",
                "metaDescription": cat.meta_description,
                "htmlDescription": cat.description,
                "fontColor": "#000000",
                "imageUrl": cat.image_url,
                "bannerUrl": cat.banner_url,
                "subCategories": [build_category_tree(c) for c in children]
            }

        # When searching by name (specific lookup, small limit), return all matching
        # categories directly — don't filter to top-level only, because the frontend
        # may be looking up a subcategory by name.
        if query and limit <= 10:
            hits = [build_category_tree(c) for c in categories]
        else:
            # Browsing mode: build tree from top-level categories
            top_categories = [c for c in categories if c.parent_id is None]
            hits = [build_category_tree(c) for c in top_categories]

            # If no top-level found, return all as flat list
            if not hits:
                hits = [build_category_tree(c) for c in categories]

        return meili_response(hits, query, len(hits))
    except Exception as e:
        logger.error(f"Error in categories search: {e}")
        return meili_response([], "")


@router.get("/categories/{category_id}")
async def get_category_by_id(category_id: int, db: Session = Depends(get_db)):
    """Get single category by ID"""
    try:
        cat = db.query(Category).filter(Category.id == category_id).first()
        if cat:
            return {
                "id": cat.id,
                "name": cat.name,
                "slug": cat.slug,
                "description": cat.description,
                "imageUrl": cat.image_url,
                "bannerUrl": cat.banner_url,
                "parentId": cat.parent_id
            }
        return {"error": "Category not found"}
    except Exception as e:
        logger.error(f"Error getting category {category_id}: {e}")
        return {"error": str(e)}


@router.post("/categories-titles/search")
async def search_category_titles(request: Request, db: Session = Depends(get_db)):
    """Search category titles for autocomplete"""
    try:
        body = await request.json()
        query = body.get("q", "")
        limit = body.get("limit", 100)
        filter_str = body.get("filter", "")

        q = db.query(Category).filter(Category.is_active == True)

        if query:
            q = q.filter(Category.name.ilike(f"%{query}%"))

        conditions = parse_filter(filter_str)
        if "parentCategory" in conditions:
            q = q.filter(Category.parent_id == int(conditions["parentCategory"]))

        categories = q.order_by(Category.name).limit(limit).all()

        hits = [{
            "id": c.id,
            "title": c.name,
            "name": c.name,
            "slug": c.slug,
            "parentCategory": c.parent_id
        } for c in categories]

        return meili_response(hits, query, len(hits))
    except Exception as e:
        logger.error(f"Error in categories-titles search: {e}")
        return meili_response([], "")


@router.post("/all-categories/search")
async def search_all_categories(request: Request, db: Session = Depends(get_db)):
    """Search all categories with banner info"""
    try:
        body = await request.json()
        filter_str = body.get("filter", "")

        q = db.query(Category)

        conditions = parse_filter(filter_str)
        if "id" in conditions:
            q = q.filter(Category.id == int(conditions["id"]))

        categories = q.all()

        hits = [{
            "id": c.id,
            "name": c.name,
            "slug": c.slug,
            "bannerUrl": c.banner_url,
            "imageUrl": c.image_url,
            "description": c.description,
            "metaTitle": c.meta_title,
            "metaDescription": c.meta_description
        } for c in categories]

        return meili_response(hits, "", len(hits))
    except Exception as e:
        logger.error(f"Error in all-categories search: {e}")
        return meili_response([], "")


# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCTS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/products/search")
@router.post("/products/search")
async def search_products(request: Request, db: Session = Depends(get_db)):
    """Search products - main product search endpoint"""
    try:
        # Parse parameters
        body = {}
        if request.method == "POST":
            try:
                body = await request.json()
            except:
                pass

        # Get query params for GET requests
        query = body.get("q", request.query_params.get("q", ""))
        limit = body.get("limit", int(request.query_params.get("limit", 20)))
        offset = body.get("offset", int(request.query_params.get("offset", 0)))
        filter_str = body.get("filter", request.query_params.get("filter", ""))
        sort_list = body.get("sort", [])

        # Build query
        q = db.query(Product).filter(Product.is_active == True)

        # Text search
        if query:
            q = q.filter(
                (Product.title.ilike(f"%{query}%")) |
                (Product.description.ilike(f"%{query}%")) |
                (Product.sku.ilike(f"%{query}%"))
            )

        # Parse and apply filters
        conditions = parse_filter(filter_str)

        # Handle categories.id filter
        if "categories.id" in conditions:
            cat_id = int(conditions["categories.id"])
            q = q.join(Product.categories).filter(Category.id == cat_id)

        # Handle id filter
        if "id" in conditions:
            q = q.filter(Product.id == int(conditions["id"]))

        # Handle id_in for OR conditions
        if "id_in" in conditions:
            q = q.filter(Product.id.in_(conditions["id_in"]))

        # Handle idOrigin filter
        if "idOrigin" in conditions:
            q = q.filter(Product.id_origin == int(conditions["idOrigin"]))

        # Handle Famille filter
        if "Famille" in conditions:
            q = q.filter(Product.famille == conditions["Famille"])

        # Handle Persona filter
        if "Persona" in conditions:
            q = q.filter(Product.persona == conditions["Persona"])

        # Handle featuredInSearch
        if "featuredInSearch" in conditions:
            q = q.filter(Product.is_featured == True)

        # Handle disponible filter (maps to is_available)
        if "disponible" in conditions:
            if conditions["disponible"] == True:
                q = q.filter(Product.is_available == True)

        # Handle discount filter
        if "discount" in conditions:
            if conditions["discount"] == True:
                q = q.filter(Product.discount == True)

        # Handle active filter (maps to is_active)
        if "active" in conditions:
            if conditions["active"] == True:
                q = q.filter(Product.is_active == True)

        # Count total before pagination
        total = q.count()

        # Sorting
        if sort_list:
            sorts = parse_sort(sort_list)
            for field, direction in sorts:
                if field in ("dateActivation", "created_at"):
                    if direction == "desc":
                        q = q.order_by(Product.created_at.desc())
                    else:
                        q = q.order_by(Product.created_at.asc())
                elif field in ("price", "currentPrice"):
                    if direction == "desc":
                        q = q.order_by(Product.current_price.desc())
                    else:
                        q = q.order_by(Product.current_price.asc())
                elif field == "discountValue":
                    if direction == "desc":
                        q = q.order_by(Product.discount_value.desc())
                    else:
                        q = q.order_by(Product.discount_value.asc())
                elif field == "id":
                    if direction == "desc":
                        q = q.order_by(Product.id.desc())
                    else:
                        q = q.order_by(Product.id.asc())
        else:
            q = q.order_by(Product.created_at.desc())

        # Pagination
        products = q.offset(offset).limit(limit).all()

        # Transform to expected frontend format
        # The Angular frontend expects firstImg/secondImg as objects {url, ext, name, ...}
        # and declinaisons (not variants) with images arrays for color/image switching
        hits = []
        for p in products:
            # Get categories for this product
            cat_list = [{"id": c.id, "name": c.name, "slug": c.slug} for c in p.categories]

            # Build firstImg/secondImg as objects (frontend expects .url property)
            first_img_obj = {"url": p.first_image_url, "name": p.title, "ext": ".jpg"} if p.first_image_url else {"url": ""}
            second_img_obj = {"url": p.second_image_url, "name": p.title, "ext": ".jpg"} if p.second_image_url else {"url": ""}

            # Build declinaisons from variants grouped by color
            # Frontend expects: [{id, couleur, libellet, texture, images: [{url}], active}]
            color_groups = {}
            for v in (p.variants or []):
                color_key = v.color or "default"
                if color_key not in color_groups:
                    color_groups[color_key] = {
                        "id": v.id,
                        "couleur": v.color or "",
                        "libellet": v.color or "",
                        "active": v.is_in_stock,
                        "texture": {"url": v.texture_url or "", "ext": ".jpg", "name": v.color or ""} if v.texture_url else None,
                        "images": [first_img_obj] if p.first_image_url else [],
                        "tailles": []
                    }
                color_groups[color_key]["tailles"].append({
                    "size": v.size or "",
                    "qte": v.available_quantity,
                    "ean13": v.ean13 or "",
                    "state": "available" if v.is_in_stock else "unavailable"
                })

            declinaisons = list(color_groups.values())

            # Build tailles from all variants
            tailles = []
            for v in (p.variants or []):
                tailles.append({
                    "size": v.size or "",
                    "qte": v.available_quantity,
                    "ean13": v.ean13 or "",
                    "state": "available" if v.is_in_stock else "unavailable"
                })

            hits.append({
                "id": p.id,
                "idOrigin": p.id_origin or p.id,
                "sku": p.sku,
                "reference": p.sku,
                "title": p.title,
                "nom": p.title,
                "slug": p.slug,
                "description": p.description,
                "shortDescription": p.short_description,
                "price": p.price,
                "currentPrice": p.current_price,
                "prix": p.current_price,
                "discount": p.discount,
                "discountValue": p.discount_value,
                "disponible": p.is_available,
                "Famille": p.famille,
                "famille": p.famille,
                "Persona": p.persona,
                "ligne": p.ligne,
                "isNew": p.is_new,
                "isFeatured": p.is_featured,
                "isBestseller": p.is_bestseller,
                "isAvailable": p.is_available,
                "totalStock": p.total_stock,
                "categories": cat_list,
                "image": first_img_obj,
                "firstImg": first_img_obj,
                "firstImageUrl": p.first_image_url,
                "secondImg": second_img_obj,
                "secondImageUrl": p.second_image_url,
                "declinaisons": declinaisons,
                "tailles": tailles,
                "composition": p.composition,
                "dateActivation": p.created_at.isoformat() if p.created_at else None,
                "variants": [v.to_dict() for v in p.variants] if p.variants else [],
                "images": [{"url": img.url, "name": img.alt_text or "", "ext": ".jpg"} for img in p.images] if p.images else []
            })

        return meili_response(hits, query, total)
    except Exception as e:
        logger.error(f"Error in products search: {e}")
        import traceback
        traceback.print_exc()
        return meili_response([], "")


@router.post("/produits/search")
async def search_produits(request: Request, db: Session = Depends(get_db)):
    """French alias for products search"""
    return await search_products(request, db)


@router.post("/products-titles/search")
async def search_product_titles(request: Request, db: Session = Depends(get_db)):
    """Search product titles for autocomplete"""
    try:
        body = await request.json()
        query = body.get("q", "")
        limit = body.get("limit", 100)
        filter_str = body.get("filter", "")

        q = db.query(Product).filter(Product.is_active == True)

        # Handle STARTS WITH filter
        if "title STARTS WITH" in filter_str:
            match = re.search(r"title STARTS WITH '([^']+)'", filter_str)
            if match:
                prefix = match.group(1)
                q = q.filter(Product.title.ilike(f"{prefix}%"))
        elif query:
            q = q.filter(Product.title.ilike(f"%{query}%"))

        # Handle category filter
        conditions = parse_filter(filter_str)
        if "category" in conditions:
            cat_id = int(conditions["category"])
            q = q.join(Product.categories).filter(Category.id == cat_id)

        products = q.order_by(Product.title).limit(limit).all()

        hits = [{
            "id": p.id,
            "title": p.title,
            "slug": p.slug,
            "category": p.categories[0].id if p.categories else None
        } for p in products]

        return meili_response(hits, query, len(hits))
    except Exception as e:
        logger.error(f"Error in products-titles search: {e}")
        return meili_response([], "")


@router.post("/product-meta-info/search")
async def search_product_meta(request: Request, db: Session = Depends(get_db)):
    """Search product metadata"""
    try:
        body = await request.json()
        filter_str = body.get("filter", "")

        conditions = parse_filter(filter_str)

        if "product" in conditions:
            product_id = int(conditions["product"])
            product = db.query(Product).filter(Product.id == product_id).first()

            if product:
                hits = [{
                    "id": product.id,
                    "product": product.id,
                    "title": product.meta_title or product.title,
                    "description": product.meta_description or product.description,
                    "keywords": product.meta_keywords,
                    "lang": conditions.get("lang", "fr")
                }]
                return meili_response(hits, "", 1)

        return meili_response([], "")
    except Exception as e:
        logger.error(f"Error in product-meta-info search: {e}")
        return meili_response([], "")


# ═══════════════════════════════════════════════════════════════════════════════
# FOOTER & STATIC CONTENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/footer/search")
@router.post("/footer/search")
async def search_footer(db: Session = Depends(get_db)):
    """Footer content - returns widgets array matching frontend FooterComponent expectations"""
    hits = [{
        "id": 1,
        "widgets": [
            {
                "title": "À Propos",
                "items": [
                    {"title": "Notre Histoire", "linkTo": "/notre-histoire"},
                    {"title": "Nos Magasins", "linkTo": "/stores"},
                    {"title": "Contact", "linkTo": "/contact-us"}
                ]
            },
            {
                "title": "Aide",
                "items": [
                    {"title": "FAQ", "linkTo": "/aide"},
                    {"title": "Livraison & Retours", "linkTo": "/livraison-retour"},
                    {"title": "Guide des Tailles", "linkTo": "/guide-tailles"}
                ]
            },
            {
                "title": "Légal",
                "items": [
                    {"title": "Conditions Générales", "linkTo": "/conditions-generales"},
                    {"title": "Politique de Confidentialité", "linkTo": "/politique-confidentialite"},
                    {"title": "Politique de Cookies", "linkTo": "/politique-cookies"}
                ]
            },
            {
                "title": "Mon Compte",
                "items": [
                    {"title": "Mon Compte", "linkTo": "/profile"},
                    {"title": "Mes Commandes", "linkTo": "/profile/orders"},
                    {"title": "Ma Wishlist", "linkTo": "/profile/wishlist"}
                ]
            }
        ],
        "brand": "Barsha",
        "copyright": "© 2024 Barsha. Tous droits réservés.",
        "paymentMethods": ["visa", "mastercard", "paypal", "cash"],
        "newsletter": {
            "title": "Newsletter",
            "subtitle": "Inscrivez-vous pour recevoir nos offres exclusives",
            "placeholder": "Votre email"
        }
    }]
    return meili_response(hits, "")


@router.get("/social-link/search")
@router.post("/social-link/search")
async def search_social_links():
    """Social media links - returns links array inside hits[0] matching frontend expectations"""
    hits = [{
        "id": 1,
        "links": [
            {"title": "Facebook", "link": "https://www.facebook.com/barsha.tunisie"},
            {"title": "Instagram", "link": "https://www.instagram.com/barsha.tunisie/"},
            {"title": "Youtube", "link": "https://www.youtube.com/channel/UCOlzEAEfVUcn8sTh5OXV0-Q"},
            {"title": "Tiktok", "link": "https://www.tiktok.com/@barsha.tunisie"}
        ]
    }]
    return meili_response(hits, "")


@router.get("/about-brand/search")
@router.post("/about-brand/search")
async def search_about_brand():
    """About brand content"""
    hits = [{
        "id": 1,
        "title": "À Propos de Barsha",
        "content": "Barsha est une marque tunisienne de prêt-à-porter fondée avec la passion de créer des vêtements de qualité, tendance et accessibles.",
        "mission": "Notre mission est de proposer une mode tunisienne moderne qui allie style, confort et qualité.",
        "values": ["Qualité", "Innovation", "Accessibilité", "Style"]
    }]
    return meili_response(hits, "")


@router.get("/contact-us/search")
@router.post("/contact-us/search")
async def search_contact():
    """Contact information"""
    hits = [{
        "id": 1,
        "email": "contact@barsha.com.tn",
        "phone": "+216 XX XXX XXX",
        "address": "Tunis, Tunisie",
        "workingHours": "Lun-Sam: 9h-18h"
    }]
    return meili_response(hits, "")


@router.get("/cookies-policy/search")
@router.post("/cookies-policy/search")
async def search_cookies_policy():
    """Cookies policy"""
    hits = [{
        "id": 1,
        "title": "Politique de Cookies",
        "content": "Nous utilisons des cookies pour améliorer votre expérience sur notre site.",
        "lastUpdated": "2024-01-01"
    }]
    return meili_response(hits, "")


@router.get("/find-store/search")
@router.post("/find-store/search")
async def search_stores():
    """Store locations"""
    hits = [
        {
            "id": 1,
            "name": "Barsha Tunis Centre",
            "address": "Avenue Habib Bourguiba, Tunis",
            "phone": "+216 XX XXX XXX",
            "hours": "Lun-Sam: 9h-20h",
            "lat": 36.8065,
            "lng": 10.1815
        },
        {
            "id": 2,
            "name": "Barsha La Marsa",
            "address": "Centre Commercial La Marsa",
            "phone": "+216 XX XXX XXX",
            "hours": "Lun-Sam: 10h-21h",
            "lat": 36.8892,
            "lng": 10.3241
        }
    ]
    return meili_response(hits, "")


@router.get("/our-history/search")
@router.post("/our-history/search")
async def search_history():
    """Brand history"""
    hits = [{
        "id": 1,
        "title": "Notre Histoire",
        "content": "Fondée en Tunisie, Barsha est née de la volonté de créer une marque de mode qui représente l'élégance tunisienne moderne.",
        "milestones": [
            {"year": "2010", "event": "Création de Barsha"},
            {"year": "2015", "event": "Ouverture du premier magasin"},
            {"year": "2020", "event": "Lancement de la boutique en ligne"}
        ]
    }]
    return meili_response(hits, "")


@router.get("/privacy/search")
@router.post("/privacy/search")
async def search_privacy():
    """Privacy policy"""
    hits = [{
        "id": 1,
        "title": "Politique de Confidentialité",
        "content": "Nous nous engageons à protéger vos données personnelles.",
        "lastUpdated": "2024-01-01"
    }]
    return meili_response(hits, "")


@router.get("/shipping-return/search")
@router.post("/shipping-return/search")
async def search_shipping_return():
    """Shipping and returns info"""
    hits = [{
        "id": 1,
        "shipping": {
            "title": "Livraison",
            "content": "Livraison gratuite à partir de 150 TND",
            "methods": [
                {"name": "Standard", "delay": "3-5 jours", "price": "7 TND"},
                {"name": "Express", "delay": "1-2 jours", "price": "15 TND"}
            ]
        },
        "returns": {
            "title": "Retours",
            "content": "Retours gratuits sous 14 jours",
            "policy": "Les articles doivent être dans leur état d'origine avec les étiquettes."
        }
    }]
    return meili_response(hits, "")


@router.get("/sizes-guide/search")
@router.post("/sizes-guide/search")
async def search_sizes_guide():
    """Sizes guide"""
    hits = [{
        "id": 1,
        "title": "Guide des Tailles",
        "categories": [
            {
                "name": "Femme",
                "sizes": [
                    {"size": "XS", "chest": "82-86", "waist": "62-66", "hips": "88-92"},
                    {"size": "S", "chest": "86-90", "waist": "66-70", "hips": "92-96"},
                    {"size": "M", "chest": "90-94", "waist": "70-74", "hips": "96-100"},
                    {"size": "L", "chest": "94-98", "waist": "74-78", "hips": "100-104"},
                    {"size": "XL", "chest": "98-102", "waist": "78-82", "hips": "104-108"}
                ]
            },
            {
                "name": "Homme",
                "sizes": [
                    {"size": "S", "chest": "88-92", "waist": "76-80"},
                    {"size": "M", "chest": "92-96", "waist": "80-84"},
                    {"size": "L", "chest": "96-100", "waist": "84-88"},
                    {"size": "XL", "chest": "100-104", "waist": "88-92"},
                    {"size": "XXL", "chest": "104-108", "waist": "92-96"}
                ]
            }
        ]
    }]
    return meili_response(hits, "")


# ═══════════════════════════════════════════════════════════════════════════════
# CHECKOUT & ORDER ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/shipping-methods/search")
@router.post("/shipping-methods/search")
async def search_shipping_methods():
    """Available shipping methods"""
    hits = [
        {"id": 1, "name": "Livraison Standard", "price": 7, "delay": "3-5 jours ouvrables", "description": "Livraison à domicile"},
        {"id": 2, "name": "Livraison Express", "price": 15, "delay": "1-2 jours ouvrables", "description": "Livraison rapide"},
        {"id": 3, "name": "Retrait en Magasin", "price": 0, "delay": "Disponible sous 24h", "description": "Retrait gratuit"}
    ]
    return meili_response(hits, "")


@router.get("/payment-methods/search")
@router.post("/payment-methods/search")
async def search_payment_methods():
    """Available payment methods"""
    hits = [
        {"id": 1, "name": "Paiement à la livraison", "code": "cash", "description": "Payez en espèces à la réception", "icon": "cash"},
        {"id": 2, "name": "Carte Bancaire", "code": "card", "description": "Visa, Mastercard", "icon": "credit-card"},
        {"id": 3, "name": "Virement Bancaire", "code": "transfer", "description": "Virement vers notre compte", "icon": "bank"}
    ]
    return meili_response(hits, "")


@router.post("/stores/search")
async def search_stores_checkout(request: Request):
    """Search stores for pickup"""
    try:
        body = await request.json()
        # Return available stores for pickup
        hits = [
            {"id": 1, "name": "Barsha Tunis Centre", "address": "Avenue Habib Bourguiba, Tunis", "available": True},
            {"id": 2, "name": "Barsha La Marsa", "address": "Centre Commercial La Marsa", "available": True}
        ]
        return meili_response(hits, "")
    except:
        return meili_response([], "")


@router.post("/cities/search")
async def search_cities(request: Request):
    """Search cities for delivery"""
    hits = [
        {"id": 1, "name": "Tunis", "postalCode": "1000", "governorate": "Tunis"},
        {"id": 2, "name": "Sfax", "postalCode": "3000", "governorate": "Sfax"},
        {"id": 3, "name": "Sousse", "postalCode": "4000", "governorate": "Sousse"},
        {"id": 4, "name": "La Marsa", "postalCode": "2070", "governorate": "Tunis"},
        {"id": 5, "name": "Ariana", "postalCode": "2080", "governorate": "Ariana"},
        {"id": 6, "name": "Ben Arous", "postalCode": "2013", "governorate": "Ben Arous"},
        {"id": 7, "name": "Nabeul", "postalCode": "8000", "governorate": "Nabeul"},
        {"id": 8, "name": "Bizerte", "postalCode": "7000", "governorate": "Bizerte"},
        {"id": 9, "name": "Gabès", "postalCode": "6000", "governorate": "Gabès"},
        {"id": 10, "name": "Monastir", "postalCode": "5000", "governorate": "Monastir"}
    ]
    return meili_response(hits, "")


# ═══════════════════════════════════════════════════════════════════════════════
# CANCEL/RETURN REASONS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/motif-cancel-order/search")
@router.post("/motif-cancel-order/search")
async def search_cancel_reasons():
    """Order cancellation reasons"""
    hits = [
        {"id": 1, "reason": "J'ai changé d'avis", "code": "changed_mind"},
        {"id": 2, "reason": "J'ai trouvé moins cher ailleurs", "code": "found_cheaper"},
        {"id": 3, "reason": "Délai de livraison trop long", "code": "delivery_delay"},
        {"id": 4, "reason": "J'ai commandé par erreur", "code": "mistake"},
        {"id": 5, "reason": "Autre", "code": "other"}
    ]
    return meili_response(hits, "")


@router.get("/motif-order-return/search")
@router.post("/motif-order-return/search")
async def search_return_reasons():
    """Order return reasons"""
    hits = [
        {"id": 1, "reason": "Article défectueux", "code": "defective"},
        {"id": 2, "reason": "Taille incorrecte", "code": "wrong_size"},
        {"id": 3, "reason": "Couleur différente de la photo", "code": "wrong_color"},
        {"id": 4, "reason": "Article ne correspond pas à la description", "code": "not_as_described"},
        {"id": 5, "reason": "J'ai changé d'avis", "code": "changed_mind"},
        {"id": 6, "reason": "Autre", "code": "other"}
    ]
    return meili_response(hits, "")


# ═══════════════════════════════════════════════════════════════════════════════
# GIFT CARDS & LOYALTY
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/gift-card-prices/search")
@router.post("/gift-card-prices/search")
async def search_gift_card_prices():
    """Gift card price options"""
    hits = [
        {"id": 1, "value": 50, "label": "50 TND"},
        {"id": 2, "value": 100, "label": "100 TND"},
        {"id": 3, "value": 150, "label": "150 TND"},
        {"id": 4, "value": 200, "label": "200 TND"}
    ]
    return meili_response(hits, "")


@router.get("/gift-card-events/search")
@router.post("/gift-card-events/search")
async def search_gift_card_events():
    """Gift card occasion types"""
    hits = [
        {"id": 1, "name": "Anniversaire", "icon": "cake"},
        {"id": 2, "name": "Mariage", "icon": "heart"},
        {"id": 3, "name": "Fête", "icon": "party"},
        {"id": 4, "name": "Remerciement", "icon": "thanks"}
    ]
    return meili_response(hits, "")


@router.get("/faq-gift-card/search")
@router.post("/faq-gift-card/search")
async def search_gift_card_faq():
    """Gift card FAQ"""
    hits = [
        {"id": 1, "question": "Comment utiliser ma carte cadeau?", "answer": "Entrez le code de votre carte cadeau lors du paiement."},
        {"id": 2, "question": "Ma carte cadeau a-t-elle une date d'expiration?", "answer": "Les cartes cadeaux sont valables 1 an."},
        {"id": 3, "question": "Puis-je utiliser ma carte cadeau en magasin?", "answer": "Oui, les cartes cadeaux sont valables en ligne et en magasin."}
    ]
    return meili_response(hits, "")


@router.get("/faq-loyalty/search")
@router.post("/faq-loyalty/search")
async def search_loyalty_faq():
    """Loyalty program FAQ"""
    hits = [
        {"id": 1, "question": "Comment fonctionne le programme de fidélité?", "answer": "Gagnez des points à chaque achat et convertissez-les en réductions."},
        {"id": 2, "question": "Combien de points par achat?", "answer": "1 TND dépensé = 1 point fidélité."},
        {"id": 3, "question": "Comment utiliser mes points?", "answer": "100 points = 5 TND de réduction sur votre prochaine commande."}
    ]
    return meili_response(hits, "")


@router.get("/loyalty-card-models/search")
@router.post("/loyalty-card-models/search")
async def search_loyalty_cards():
    """Loyalty card tiers"""
    hits = [
        {"id": 1, "name": "Bronze", "minPoints": 0, "benefits": ["5% de réduction anniversaire"]},
        {"id": 2, "name": "Silver", "minPoints": 500, "benefits": ["10% de réduction anniversaire", "Livraison gratuite"]},
        {"id": 3, "name": "Gold", "minPoints": 1000, "benefits": ["15% de réduction anniversaire", "Livraison express gratuite", "Accès ventes privées"]}
    ]
    return meili_response(hits, "")
