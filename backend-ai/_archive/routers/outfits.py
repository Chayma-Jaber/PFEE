"""
Outfits Router
Shop the Look / Outfit Builder feature endpoints
Allows browsing curated outfits and adding all items to cart
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
import re

from app.core.database import get_db
from app.core.security import (
    require_catalog_manager,
    get_current_user,
    get_optional_current_user
)
from app.models.outfit import Outfit, OutfitItem, OutfitFamily, OutfitOccasion, OutfitSeason
from app.models.product import Product
from app.models.cart import CartItem
from app.models.admin_log import log_admin_activity


# ─────────────────────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────────────────────

class OutfitItemCreate(BaseModel):
    product_id: int
    position: Optional[int] = 0
    styling_note: Optional[str] = None
    recommended_color: Optional[str] = None
    recommended_size: Optional[str] = None


class OutfitCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    description: Optional[str] = None
    style_tags: Optional[str] = None  # Comma-separated
    occasion: Optional[str] = "everyday"
    season: Optional[str] = "all_season"
    family: Optional[str] = "UNISEX"
    cover_image: Optional[str] = None
    is_featured: Optional[bool] = False
    is_active: Optional[bool] = True
    items: Optional[List[OutfitItemCreate]] = []


class OutfitUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    style_tags: Optional[str] = None
    occasion: Optional[str] = None
    season: Optional[str] = None
    family: Optional[str] = None
    cover_image: Optional[str] = None
    is_featured: Optional[bool] = None
    is_active: Optional[bool] = None


class AddToCartResponse(BaseModel):
    success: bool
    items_added: int
    message: str


# ─────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────

def generate_slug(title: str) -> str:
    """Generate URL-friendly slug from title"""
    slug = title.lower()
    slug = re.sub(r'[àáâãäå]', 'a', slug)
    slug = re.sub(r'[èéêë]', 'e', slug)
    slug = re.sub(r'[ìíîï]', 'i', slug)
    slug = re.sub(r'[òóôõö]', 'o', slug)
    slug = re.sub(r'[ùúûü]', 'u', slug)
    slug = re.sub(r'[ç]', 'c', slug)
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = re.sub(r'^-+|-+$', '', slug)
    return slug


def get_enum_value(enum_class, value: str, default):
    """Safely get enum value from string"""
    if not value:
        return default
    try:
        # Try direct value match
        for item in enum_class:
            if item.value.lower() == value.lower():
                return item
        # Try name match
        return enum_class[value.upper()]
    except (KeyError, AttributeError):
        return default


# ─────────────────────────────────────────────────────────────
# PUBLIC ROUTER (Customer-facing)
# ─────────────────────────────────────────────────────────────

router = APIRouter(prefix="/api/outfits", tags=["Outfits"])


@router.get("")
async def list_outfits(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=50),
    family: Optional[str] = None,
    occasion: Optional[str] = None,
    season: Optional[str] = None,
    style: Optional[str] = None,
    featured_only: bool = False,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List all active outfits with optional filters
    Public endpoint for browsing outfit collections
    """
    query = db.query(Outfit).filter(Outfit.is_active == True)

    # Apply filters
    if family:
        family_enum = get_enum_value(OutfitFamily, family, None)
        if family_enum:
            query = query.filter(Outfit.family == family_enum)

    if occasion:
        occasion_enum = get_enum_value(OutfitOccasion, occasion, None)
        if occasion_enum:
            query = query.filter(Outfit.occasion == occasion_enum)

    if season:
        season_enum = get_enum_value(OutfitSeason, season, None)
        if season_enum:
            query = query.filter(Outfit.season == season_enum)

    if style:
        # Search in style_tags (comma-separated)
        query = query.filter(Outfit.style_tags.ilike(f"%{style}%"))

    if featured_only:
        query = query.filter(Outfit.is_featured == True)

    if search:
        query = query.filter(
            or_(
                Outfit.title.ilike(f"%{search}%"),
                Outfit.description.ilike(f"%{search}%"),
                Outfit.style_tags.ilike(f"%{search}%")
            )
        )

    # Get total count
    total = query.count()

    # Order by featured first, then by creation date
    query = query.order_by(Outfit.is_featured.desc(), Outfit.created_at.desc())

    # Paginate
    outfits = query.offset((page - 1) * per_page).limit(per_page).all()

    return {
        "items": [outfit.to_dict(include_items=False) for outfit in outfits],
        "total": total,
        "page": page,
        "perPage": per_page,
        "pages": (total + per_page - 1) // per_page if total > 0 else 0
    }


@router.get("/featured")
async def get_featured_outfits(
    limit: int = Query(6, ge=1, le=20),
    family: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get featured outfits for homepage display
    """
    query = db.query(Outfit).filter(
        Outfit.is_active == True,
        Outfit.is_featured == True
    )

    if family:
        family_enum = get_enum_value(OutfitFamily, family, None)
        if family_enum:
            query = query.filter(
                or_(Outfit.family == family_enum, Outfit.family == OutfitFamily.UNISEX)
            )

    outfits = query.order_by(Outfit.view_count.desc()).limit(limit).all()

    return {
        "items": [outfit.to_dict(include_items=True) for outfit in outfits]
    }


@router.get("/occasions")
async def get_outfit_occasions(db: Session = Depends(get_db)):
    """
    Get all available occasions with outfit counts
    """
    occasions = []
    for occasion in OutfitOccasion:
        count = db.query(Outfit).filter(
            Outfit.is_active == True,
            Outfit.occasion == occasion
        ).count()
        occasions.append({
            "value": occasion.value,
            "label": occasion.value.replace("_", " ").title(),
            "count": count
        })
    return {"occasions": occasions}


@router.get("/for-product/{product_id}")
async def get_outfits_for_product(
    product_id: int,
    limit: int = Query(4, ge=1, le=10),
    db: Session = Depends(get_db)
):
    """
    Get outfits containing a specific product
    Useful for "Complete the Look" on product detail pages
    """
    # Verify product exists
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Find outfits containing this product
    outfits = db.query(Outfit).join(OutfitItem).filter(
        OutfitItem.product_id == product_id,
        Outfit.is_active == True
    ).order_by(Outfit.is_featured.desc(), Outfit.view_count.desc()).limit(limit).all()

    return {
        "productId": product_id,
        "outfits": [outfit.to_dict(include_items=True) for outfit in outfits]
    }


@router.get("/{outfit_id}")
async def get_outfit_details(
    outfit_id: int,
    db: Session = Depends(get_db)
):
    """
    Get detailed outfit information with all products
    """
    outfit = db.query(Outfit).options(
        joinedload(Outfit.items).joinedload(OutfitItem.product)
    ).filter(Outfit.id == outfit_id).first()

    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    if not outfit.is_active:
        raise HTTPException(status_code=404, detail="Outfit is not available")

    # Increment view count
    outfit.view_count += 1
    db.commit()

    return outfit.to_dict(include_items=True)


@router.get("/slug/{slug}")
async def get_outfit_by_slug(
    slug: str,
    db: Session = Depends(get_db)
):
    """
    Get outfit by slug (SEO-friendly URL)
    """
    outfit = db.query(Outfit).options(
        joinedload(Outfit.items).joinedload(OutfitItem.product)
    ).filter(Outfit.slug == slug).first()

    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    if not outfit.is_active:
        raise HTTPException(status_code=404, detail="Outfit is not available")

    # Increment view count
    outfit.view_count += 1
    db.commit()

    return outfit.to_dict(include_items=True)


@router.post("/{outfit_id}/add-all-to-cart")
async def add_outfit_to_cart(
    outfit_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add all products from an outfit to the user's cart
    """
    outfit = db.query(Outfit).options(
        joinedload(Outfit.items).joinedload(OutfitItem.product)
    ).filter(Outfit.id == outfit_id, Outfit.is_active == True).first()

    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    user_id = user["id"]
    items_added = 0
    skipped_items = []

    for outfit_item in outfit.items:
        product = outfit_item.product
        if not product or not product.is_active or not product.is_available:
            skipped_items.append(f"{product.title if product else 'Unknown'} (not available)")
            continue

        # Check if product is already in cart
        existing = db.query(CartItem).filter(
            CartItem.user_id == user_id,
            CartItem.product_id == product.id
        ).first()

        if existing:
            # Increment quantity
            existing.quantity += 1
            existing.updated_at = datetime.utcnow()
        else:
            # Add new cart item
            cart_item = CartItem(
                user_id=user_id,
                product_id=product.id,
                quantity=1,
                selected_color=outfit_item.recommended_color,
                selected_size=outfit_item.recommended_size
            )
            db.add(cart_item)

        items_added += 1

    # Update outfit analytics
    outfit.add_to_cart_count += 1
    db.commit()

    message = f"{items_added} article(s) ajouté(s) au panier"
    if skipped_items:
        message += f". Articles non disponibles: {', '.join(skipped_items)}"

    return {
        "success": True,
        "itemsAdded": items_added,
        "message": message,
        "outfitId": outfit_id,
        "outfitTitle": outfit.title
    }


# ─────────────────────────────────────────────────────────────
# ADMIN ROUTER
# ─────────────────────────────────────────────────────────────

admin_router = APIRouter(prefix="/api/admin/outfits", tags=["Admin Outfits"])


@admin_router.get("")
async def admin_list_outfits(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_featured: Optional[bool] = None,
    family: Optional[str] = None,
    _: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """
    Admin: List all outfits with filters
    """
    query = db.query(Outfit)

    if search:
        query = query.filter(
            or_(
                Outfit.title.ilike(f"%{search}%"),
                Outfit.description.ilike(f"%{search}%")
            )
        )

    if is_active is not None:
        query = query.filter(Outfit.is_active == is_active)

    if is_featured is not None:
        query = query.filter(Outfit.is_featured == is_featured)

    if family:
        family_enum = get_enum_value(OutfitFamily, family, None)
        if family_enum:
            query = query.filter(Outfit.family == family_enum)

    total = query.count()
    outfits = query.order_by(Outfit.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return {
        "items": [outfit.to_dict(include_items=True) for outfit in outfits],
        "total": total,
        "page": page,
        "perPage": per_page,
        "pages": (total + per_page - 1) // per_page if total > 0 else 0
    }


@admin_router.get("/{outfit_id}")
async def admin_get_outfit(
    outfit_id: int,
    _: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """
    Admin: Get outfit details
    """
    outfit = db.query(Outfit).options(
        joinedload(Outfit.items).joinedload(OutfitItem.product)
    ).filter(Outfit.id == outfit_id).first()

    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    return outfit.to_dict(include_items=True)


@admin_router.post("")
async def create_outfit(
    outfit_data: OutfitCreate,
    request: Request,
    payload: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """
    Admin: Create a new outfit
    """
    # Generate slug
    slug = outfit_data.slug or generate_slug(outfit_data.title)

    # Ensure slug uniqueness
    base_slug = slug
    counter = 1
    while db.query(Outfit).filter(Outfit.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Parse enums
    occasion = get_enum_value(OutfitOccasion, outfit_data.occasion, OutfitOccasion.EVERYDAY)
    season = get_enum_value(OutfitSeason, outfit_data.season, OutfitSeason.ALL_SEASON)
    family = get_enum_value(OutfitFamily, outfit_data.family, OutfitFamily.UNISEX)

    outfit = Outfit(
        title=outfit_data.title,
        slug=slug,
        description=outfit_data.description,
        style_tags=outfit_data.style_tags,
        occasion=occasion,
        season=season,
        family=family,
        cover_image=outfit_data.cover_image,
        is_featured=outfit_data.is_featured,
        is_active=outfit_data.is_active,
        created_by=int(payload.get("sub"))
    )

    db.add(outfit)
    db.flush()

    # Add items if provided
    if outfit_data.items:
        for idx, item_data in enumerate(outfit_data.items):
            # Verify product exists
            product = db.query(Product).filter(Product.id == item_data.product_id).first()
            if not product:
                continue

            item = OutfitItem(
                outfit_id=outfit.id,
                product_id=item_data.product_id,
                position=item_data.position if item_data.position else idx,
                styling_note=item_data.styling_note,
                recommended_color=item_data.recommended_color,
                recommended_size=item_data.recommended_size
            )
            db.add(item)

    db.commit()
    db.refresh(outfit)

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="create_outfit",
        resource_type="outfit",
        resource_id=outfit.id,
        resource_reference=outfit.slug,
        new_values={"title": outfit.title},
        ip_address=request.client.host if request.client else None
    )

    return outfit.to_dict(include_items=True)


@admin_router.put("/{outfit_id}")
async def update_outfit(
    outfit_id: int,
    outfit_data: OutfitUpdate,
    request: Request,
    payload: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """
    Admin: Update an existing outfit
    """
    outfit = db.query(Outfit).filter(Outfit.id == outfit_id).first()
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    old_values = {}
    new_values = {}

    # Update simple fields
    for field in ["title", "slug", "description", "style_tags", "cover_image"]:
        value = getattr(outfit_data, field, None)
        if value is not None:
            old_values[field] = getattr(outfit, field)
            setattr(outfit, field, value)
            new_values[field] = value

    # Update boolean fields
    for field in ["is_featured", "is_active"]:
        value = getattr(outfit_data, field, None)
        if value is not None:
            old_values[field] = getattr(outfit, field)
            setattr(outfit, field, value)
            new_values[field] = value

    # Update enum fields
    if outfit_data.occasion is not None:
        occasion = get_enum_value(OutfitOccasion, outfit_data.occasion, outfit.occasion)
        old_values["occasion"] = outfit.occasion.value if outfit.occasion else None
        outfit.occasion = occasion
        new_values["occasion"] = occasion.value if occasion else None

    if outfit_data.season is not None:
        season = get_enum_value(OutfitSeason, outfit_data.season, outfit.season)
        old_values["season"] = outfit.season.value if outfit.season else None
        outfit.season = season
        new_values["season"] = season.value if season else None

    if outfit_data.family is not None:
        family = get_enum_value(OutfitFamily, outfit_data.family, outfit.family)
        old_values["family"] = outfit.family.value if outfit.family else None
        outfit.family = family
        new_values["family"] = family.value if family else None

    outfit.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(outfit)

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="update_outfit",
        resource_type="outfit",
        resource_id=outfit.id,
        resource_reference=outfit.slug,
        old_values=old_values,
        new_values=new_values,
        ip_address=request.client.host if request.client else None
    )

    return outfit.to_dict(include_items=True)


@admin_router.delete("/{outfit_id}")
async def delete_outfit(
    outfit_id: int,
    request: Request,
    payload: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """
    Admin: Delete (deactivate) an outfit
    """
    outfit = db.query(Outfit).filter(Outfit.id == outfit_id).first()
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    # Soft delete
    outfit.is_active = False
    outfit.updated_at = datetime.utcnow()
    db.commit()

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="delete_outfit",
        resource_type="outfit",
        resource_id=outfit.id,
        resource_reference=outfit.slug,
        description=f"Outfit '{outfit.title}' deactivated",
        ip_address=request.client.host if request.client else None
    )

    return {"message": "Outfit archived successfully"}


@admin_router.post("/{outfit_id}/items")
async def add_item_to_outfit(
    outfit_id: int,
    item_data: OutfitItemCreate,
    request: Request,
    payload: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """
    Admin: Add a product to an outfit
    """
    outfit = db.query(Outfit).filter(Outfit.id == outfit_id).first()
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    # Verify product exists
    product = db.query(Product).filter(Product.id == item_data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if product is already in outfit
    existing = db.query(OutfitItem).filter(
        OutfitItem.outfit_id == outfit_id,
        OutfitItem.product_id == item_data.product_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Product is already in this outfit")

    # Determine position (append to end if not specified)
    if item_data.position is None or item_data.position == 0:
        max_pos = db.query(OutfitItem).filter(OutfitItem.outfit_id == outfit_id).count()
        position = max_pos
    else:
        position = item_data.position

    item = OutfitItem(
        outfit_id=outfit_id,
        product_id=item_data.product_id,
        position=position,
        styling_note=item_data.styling_note,
        recommended_color=item_data.recommended_color,
        recommended_size=item_data.recommended_size
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="add_outfit_item",
        resource_type="outfit_item",
        resource_id=item.id,
        resource_reference=f"{outfit.slug}/{product.sku}",
        new_values={"product_id": item_data.product_id, "outfit_id": outfit_id},
        ip_address=request.client.host if request.client else None
    )

    return item.to_dict()


@admin_router.put("/{outfit_id}/items/{item_id}")
async def update_outfit_item(
    outfit_id: int,
    item_id: int,
    item_data: OutfitItemCreate,
    payload: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """
    Admin: Update an item within an outfit
    """
    item = db.query(OutfitItem).filter(
        OutfitItem.id == item_id,
        OutfitItem.outfit_id == outfit_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Outfit item not found")

    if item_data.position is not None:
        item.position = item_data.position
    if item_data.styling_note is not None:
        item.styling_note = item_data.styling_note
    if item_data.recommended_color is not None:
        item.recommended_color = item_data.recommended_color
    if item_data.recommended_size is not None:
        item.recommended_size = item_data.recommended_size

    db.commit()
    db.refresh(item)

    return item.to_dict()


@admin_router.delete("/{outfit_id}/items/{item_id}")
async def remove_item_from_outfit(
    outfit_id: int,
    item_id: int,
    request: Request,
    payload: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """
    Admin: Remove a product from an outfit
    """
    item = db.query(OutfitItem).filter(
        OutfitItem.id == item_id,
        OutfitItem.outfit_id == outfit_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Outfit item not found")

    product_id = item.product_id
    db.delete(item)
    db.commit()

    # Reorder remaining items
    remaining = db.query(OutfitItem).filter(
        OutfitItem.outfit_id == outfit_id
    ).order_by(OutfitItem.position).all()

    for idx, remaining_item in enumerate(remaining):
        remaining_item.position = idx
    db.commit()

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="remove_outfit_item",
        resource_type="outfit_item",
        resource_id=item_id,
        description=f"Removed product {product_id} from outfit {outfit_id}",
        ip_address=request.client.host if request.client else None
    )

    return {"message": "Item removed from outfit"}


@admin_router.post("/{outfit_id}/reorder")
async def reorder_outfit_items(
    outfit_id: int,
    item_ids: List[int],
    payload: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """
    Admin: Reorder items within an outfit
    item_ids: list of item IDs in the desired order
    """
    outfit = db.query(Outfit).filter(Outfit.id == outfit_id).first()
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    for position, item_id in enumerate(item_ids):
        item = db.query(OutfitItem).filter(
            OutfitItem.id == item_id,
            OutfitItem.outfit_id == outfit_id
        ).first()
        if item:
            item.position = position

    db.commit()

    return {"message": "Items reordered successfully"}


@admin_router.post("/{outfit_id}/duplicate")
async def duplicate_outfit(
    outfit_id: int,
    request: Request,
    payload: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """
    Admin: Duplicate an existing outfit
    """
    source = db.query(Outfit).options(
        joinedload(Outfit.items)
    ).filter(Outfit.id == outfit_id).first()

    if not source:
        raise HTTPException(status_code=404, detail="Outfit not found")

    # Generate new slug
    new_slug = f"{source.slug}-copy"
    counter = 1
    while db.query(Outfit).filter(Outfit.slug == new_slug).first():
        new_slug = f"{source.slug}-copy-{counter}"
        counter += 1

    # Create duplicate
    new_outfit = Outfit(
        title=f"{source.title} (Copy)",
        slug=new_slug,
        description=source.description,
        style_tags=source.style_tags,
        occasion=source.occasion,
        season=source.season,
        family=source.family,
        cover_image=source.cover_image,
        is_featured=False,
        is_active=False,  # Start as inactive
        created_by=int(payload.get("sub"))
    )

    db.add(new_outfit)
    db.flush()

    # Duplicate items
    for item in source.items:
        new_item = OutfitItem(
            outfit_id=new_outfit.id,
            product_id=item.product_id,
            position=item.position,
            styling_note=item.styling_note,
            recommended_color=item.recommended_color,
            recommended_size=item.recommended_size
        )
        db.add(new_item)

    db.commit()
    db.refresh(new_outfit)

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="duplicate_outfit",
        resource_type="outfit",
        resource_id=new_outfit.id,
        resource_reference=new_outfit.slug,
        description=f"Duplicated from outfit #{outfit_id}",
        ip_address=request.client.host if request.client else None
    )

    return new_outfit.to_dict(include_items=True)
