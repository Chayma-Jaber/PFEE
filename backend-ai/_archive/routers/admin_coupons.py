"""
Admin Coupons Router
Coupon and promotion management
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime
from typing import Optional

from app.core.database import get_db
from app.core.security import require_marketing_manager
from app.models.coupon import Coupon, CouponUsage, DiscountType
from app.models.admin_log import log_admin_activity
from app.schemas.coupon import CouponCreate, CouponUpdate, CouponValidate, CouponValidateResponse

router = APIRouter(prefix="/admin/coupons", tags=["Admin Coupons"])


@router.get("")
async def list_coupons(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    discount_type: Optional[str] = None,
    _: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """List coupons with filters and pagination"""
    query = db.query(Coupon)

    if search:
        query = query.filter(
            or_(
                Coupon.code.ilike(f"%{search}%"),
                Coupon.name.ilike(f"%{search}%")
            )
        )

    if is_active is not None:
        query = query.filter(Coupon.is_active == is_active)

    if discount_type:
        try:
            dt = DiscountType(discount_type)
            query = query.filter(Coupon.discount_type == dt)
        except ValueError:
            pass

    total = query.count()

    coupons = query.order_by(Coupon.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return {
        "items": [coupon.to_dict() for coupon in coupons],
        "total": total,
        "page": page,
        "perPage": per_page,
        "pages": (total + per_page - 1) // per_page
    }


@router.get("/{coupon_id}")
async def get_coupon(
    coupon_id: int,
    _: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Get coupon details"""
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")

    data = coupon.to_dict()

    # Add usage statistics
    data["usages"] = [u.to_dict() for u in coupon.usages[:10]]
    data["totalUsageAmount"] = sum(u.discount_amount for u in coupon.usages)

    return data


@router.post("")
async def create_coupon(
    coupon_data: CouponCreate,
    request: Request,
    payload: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Create a new coupon"""
    # Check code uniqueness
    existing = db.query(Coupon).filter(Coupon.code == coupon_data.code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")

    try:
        discount_type = DiscountType(coupon_data.discount_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid discount type")

    coupon = Coupon(
        code=coupon_data.code.upper(),
        name=coupon_data.name,
        description=coupon_data.description,
        discount_type=discount_type,
        discount_value=coupon_data.discount_value,
        minimum_order_amount=coupon_data.minimum_order_amount,
        maximum_discount_amount=coupon_data.maximum_discount_amount,
        usage_limit=coupon_data.usage_limit,
        usage_limit_per_user=coupon_data.usage_limit_per_user,
        starts_at=coupon_data.starts_at,
        expires_at=coupon_data.expires_at,
        is_active=coupon_data.is_active,
        first_order_only=coupon_data.first_order_only,
        new_customers_only=coupon_data.new_customers_only,
        created_by=int(payload.get("sub"))
    )

    if coupon_data.applicable_category_ids:
        import json
        coupon.applicable_category_ids = json.dumps(coupon_data.applicable_category_ids)

    if coupon_data.applicable_product_ids:
        import json
        coupon.applicable_product_ids = json.dumps(coupon_data.applicable_product_ids)

    if coupon_data.excluded_product_ids:
        import json
        coupon.excluded_product_ids = json.dumps(coupon_data.excluded_product_ids)

    db.add(coupon)
    db.commit()
    db.refresh(coupon)

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="create_coupon",
        resource_type="coupon",
        resource_id=coupon.id,
        resource_reference=coupon.code,
        new_values={"code": coupon.code, "discountType": coupon.discount_type.value},
        ip_address=request.client.host if request.client else None
    )

    return coupon.to_dict()


@router.put("/{coupon_id}")
async def update_coupon(
    coupon_id: int,
    coupon_data: CouponUpdate,
    request: Request,
    payload: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Update a coupon"""
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")

    old_values = {}
    new_values = {}

    for field, value in coupon_data.dict(exclude_unset=True).items():
        if field == "discount_type" and value:
            try:
                value = DiscountType(value)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid discount type")

        if hasattr(coupon, field):
            old_values[field] = getattr(coupon, field)
            if hasattr(old_values[field], 'value'):
                old_values[field] = old_values[field].value
            setattr(coupon, field, value)
            new_values[field] = value if not hasattr(value, 'value') else value.value

    coupon.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(coupon)

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="update_coupon",
        resource_type="coupon",
        resource_id=coupon.id,
        resource_reference=coupon.code,
        old_values=old_values,
        new_values=new_values,
        ip_address=request.client.host if request.client else None
    )

    return coupon.to_dict()


@router.delete("/{coupon_id}")
async def delete_coupon(
    coupon_id: int,
    request: Request,
    payload: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Deactivate a coupon"""
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")

    coupon.is_active = False
    coupon.updated_at = datetime.utcnow()
    db.commit()

    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="delete_coupon",
        resource_type="coupon",
        resource_id=coupon.id,
        resource_reference=coupon.code,
        ip_address=request.client.host if request.client else None
    )

    return {"message": "Coupon deactivated successfully"}


@router.post("/validate")
async def validate_coupon(
    validation: CouponValidate,
    db: Session = Depends(get_db)
):
    """Validate a coupon code"""
    coupon = db.query(Coupon).filter(Coupon.code == validation.code.upper()).first()

    if not coupon:
        return CouponValidateResponse(
            is_valid=False,
            message="Code promo invalide"
        )

    if not coupon.is_valid:
        if not coupon.is_active:
            return CouponValidateResponse(is_valid=False, message="Ce code promo n'est plus actif")
        if coupon.expires_at and datetime.utcnow() > coupon.expires_at:
            return CouponValidateResponse(is_valid=False, message="Ce code promo a expiré")
        if coupon.starts_at and datetime.utcnow() < coupon.starts_at:
            return CouponValidateResponse(is_valid=False, message="Ce code promo n'est pas encore valide")
        if coupon.usage_limit and coupon.usage_count >= coupon.usage_limit:
            return CouponValidateResponse(is_valid=False, message="Ce code promo a atteint sa limite d'utilisation")

    # Check minimum order amount
    if coupon.minimum_order_amount and validation.cart_total < coupon.minimum_order_amount:
        return CouponValidateResponse(
            is_valid=False,
            message=f"Minimum de commande requis: {coupon.minimum_order_amount} TND"
        )

    # Check user usage limit
    if validation.user_id and coupon.usage_limit_per_user:
        user_usage_count = db.query(CouponUsage).filter(
            CouponUsage.coupon_id == coupon.id,
            CouponUsage.user_id == validation.user_id
        ).count()

        if user_usage_count >= coupon.usage_limit_per_user:
            return CouponValidateResponse(
                is_valid=False,
                message="Vous avez déjà utilisé ce code promo"
            )

    # Calculate discount
    if coupon.discount_type == DiscountType.PERCENTAGE:
        discount = validation.cart_total * (coupon.discount_value / 100)
        if coupon.maximum_discount_amount:
            discount = min(discount, coupon.maximum_discount_amount)
    elif coupon.discount_type == DiscountType.FIXED_AMOUNT:
        discount = min(coupon.discount_value, validation.cart_total)
    else:  # FREE_SHIPPING
        discount = 0  # Shipping discount handled separately

    return CouponValidateResponse(
        is_valid=True,
        discount_amount=round(discount, 3),
        message="Code promo appliqué avec succès",
        coupon=coupon.to_dict()
    )


@router.get("/{coupon_id}/usage")
async def get_coupon_usage(
    coupon_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Get coupon usage history"""
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")

    query = db.query(CouponUsage).filter(CouponUsage.coupon_id == coupon_id)
    total = query.count()

    usages = query.order_by(CouponUsage.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return {
        "items": [u.to_dict() for u in usages],
        "total": total,
        "page": page,
        "perPage": per_page,
        "pages": (total + per_page - 1) // per_page
    }
