"""
Product Bundles Router
API endpoints for bundle deals
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

from ..core.database import get_db
from ..core.security import get_current_user, get_optional_user
from ..models.bundles import ProductBundle, BundleItem
from ..models.user import User
from ..models.product import Product

router = APIRouter(prefix="/api/bundles", tags=["Bundles"])
admin_router = APIRouter(prefix="/api/admin/bundles", tags=["Admin Bundles"])


# ===================== SCHEMAS =====================

class BundleItemCreate(BaseModel):
    product_id: str
    quantity: int = 1
    position: int = 0


class BundleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    discount_percentage: float = 0.0
    image_url: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    position: int = 0
    items: List[BundleItemCreate] = []


class BundleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    discount_percentage: Optional[float] = None
    is_active: Optional[bool] = None
    image_url: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    position: Optional[int] = None


class AddBundleToCartRequest(BaseModel):
    selected_variants: Optional[Dict[str, str]] = None  # product_id -> ean13


# ===================== HELPER FUNCTIONS =====================

def get_product_data(db: Session, product_id: str) -> Optional[Dict[str, Any]]:
    """Fetch product data from local database"""
    try:
        pid = int(product_id)
        product = db.query(Product).filter(Product.id == pid).first()
        if product:
            return product.to_dict(include_variants=True)
    except (ValueError, TypeError):
        # Try finding by SKU
        product = db.query(Product).filter(Product.sku == product_id).first()
        if product:
            return product.to_dict(include_variants=True)
    return None


def enrich_bundle_with_products(db: Session, bundle: ProductBundle) -> Dict[str, Any]:
    """Enrich bundle data with actual product information"""
    bundle_data = bundle.to_dict(include_items=False)

    items_with_products = []
    total_original_price = 0.0

    for item in sorted(bundle.items, key=lambda x: x.position):
        item_data = item.to_dict()
        product_data = get_product_data(db, item.product_id)

        if product_data:
            item_data["product"] = product_data
            # Calculate price contribution
            price = product_data.get("currentPrice", 0) or product_data.get("price", 0)
            total_original_price += price * item.quantity
        else:
            item_data["product"] = None

        items_with_products.append(item_data)

    bundle_data["items"] = items_with_products
    bundle_data["totalOriginalPrice"] = round(total_original_price, 3)

    # Calculate bundle price with discount
    discount_amount = total_original_price * (bundle.discount_percentage / 100)
    bundle_data["bundlePrice"] = round(total_original_price - discount_amount, 3)
    bundle_data["savingsAmount"] = round(discount_amount, 3)
    bundle_data["productCount"] = len(bundle.items)

    return bundle_data


def is_bundle_active(bundle: ProductBundle) -> bool:
    """Check if bundle is currently active based on dates"""
    if not bundle.is_active:
        return False

    now = datetime.utcnow()

    if bundle.start_date and now < bundle.start_date:
        return False

    if bundle.end_date and now > bundle.end_date:
        return False

    return True


# ===================== PUBLIC ENDPOINTS =====================

@router.get("")
async def get_bundles(
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
    active_only: bool = Query(True),
    db: Session = Depends(get_db)
):
    """
    Get list of active product bundles
    """
    query = db.query(ProductBundle)

    if active_only:
        query = query.filter(ProductBundle.is_active == True)
        # Also filter by date range
        now = datetime.utcnow()
        query = query.filter(
            (ProductBundle.start_date == None) | (ProductBundle.start_date <= now)
        ).filter(
            (ProductBundle.end_date == None) | (ProductBundle.end_date >= now)
        )

    total = query.count()
    bundles = query.order_by(ProductBundle.position, ProductBundle.created_at.desc()).offset(offset).limit(limit).all()

    enriched_bundles = [enrich_bundle_with_products(db, b) for b in bundles]

    return {
        "bundles": enriched_bundles,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/featured")
async def get_featured_bundles(
    limit: int = Query(4, ge=1, le=10),
    db: Session = Depends(get_db)
):
    """
    Get featured bundles for homepage display
    """
    now = datetime.utcnow()
    bundles = db.query(ProductBundle).filter(
        ProductBundle.is_active == True,
        (ProductBundle.start_date == None) | (ProductBundle.start_date <= now),
        (ProductBundle.end_date == None) | (ProductBundle.end_date >= now)
    ).order_by(
        ProductBundle.position,
        ProductBundle.purchase_count.desc()
    ).limit(limit).all()

    return {
        "bundles": [enrich_bundle_with_products(db, b) for b in bundles]
    }


@router.get("/{bundle_id}")
async def get_bundle(
    bundle_id: int,
    db: Session = Depends(get_db)
):
    """
    Get a specific bundle with all product details
    """
    bundle = db.query(ProductBundle).filter(ProductBundle.id == bundle_id).first()

    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle non trouve")

    # Increment view count
    bundle.view_count += 1
    db.commit()

    return {
        "bundle": enrich_bundle_with_products(db, bundle),
        "isActive": is_bundle_active(bundle)
    }


@router.post("/{bundle_id}/add-to-cart")
async def add_bundle_to_cart(
    bundle_id: int,
    request: AddBundleToCartRequest = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add all items from a bundle to the user's cart.
    Returns the items that need to be added on the client side.
    """
    bundle = db.query(ProductBundle).filter(ProductBundle.id == bundle_id).first()

    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle non trouve")

    if not is_bundle_active(bundle):
        raise HTTPException(status_code=400, detail="Ce bundle n'est plus disponible")

    selected_variants = request.selected_variants if request else {}

    items_to_add = []
    unavailable_items = []

    for item in bundle.items:
        product_data = get_product_data(db, item.product_id)

        if not product_data:
            unavailable_items.append({
                "productId": item.product_id,
                "reason": "Produit introuvable"
            })
            continue

        # Check if product is available
        if not product_data.get("isAvailable", True):
            unavailable_items.append({
                "productId": item.product_id,
                "title": product_data.get("title"),
                "reason": "Produit indisponible"
            })
            continue

        # Get selected variant or default to first available
        variants = product_data.get("variants", [])
        selected_ean = selected_variants.get(item.product_id)

        selected_variant = None
        if selected_ean:
            selected_variant = next(
                (v for v in variants if v.get("ean13") == selected_ean and v.get("isInStock")),
                None
            )

        if not selected_variant and variants:
            # Find first in-stock variant
            selected_variant = next(
                (v for v in variants if v.get("isInStock")),
                None
            )

        if not selected_variant:
            unavailable_items.append({
                "productId": item.product_id,
                "title": product_data.get("title"),
                "reason": "Aucune variante disponible"
            })
            continue

        items_to_add.append({
            "product": product_data,
            "quantity": item.quantity,
            "selectedColor": selected_variant.get("color", ""),
            "selectedSize": selected_variant.get("size", ""),
            "ean13": selected_variant.get("ean13", ""),
            "image": product_data.get("firstImageUrl", "")
        })

    # Update purchase count
    if items_to_add:
        bundle.purchase_count += 1
        db.commit()

    return {
        "success": len(items_to_add) > 0,
        "itemsToAdd": items_to_add,
        "addedCount": len(items_to_add),
        "unavailableItems": unavailable_items,
        "bundleDiscount": bundle.discount_percentage,
        "message": f"{len(items_to_add)} article(s) pret(s) a etre ajoutes au panier" if items_to_add else "Aucun article disponible"
    }


# ===================== ADMIN ENDPOINTS =====================

@admin_router.get("")
async def admin_get_bundles(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    include_inactive: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin: Get all bundles including inactive ones"""
    if current_user.role.value not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Acces refuse")

    query = db.query(ProductBundle)

    if not include_inactive:
        query = query.filter(ProductBundle.is_active == True)

    total = query.count()
    bundles = query.order_by(ProductBundle.position, ProductBundle.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "bundles": [enrich_bundle_with_products(db, b) for b in bundles],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@admin_router.post("")
async def admin_create_bundle(
    bundle_data: BundleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin: Create a new bundle"""
    if current_user.role.value not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Acces refuse")

    # Create bundle
    bundle = ProductBundle(
        name=bundle_data.name,
        description=bundle_data.description,
        discount_percentage=bundle_data.discount_percentage,
        image_url=bundle_data.image_url,
        start_date=bundle_data.start_date,
        end_date=bundle_data.end_date,
        position=bundle_data.position
    )
    db.add(bundle)
    db.flush()  # Get the bundle ID

    # Add items
    for idx, item_data in enumerate(bundle_data.items):
        item = BundleItem(
            bundle_id=bundle.id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            position=item_data.position or idx
        )
        db.add(item)

    db.commit()
    db.refresh(bundle)

    return {
        "success": True,
        "bundle": enrich_bundle_with_products(db, bundle),
        "message": "Bundle cree avec succes"
    }


@admin_router.put("/{bundle_id}")
async def admin_update_bundle(
    bundle_id: int,
    update_data: BundleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin: Update a bundle"""
    if current_user.role.value not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Acces refuse")

    bundle = db.query(ProductBundle).filter(ProductBundle.id == bundle_id).first()

    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle non trouve")

    # Update fields
    for field, value in update_data.dict(exclude_unset=True).items():
        setattr(bundle, field, value)

    bundle.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(bundle)

    return {
        "success": True,
        "bundle": enrich_bundle_with_products(db, bundle),
        "message": "Bundle mis a jour"
    }


@admin_router.delete("/{bundle_id}")
async def admin_delete_bundle(
    bundle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin: Delete a bundle"""
    if current_user.role.value not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Acces refuse")

    bundle = db.query(ProductBundle).filter(ProductBundle.id == bundle_id).first()

    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle non trouve")

    db.delete(bundle)
    db.commit()

    return {
        "success": True,
        "message": "Bundle supprime"
    }


@admin_router.post("/{bundle_id}/items")
async def admin_add_bundle_item(
    bundle_id: int,
    item_data: BundleItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin: Add an item to a bundle"""
    if current_user.role.value not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Acces refuse")

    bundle = db.query(ProductBundle).filter(ProductBundle.id == bundle_id).first()

    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle non trouve")

    # Check if product already in bundle
    existing = db.query(BundleItem).filter(
        BundleItem.bundle_id == bundle_id,
        BundleItem.product_id == item_data.product_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Ce produit est deja dans le bundle")

    item = BundleItem(
        bundle_id=bundle_id,
        product_id=item_data.product_id,
        quantity=item_data.quantity,
        position=item_data.position
    )
    db.add(item)
    db.commit()

    return {
        "success": True,
        "bundle": enrich_bundle_with_products(db, bundle),
        "message": "Produit ajoute au bundle"
    }


@admin_router.delete("/{bundle_id}/items/{item_id}")
async def admin_remove_bundle_item(
    bundle_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin: Remove an item from a bundle"""
    if current_user.role.value not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Acces refuse")

    item = db.query(BundleItem).filter(
        BundleItem.id == item_id,
        BundleItem.bundle_id == bundle_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item non trouve")

    db.delete(item)
    db.commit()

    bundle = db.query(ProductBundle).filter(ProductBundle.id == bundle_id).first()

    return {
        "success": True,
        "bundle": enrich_bundle_with_products(db, bundle),
        "message": "Produit retire du bundle"
    }
