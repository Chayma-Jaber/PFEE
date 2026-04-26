"""
Admin Products Router
Product management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime
from typing import Optional
import re
import os
import json

from app.core.database import get_db
from app.core.security import require_catalog_manager
from app.models.product import Product, Category, ProductVariant, ProductImage
from app.models.admin_log import log_admin_activity
from app.schemas.product import ProductCreate, ProductUpdate, CategoryCreate, CategoryUpdate

router = APIRouter(prefix="/admin/products", tags=["Admin Products"])

# Load catalog products from JSON file
CATALOG_PRODUCTS = []
CATALOG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "barsha_products.json")
try:
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        CATALOG_PRODUCTS = json.load(f)
except Exception as e:
    print(f"Warning: Could not load catalog products: {e}")


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


@router.get("")
async def list_products(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    famille: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_featured: Optional[bool] = None,
    low_stock: bool = False,
    _: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """List products with filters and pagination"""
    # Check if we have products in the database
    db_count = db.query(Product).count()

    if db_count == 0 and CATALOG_PRODUCTS:
        # Use catalog products from JSON file
        filtered = CATALOG_PRODUCTS.copy()

        # Apply filters
        if search:
            search_lower = search.lower()
            filtered = [p for p in filtered if search_lower in (p.get("nom", "") or "").lower()
                        or search_lower in str(p.get("id", ""))]

        if famille:
            filtered = [p for p in filtered if (p.get("famille") or "").upper() == famille.upper()]

        total = len(filtered)
        start = (page - 1) * per_page
        end = start + per_page
        paginated = filtered[start:end]

        # Format products for frontend
        items = []
        for p in paginated:
            price_str = str(p.get("prix", "0")).replace(" TND", "").replace(",", ".").strip()
            try:
                price = float(price_str)
            except:
                price = 0.0

            items.append({
                "id": p.get("id"),
                "sku": f"BRS-{p.get('id', 0)}",
                "title": p.get("nom", ""),
                "price": price,
                "currentPrice": price,
                "discount": p.get("discount", False),
                "discountValue": p.get("discount_value", 0),
                "isActive": True,
                "totalStock": 50,  # Default stock
                "firstImageUrl": p.get("firstImg") or p.get("image", ""),
                "famille": p.get("famille", ""),
                "ligne": p.get("ligne", "")
            })

        return {
            "items": items,
            "total": total,
            "page": page,
            "perPage": per_page,
            "pages": (total + per_page - 1) // per_page if total > 0 else 0
        }

    # Use database products
    query = db.query(Product)

    if search:
        query = query.filter(
            or_(
                Product.title.ilike(f"%{search}%"),
                Product.sku.ilike(f"%{search}%"),
                Product.description.ilike(f"%{search}%")
            )
        )

    if category_id:
        query = query.filter(Product.categories.any(Category.id == category_id))

    if famille:
        query = query.filter(Product.famille == famille)

    if is_active is not None:
        query = query.filter(Product.is_active == is_active)

    if is_featured is not None:
        query = query.filter(Product.is_featured == is_featured)

    if low_stock:
        # Products with any variant that has low stock
        query = query.filter(
            Product.variants.any(
                ProductVariant.quantity <= ProductVariant.low_stock_threshold
            )
        )

    total = query.count()

    products = query.order_by(Product.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return {
        "items": [product.to_dict() for product in products],
        "total": total,
        "page": page,
        "perPage": per_page,
        "pages": (total + per_page - 1) // per_page
    }


@router.get("/{product_id}")
async def get_product(
    product_id: int,
    _: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """Get product details"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return product.to_dict()


@router.post("")
async def create_product(
    product_data: ProductCreate,
    request: Request,
    payload: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """Create a new product"""
    # Check SKU uniqueness
    existing = db.query(Product).filter(Product.sku == product_data.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail="SKU already exists")

    # Generate slug
    slug = product_data.slug or generate_slug(product_data.title)

    # Ensure slug uniqueness
    base_slug = slug
    counter = 1
    while db.query(Product).filter(Product.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    product = Product(
        sku=product_data.sku,
        title=product_data.title,
        slug=slug,
        description=product_data.description,
        short_description=product_data.short_description,
        price=product_data.price,
        current_price=product_data.current_price or product_data.price,
        cost_price=product_data.cost_price,
        discount=product_data.discount,
        discount_value=product_data.discount_value,
        famille=product_data.famille,
        ligne=product_data.ligne,
        persona=product_data.persona,
        is_active=product_data.is_active,
        is_new=product_data.is_new,
        is_featured=product_data.is_featured,
        first_image_url=product_data.first_image_url,
        second_image_url=product_data.second_image_url,
        meta_title=product_data.meta_title,
        meta_description=product_data.meta_description,
        meta_keywords=product_data.meta_keywords,
        composition=product_data.composition
    )

    db.add(product)
    db.flush()  # Get the ID

    # Add categories
    if product_data.category_ids:
        categories = db.query(Category).filter(
            Category.id.in_(product_data.category_ids)
        ).all()
        product.categories = categories

    # Add variants
    if product_data.variants:
        for variant_data in product_data.variants:
            variant = ProductVariant(
                product_id=product.id,
                color=variant_data.color,
                color_code=variant_data.color_code,
                texture_url=variant_data.texture_url,
                size=variant_data.size,
                ean13=variant_data.ean13,
                quantity=variant_data.quantity,
                price_adjustment=variant_data.price_adjustment
            )
            db.add(variant)

    db.commit()
    db.refresh(product)

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="create_product",
        resource_type="product",
        resource_id=product.id,
        resource_reference=product.sku,
        new_values={"title": product.title, "sku": product.sku},
        ip_address=request.client.host if request.client else None
    )

    return product.to_dict()


@router.put("/{product_id}")
async def update_product(
    product_id: int,
    product_data: ProductUpdate,
    request: Request,
    payload: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """Update a product"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    old_values = {}
    new_values = {}

    for field, value in product_data.dict(exclude_unset=True).items():
        if field == "category_ids":
            if value is not None:
                categories = db.query(Category).filter(Category.id.in_(value)).all()
                product.categories = categories
        elif hasattr(product, field):
            old_values[field] = getattr(product, field)
            setattr(product, field, value)
            new_values[field] = value

    product.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(product)

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="update_product",
        resource_type="product",
        resource_id=product.id,
        resource_reference=product.sku,
        old_values=old_values,
        new_values=new_values,
        ip_address=request.client.host if request.client else None
    )

    return product.to_dict()


@router.delete("/{product_id}")
async def delete_product(
    product_id: int,
    request: Request,
    payload: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """Delete (archive) a product"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Soft delete - just deactivate
    product.is_active = False
    product.updated_at = datetime.utcnow()
    db.commit()

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="delete_product",
        resource_type="product",
        resource_id=product.id,
        resource_reference=product.sku,
        description=f"Product {product.sku} deactivated",
        ip_address=request.client.host if request.client else None
    )

    return {"message": "Product archived successfully"}


@router.put("/{product_id}/variants/{variant_id}")
async def update_variant(
    product_id: int,
    variant_id: int,
    quantity: Optional[int] = None,
    is_active: Optional[bool] = None,
    _: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """Update product variant"""
    variant = db.query(ProductVariant).filter(
        ProductVariant.id == variant_id,
        ProductVariant.product_id == product_id
    ).first()

    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    if quantity is not None:
        variant.quantity = quantity
    if is_active is not None:
        variant.is_active = is_active

    variant.updated_at = datetime.utcnow()
    db.commit()

    # Update product total stock
    product = variant.product
    if product:
        total_stock = sum(v.quantity for v in product.variants if v.is_active)
        product.total_stock = total_stock
        db.commit()

    return variant.to_dict()


# Category endpoints
@router.get("/categories/list")
async def list_categories(
    _: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """List all categories"""
    categories = db.query(Category).order_by(Category.position).all()
    return [cat.to_dict() for cat in categories]


@router.post("/categories")
async def create_category(
    category_data: CategoryCreate,
    request: Request,
    payload: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """Create a new category"""
    slug = category_data.slug or generate_slug(category_data.name)

    # Ensure slug uniqueness
    base_slug = slug
    counter = 1
    while db.query(Category).filter(Category.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    category = Category(
        name=category_data.name,
        slug=slug,
        description=category_data.description,
        parent_id=category_data.parent_id,
        image_url=category_data.image_url,
        banner_url=category_data.banner_url,
        position=category_data.position,
        is_active=category_data.is_active,
        is_featured=category_data.is_featured,
        meta_title=category_data.meta_title,
        meta_description=category_data.meta_description
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="create_category",
        resource_type="category",
        resource_id=category.id,
        resource_reference=category.slug,
        ip_address=request.client.host if request.client else None
    )

    return category.to_dict()


@router.put("/categories/{category_id}")
async def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    _: dict = Depends(require_catalog_manager),
    db: Session = Depends(get_db)
):
    """Update a category"""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    for field, value in category_data.dict(exclude_unset=True).items():
        if hasattr(category, field):
            setattr(category, field, value)

    category.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(category)

    return category.to_dict()
