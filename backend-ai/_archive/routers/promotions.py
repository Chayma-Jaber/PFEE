"""
Promotions Router
Flash Sales and Promo Codes API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.promotions import FlashSale, PromoCode, PromoCodeUsage, DiscountType, flash_sale_products
from app.models.product import Product
from app.models.user import User
from app.routers.auth import get_current_user_optional, get_current_admin

router = APIRouter(prefix="/promotions", tags=["Promotions"])
admin_router = APIRouter(prefix="/admin/promotions", tags=["Admin Promotions"])


# ========================
# Pydantic Schemas
# ========================

class ValidatePromoCodeRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=50)
    order_total: float = Field(..., gt=0)


class ValidatePromoCodeResponse(BaseModel):
    valid: bool
    code: str
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    discount_amount: Optional[float] = None
    min_purchase: Optional[float] = None
    message: str


class CreateFlashSaleRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    discount_percentage: float = Field(..., gt=0, le=100)
    start_time: datetime
    end_time: datetime
    banner_image: Optional[str] = None
    banner_mobile_image: Optional[str] = None
    background_color: str = "#FF4444"
    text_color: str = "#FFFFFF"
    show_on_homepage: bool = True
    priority: int = 0
    product_ids: List[int] = []


class CreatePromoCodeRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=50)
    discount_type: str = Field(..., pattern="^(percentage|fixed)$")
    discount_value: float = Field(..., gt=0)
    min_purchase: Optional[float] = None
    max_discount: Optional[float] = None
    max_uses: Optional[int] = None
    max_uses_per_user: int = 1
    expires_at: Optional[datetime] = None
    first_order_only: bool = False
    description: Optional[str] = None


# ========================
# Public Endpoints
# ========================

@router.get("/flash-sales")
def get_active_flash_sales(
    include_upcoming: bool = Query(False, description="Include upcoming sales"),
    db: Session = Depends(get_db)
):
    """Get all active flash sales"""
    now = datetime.utcnow()

    query = db.query(FlashSale).filter(FlashSale.is_active == True)

    if include_upcoming:
        # Active or upcoming
        query = query.filter(FlashSale.end_time > now)
    else:
        # Only currently active
        query = query.filter(
            and_(
                FlashSale.start_time <= now,
                FlashSale.end_time > now
            )
        )

    flash_sales = query.order_by(FlashSale.priority.desc(), FlashSale.end_time.asc()).all()

    return {
        "flashSales": [fs.to_dict(include_products=False) for fs in flash_sales],
        "count": len(flash_sales)
    }


@router.get("/flash-sales/homepage")
def get_homepage_flash_sales(
    limit: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db)
):
    """Get flash sales to display on homepage"""
    now = datetime.utcnow()

    flash_sales = db.query(FlashSale).filter(
        FlashSale.is_active == True,
        FlashSale.show_on_homepage == True,
        FlashSale.start_time <= now,
        FlashSale.end_time > now
    ).order_by(FlashSale.priority.desc(), FlashSale.end_time.asc()).limit(limit).all()

    return {
        "flashSales": [fs.to_dict(include_products=True) for fs in flash_sales],
        "count": len(flash_sales)
    }


@router.get("/flash-sales/{flash_sale_id}")
def get_flash_sale(
    flash_sale_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific flash sale with its products"""
    flash_sale = db.query(FlashSale).filter(FlashSale.id == flash_sale_id).first()

    if not flash_sale:
        raise HTTPException(status_code=404, detail="Vente flash introuvable")

    return flash_sale.to_dict(include_products=True)


@router.get("/flash-sales/{flash_sale_id}/products")
def get_flash_sale_products(
    flash_sale_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get products in a flash sale with pagination"""
    flash_sale = db.query(FlashSale).filter(FlashSale.id == flash_sale_id).first()

    if not flash_sale:
        raise HTTPException(status_code=404, detail="Vente flash introuvable")

    # Get products with pagination
    total_products = len(flash_sale.products)
    offset = (page - 1) * limit
    products = flash_sale.products[offset:offset + limit]

    # Add flash sale pricing to products
    products_with_prices = []
    for product in products:
        prod_dict = product.to_dict(include_variants=True)
        original_price = product.price
        sale_price = round(original_price * (1 - flash_sale.discount_percentage / 100), 3)
        prod_dict["flashSalePrice"] = sale_price
        prod_dict["flashSaleDiscount"] = flash_sale.discount_percentage
        prod_dict["flashSaleEndTime"] = flash_sale.end_time.isoformat() if flash_sale.end_time else None
        prod_dict["stockRemaining"] = product.total_stock
        products_with_prices.append(prod_dict)

    return {
        "flashSale": {
            "id": flash_sale.id,
            "name": flash_sale.name,
            "discountPercentage": flash_sale.discount_percentage,
            "endTime": flash_sale.end_time.isoformat() if flash_sale.end_time else None,
            "timeRemainingSeconds": flash_sale.time_remaining_seconds
        },
        "products": products_with_prices,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_products,
            "totalPages": (total_products + limit - 1) // limit
        }
    }


@router.post("/validate-code")
def validate_promo_code(
    request: ValidatePromoCodeRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Validate a promo code and calculate discount"""
    code_upper = request.code.upper().strip()

    promo_code = db.query(PromoCode).filter(
        PromoCode.code == code_upper
    ).first()

    if not promo_code:
        return ValidatePromoCodeResponse(
            valid=False,
            code=code_upper,
            message="Code promo invalide"
        )

    if not promo_code.is_valid:
        if promo_code.expires_at and datetime.utcnow() > promo_code.expires_at:
            return ValidatePromoCodeResponse(
                valid=False,
                code=code_upper,
                message="Ce code promo a expire"
            )
        if promo_code.max_uses and promo_code.current_uses >= promo_code.max_uses:
            return ValidatePromoCodeResponse(
                valid=False,
                code=code_upper,
                message="Ce code promo n'est plus disponible"
            )
        return ValidatePromoCodeResponse(
            valid=False,
            code=code_upper,
            message="Ce code promo n'est pas actif"
        )

    # Check minimum purchase
    if promo_code.min_purchase and request.order_total < promo_code.min_purchase:
        return ValidatePromoCodeResponse(
            valid=False,
            code=code_upper,
            min_purchase=promo_code.min_purchase,
            message=f"Achat minimum de {promo_code.min_purchase:.3f} TND requis"
        )

    # Check user usage limit
    if current_user and promo_code.max_uses_per_user:
        user_usages = db.query(PromoCodeUsage).filter(
            PromoCodeUsage.promo_code_id == promo_code.id,
            PromoCodeUsage.user_id == current_user.id
        ).count()

        if user_usages >= promo_code.max_uses_per_user:
            return ValidatePromoCodeResponse(
                valid=False,
                code=code_upper,
                message="Vous avez deja utilise ce code promo"
            )

    # Check first order only restriction
    if promo_code.first_order_only and current_user:
        from app.models.order import Order
        has_orders = db.query(Order).filter(
            Order.user_id == current_user.id
        ).count() > 0

        if has_orders:
            return ValidatePromoCodeResponse(
                valid=False,
                code=code_upper,
                message="Ce code est reserve aux nouvelles commandes"
            )

    # Calculate discount
    discount_amount = promo_code.calculate_discount(request.order_total)

    return ValidatePromoCodeResponse(
        valid=True,
        code=code_upper,
        discount_type=promo_code.discount_type.value,
        discount_value=promo_code.discount_value,
        discount_amount=discount_amount,
        min_purchase=promo_code.min_purchase,
        message=f"Code promo applique: -{discount_amount:.3f} TND"
    )


@router.get("/codes/{code}")
def get_promo_code_info(
    code: str,
    db: Session = Depends(get_db)
):
    """Get public info about a promo code"""
    code_upper = code.upper().strip()

    promo_code = db.query(PromoCode).filter(
        PromoCode.code == code_upper,
        PromoCode.is_active == True
    ).first()

    if not promo_code or not promo_code.is_valid:
        raise HTTPException(status_code=404, detail="Code promo invalide ou expire")

    return {
        "code": promo_code.code,
        "discountType": promo_code.discount_type.value,
        "discountValue": promo_code.discount_value,
        "minPurchase": promo_code.min_purchase,
        "maxDiscount": promo_code.max_discount,
        "expiresAt": promo_code.expires_at.isoformat() if promo_code.expires_at else None,
        "description": promo_code.description,
        "isValid": promo_code.is_valid
    }


# ========================
# Admin Endpoints
# ========================

@admin_router.get("/flash-sales")
def admin_get_all_flash_sales(
    include_inactive: bool = Query(True),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get all flash sales (admin)"""
    query = db.query(FlashSale)

    if not include_inactive:
        query = query.filter(FlashSale.is_active == True)

    flash_sales = query.order_by(FlashSale.created_at.desc()).all()

    return {
        "flashSales": [fs.to_dict(include_products=True) for fs in flash_sales],
        "count": len(flash_sales)
    }


@admin_router.post("/flash-sales")
def admin_create_flash_sale(
    request: CreateFlashSaleRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Create a new flash sale"""
    if request.end_time <= request.start_time:
        raise HTTPException(status_code=400, detail="La date de fin doit etre apres la date de debut")

    flash_sale = FlashSale(
        name=request.name,
        description=request.description,
        discount_percentage=request.discount_percentage,
        start_time=request.start_time,
        end_time=request.end_time,
        banner_image=request.banner_image,
        banner_mobile_image=request.banner_mobile_image,
        background_color=request.background_color,
        text_color=request.text_color,
        show_on_homepage=request.show_on_homepage,
        priority=request.priority
    )

    # Add products
    if request.product_ids:
        products = db.query(Product).filter(Product.id.in_(request.product_ids)).all()
        flash_sale.products = products

    db.add(flash_sale)
    db.commit()
    db.refresh(flash_sale)

    return {"success": True, "flashSale": flash_sale.to_dict(include_products=True)}


@admin_router.put("/flash-sales/{flash_sale_id}")
def admin_update_flash_sale(
    flash_sale_id: int,
    request: CreateFlashSaleRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Update a flash sale"""
    flash_sale = db.query(FlashSale).filter(FlashSale.id == flash_sale_id).first()

    if not flash_sale:
        raise HTTPException(status_code=404, detail="Vente flash introuvable")

    if request.end_time <= request.start_time:
        raise HTTPException(status_code=400, detail="La date de fin doit etre apres la date de debut")

    flash_sale.name = request.name
    flash_sale.description = request.description
    flash_sale.discount_percentage = request.discount_percentage
    flash_sale.start_time = request.start_time
    flash_sale.end_time = request.end_time
    flash_sale.banner_image = request.banner_image
    flash_sale.banner_mobile_image = request.banner_mobile_image
    flash_sale.background_color = request.background_color
    flash_sale.text_color = request.text_color
    flash_sale.show_on_homepage = request.show_on_homepage
    flash_sale.priority = request.priority
    flash_sale.updated_at = datetime.utcnow()

    # Update products
    if request.product_ids:
        products = db.query(Product).filter(Product.id.in_(request.product_ids)).all()
        flash_sale.products = products

    db.commit()
    db.refresh(flash_sale)

    return {"success": True, "flashSale": flash_sale.to_dict(include_products=True)}


@admin_router.delete("/flash-sales/{flash_sale_id}")
def admin_delete_flash_sale(
    flash_sale_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Delete a flash sale"""
    flash_sale = db.query(FlashSale).filter(FlashSale.id == flash_sale_id).first()

    if not flash_sale:
        raise HTTPException(status_code=404, detail="Vente flash introuvable")

    db.delete(flash_sale)
    db.commit()

    return {"success": True}


@admin_router.post("/flash-sales/{flash_sale_id}/toggle")
def admin_toggle_flash_sale(
    flash_sale_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Toggle flash sale active status"""
    flash_sale = db.query(FlashSale).filter(FlashSale.id == flash_sale_id).first()

    if not flash_sale:
        raise HTTPException(status_code=404, detail="Vente flash introuvable")

    flash_sale.is_active = not flash_sale.is_active
    db.commit()

    return {"success": True, "isActive": flash_sale.is_active}


@admin_router.post("/flash-sales/{flash_sale_id}/products")
def admin_add_products_to_flash_sale(
    flash_sale_id: int,
    product_ids: List[int],
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Add products to a flash sale"""
    flash_sale = db.query(FlashSale).filter(FlashSale.id == flash_sale_id).first()

    if not flash_sale:
        raise HTTPException(status_code=404, detail="Vente flash introuvable")

    products = db.query(Product).filter(Product.id.in_(product_ids)).all()
    existing_ids = {p.id for p in flash_sale.products}

    for product in products:
        if product.id not in existing_ids:
            flash_sale.products.append(product)

    db.commit()

    return {"success": True, "productCount": len(flash_sale.products)}


@admin_router.delete("/flash-sales/{flash_sale_id}/products/{product_id}")
def admin_remove_product_from_flash_sale(
    flash_sale_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Remove a product from a flash sale"""
    flash_sale = db.query(FlashSale).filter(FlashSale.id == flash_sale_id).first()

    if not flash_sale:
        raise HTTPException(status_code=404, detail="Vente flash introuvable")

    flash_sale.products = [p for p in flash_sale.products if p.id != product_id]
    db.commit()

    return {"success": True, "productCount": len(flash_sale.products)}


# Promo Codes Admin

@admin_router.get("/promo-codes")
def admin_get_all_promo_codes(
    include_inactive: bool = Query(True),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get all promo codes (admin)"""
    query = db.query(PromoCode)

    if not include_inactive:
        query = query.filter(PromoCode.is_active == True)

    promo_codes = query.order_by(PromoCode.created_at.desc()).all()

    return {
        "promoCodes": [pc.to_dict() for pc in promo_codes],
        "count": len(promo_codes)
    }


@admin_router.post("/promo-codes")
def admin_create_promo_code(
    request: CreatePromoCodeRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Create a new promo code"""
    code_upper = request.code.upper().strip()

    # Check if code exists
    existing = db.query(PromoCode).filter(PromoCode.code == code_upper).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ce code promo existe deja")

    promo_code = PromoCode(
        code=code_upper,
        discount_type=DiscountType(request.discount_type),
        discount_value=request.discount_value,
        min_purchase=request.min_purchase,
        max_discount=request.max_discount,
        max_uses=request.max_uses,
        max_uses_per_user=request.max_uses_per_user,
        expires_at=request.expires_at,
        first_order_only=request.first_order_only,
        description=request.description
    )

    db.add(promo_code)
    db.commit()
    db.refresh(promo_code)

    return {"success": True, "promoCode": promo_code.to_dict()}


@admin_router.put("/promo-codes/{promo_code_id}")
def admin_update_promo_code(
    promo_code_id: int,
    request: CreatePromoCodeRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Update a promo code"""
    promo_code = db.query(PromoCode).filter(PromoCode.id == promo_code_id).first()

    if not promo_code:
        raise HTTPException(status_code=404, detail="Code promo introuvable")

    code_upper = request.code.upper().strip()

    # Check code uniqueness
    existing = db.query(PromoCode).filter(
        PromoCode.code == code_upper,
        PromoCode.id != promo_code_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ce code promo existe deja")

    promo_code.code = code_upper
    promo_code.discount_type = DiscountType(request.discount_type)
    promo_code.discount_value = request.discount_value
    promo_code.min_purchase = request.min_purchase
    promo_code.max_discount = request.max_discount
    promo_code.max_uses = request.max_uses
    promo_code.max_uses_per_user = request.max_uses_per_user
    promo_code.expires_at = request.expires_at
    promo_code.first_order_only = request.first_order_only
    promo_code.description = request.description
    promo_code.updated_at = datetime.utcnow()

    db.commit()

    return {"success": True, "promoCode": promo_code.to_dict()}


@admin_router.delete("/promo-codes/{promo_code_id}")
def admin_delete_promo_code(
    promo_code_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Delete a promo code"""
    promo_code = db.query(PromoCode).filter(PromoCode.id == promo_code_id).first()

    if not promo_code:
        raise HTTPException(status_code=404, detail="Code promo introuvable")

    db.delete(promo_code)
    db.commit()

    return {"success": True}


@admin_router.post("/promo-codes/{promo_code_id}/toggle")
def admin_toggle_promo_code(
    promo_code_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Toggle promo code active status"""
    promo_code = db.query(PromoCode).filter(PromoCode.id == promo_code_id).first()

    if not promo_code:
        raise HTTPException(status_code=404, detail="Code promo introuvable")

    promo_code.is_active = not promo_code.is_active
    db.commit()

    return {"success": True, "isActive": promo_code.is_active}


# ========================
# Seed Demo Data
# ========================

def seed_demo_flash_sales(db: Session):
    """Seed demo flash sales for testing"""
    from datetime import timedelta

    if db.query(FlashSale).count() > 0:
        return

    now = datetime.utcnow()

    # Get some products for the flash sale
    products = db.query(Product).filter(Product.is_active == True).limit(12).all()

    # Create active flash sale
    flash_sale_1 = FlashSale(
        name="Vente Flash Week-End",
        description="Profitez de -40% sur une selection de produits!",
        discount_percentage=40,
        start_time=now - timedelta(hours=2),
        end_time=now + timedelta(hours=46),
        banner_image="https://images.unsplash.com/photo-1607083206968-13611e3d76db?w=1200",
        background_color="#FF4444",
        text_color="#FFFFFF",
        show_on_homepage=True,
        priority=10
    )
    flash_sale_1.products = products[:6] if len(products) >= 6 else products

    # Create upcoming flash sale
    flash_sale_2 = FlashSale(
        name="Black Friday",
        description="Le plus grand evenement de l'annee! Jusqu'a -50%",
        discount_percentage=50,
        start_time=now + timedelta(days=3),
        end_time=now + timedelta(days=5),
        banner_image="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200",
        background_color="#000000",
        text_color="#FFD700",
        show_on_homepage=True,
        priority=5
    )
    flash_sale_2.products = products[6:12] if len(products) >= 12 else products[6:]

    db.add_all([flash_sale_1, flash_sale_2])

    # Create demo promo codes
    promo_codes = [
        PromoCode(
            code="WELCOME10",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=10,
            first_order_only=True,
            description="10% de reduction sur votre premiere commande"
        ),
        PromoCode(
            code="SUMMER25",
            discount_type=DiscountType.PERCENTAGE,
            discount_value=25,
            min_purchase=100,
            max_discount=50,
            expires_at=now + timedelta(days=30),
            description="25% de reduction (max 50 TND) pour commandes de 100 TND+"
        ),
        PromoCode(
            code="FLASH20",
            discount_type=DiscountType.FIXED,
            discount_value=20,
            min_purchase=80,
            max_uses=100,
            description="20 TND de reduction pour commandes de 80 TND+"
        )
    ]

    db.add_all(promo_codes)
    db.commit()
