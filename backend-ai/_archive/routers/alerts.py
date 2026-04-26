"""
Product Alerts Router
Price drop and back-in-stock alert management
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import verify_admin_access
from app.models.product_alert import ProductAlert, AlertType, AlertHistory
from app.models.product import Product, ProductVariant
from app.models.notification import Notification, NotificationType, NotificationPriority
from app.models.user import User
from app.routers.auth import get_current_user


# ========================
# Pydantic Schemas
# ========================

class PriceDropAlertCreate(BaseModel):
    """Schema for creating a price drop alert"""
    product_id: int = Field(..., description="Product ID to track")
    target_price: float = Field(..., gt=0, description="Target price to trigger alert")
    note: Optional[str] = Field(None, max_length=500, description="Optional note")

    class Config:
        json_schema_extra = {
            "example": {
                "product_id": 123,
                "target_price": 49.99,
                "note": "Want to buy when price drops"
            }
        }


class BackInStockAlertCreate(BaseModel):
    """Schema for creating a back-in-stock alert"""
    product_id: int = Field(..., description="Product ID to track")
    variant_id: Optional[int] = Field(None, description="Specific variant ID (optional)")
    note: Optional[str] = Field(None, max_length=500, description="Optional note")

    class Config:
        json_schema_extra = {
            "example": {
                "product_id": 123,
                "variant_id": 456,
                "note": "Need size M in blue"
            }
        }


class AlertResponse(BaseModel):
    """Response schema for alerts"""
    id: int
    userId: int
    productId: int
    alertType: str
    targetPrice: Optional[float]
    originalPrice: Optional[float]
    variantId: Optional[int]
    isActive: bool
    notificationSent: bool
    triggeredAt: Optional[str]
    createdAt: str
    product: Optional[dict]


class TriggerAlertsRequest(BaseModel):
    """Schema for manually triggering alerts (admin)"""
    alert_type: Optional[str] = Field(None, description="Filter by alert type (price_drop or back_in_stock)")
    product_id: Optional[int] = Field(None, description="Filter by specific product")
    dry_run: bool = Field(True, description="If true, only simulate without sending notifications")


# ========================
# Router
# ========================

router = APIRouter(prefix="/alerts", tags=["Product Alerts"])
admin_router = APIRouter(prefix="/admin/alerts", tags=["Admin Alerts"])


# ========================
# User Endpoints
# ========================

@router.post("/price-drop", status_code=status.HTTP_201_CREATED)
def create_price_drop_alert(
    request: PriceDropAlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Subscribe to price drop alert for a product.
    You will be notified when the price drops below your target price.
    """
    # Verify product exists
    product = db.query(Product).filter(Product.id == request.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    # Check if target price is lower than current price
    current_price = product.current_price or product.price
    if request.target_price >= current_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target price ({request.target_price}) must be lower than current price ({current_price})"
        )

    # Check for existing active alert for same product
    existing = db.query(ProductAlert).filter(
        ProductAlert.user_id == current_user.id,
        ProductAlert.product_id == request.product_id,
        ProductAlert.alert_type == AlertType.PRICE_DROP,
        ProductAlert.is_active == True
    ).first()

    if existing:
        # Update existing alert with new target price
        existing.target_price = request.target_price
        existing.original_price = current_price
        existing.note = request.note
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return {
            "success": True,
            "message": "Price drop alert updated",
            "alert": existing.to_dict()
        }

    # Create new alert
    alert = ProductAlert.create_price_drop_alert(
        user_id=current_user.id,
        product_id=request.product_id,
        target_price=request.target_price,
        original_price=current_price,
        note=request.note
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    return {
        "success": True,
        "message": "Price drop alert created",
        "alert": alert.to_dict()
    }


@router.post("/back-in-stock", status_code=status.HTTP_201_CREATED)
def create_back_in_stock_alert(
    request: BackInStockAlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Subscribe to back-in-stock alert for a product.
    You will be notified when the product (or specific variant) is back in stock.
    """
    # Verify product exists
    product = db.query(Product).filter(Product.id == request.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    # Verify variant if specified
    if request.variant_id:
        variant = db.query(ProductVariant).filter(
            ProductVariant.id == request.variant_id,
            ProductVariant.product_id == request.product_id
        ).first()
        if not variant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Variant not found for this product"
            )
        # Check if already in stock
        if variant.quantity > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This variant is already in stock"
            )
    else:
        # Check if product is already in stock
        if product.total_stock > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This product is already in stock"
            )

    # Check for existing active alert
    query = db.query(ProductAlert).filter(
        ProductAlert.user_id == current_user.id,
        ProductAlert.product_id == request.product_id,
        ProductAlert.alert_type == AlertType.BACK_IN_STOCK,
        ProductAlert.is_active == True
    )
    if request.variant_id:
        query = query.filter(ProductAlert.variant_id == request.variant_id)
    else:
        query = query.filter(ProductAlert.variant_id.is_(None))

    existing = query.first()

    if existing:
        # Update existing alert
        existing.note = request.note
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return {
            "success": True,
            "message": "Back-in-stock alert updated",
            "alert": existing.to_dict()
        }

    # Create new alert
    alert = ProductAlert.create_back_in_stock_alert(
        user_id=current_user.id,
        product_id=request.product_id,
        variant_id=request.variant_id,
        note=request.note
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    return {
        "success": True,
        "message": "Back-in-stock alert created",
        "alert": alert.to_dict()
    }


@router.get("/my-alerts")
def get_my_alerts(
    alert_type: Optional[str] = Query(None, description="Filter by type: price_drop or back_in_stock"),
    active_only: bool = Query(True, description="Only show active alerts"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all alerts for the current user"""
    query = db.query(ProductAlert).filter(ProductAlert.user_id == current_user.id)

    # Filter by active status
    if active_only:
        query = query.filter(ProductAlert.is_active == True)

    # Filter by alert type
    if alert_type:
        try:
            type_enum = AlertType(alert_type)
            query = query.filter(ProductAlert.alert_type == type_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid alert type: {alert_type}. Must be 'price_drop' or 'back_in_stock'"
            )

    # Get total count
    total = query.count()

    # Get paginated results
    alerts = query.order_by(desc(ProductAlert.created_at))\
        .offset((page - 1) * limit).limit(limit).all()

    # Count by type
    price_drop_count = db.query(ProductAlert).filter(
        ProductAlert.user_id == current_user.id,
        ProductAlert.alert_type == AlertType.PRICE_DROP,
        ProductAlert.is_active == True
    ).count()

    back_in_stock_count = db.query(ProductAlert).filter(
        ProductAlert.user_id == current_user.id,
        ProductAlert.alert_type == AlertType.BACK_IN_STOCK,
        ProductAlert.is_active == True
    ).count()

    return {
        "alerts": [alert.to_dict() for alert in alerts],
        "counts": {
            "priceDropAlerts": price_drop_count,
            "backInStockAlerts": back_in_stock_count,
            "totalActive": price_drop_count + back_in_stock_count
        },
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }


@router.get("/product/{product_id}")
def get_alerts_for_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's alerts for a specific product"""
    alerts = db.query(ProductAlert).filter(
        ProductAlert.user_id == current_user.id,
        ProductAlert.product_id == product_id,
        ProductAlert.is_active == True
    ).all()

    return {
        "alerts": [alert.to_dict_minimal() for alert in alerts],
        "hasPriceDropAlert": any(a.alert_type == AlertType.PRICE_DROP for a in alerts),
        "hasBackInStockAlert": any(a.alert_type == AlertType.BACK_IN_STOCK for a in alerts)
    }


@router.delete("/{alert_id}")
def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unsubscribe from an alert"""
    alert = db.query(ProductAlert).filter(
        ProductAlert.id == alert_id,
        ProductAlert.user_id == current_user.id
    ).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )

    # Soft delete - deactivate
    alert.is_active = False
    alert.updated_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "message": "Alert deactivated successfully"
    }


@router.delete("/{alert_id}/permanent")
def permanently_delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Permanently delete an alert"""
    alert = db.query(ProductAlert).filter(
        ProductAlert.id == alert_id,
        ProductAlert.user_id == current_user.id
    ).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )

    db.delete(alert)
    db.commit()

    return {
        "success": True,
        "message": "Alert deleted permanently"
    }


# ========================
# Admin Endpoints
# ========================

@admin_router.get("/stats")
def get_alert_stats(
    db: Session = Depends(get_db),
    admin: dict = Depends(verify_admin_access)
):
    """Get alert statistics for admin dashboard"""
    # Active alerts by type
    price_drop_active = db.query(ProductAlert).filter(
        ProductAlert.alert_type == AlertType.PRICE_DROP,
        ProductAlert.is_active == True
    ).count()

    back_in_stock_active = db.query(ProductAlert).filter(
        ProductAlert.alert_type == AlertType.BACK_IN_STOCK,
        ProductAlert.is_active == True
    ).count()

    # Triggered alerts (notifications sent)
    price_drop_triggered = db.query(ProductAlert).filter(
        ProductAlert.alert_type == AlertType.PRICE_DROP,
        ProductAlert.notification_sent == True
    ).count()

    back_in_stock_triggered = db.query(ProductAlert).filter(
        ProductAlert.alert_type == AlertType.BACK_IN_STOCK,
        ProductAlert.notification_sent == True
    ).count()

    # Users with alerts
    users_with_alerts = db.query(ProductAlert.user_id).filter(
        ProductAlert.is_active == True
    ).distinct().count()

    # Products with alerts
    products_with_alerts = db.query(ProductAlert.product_id).filter(
        ProductAlert.is_active == True
    ).distinct().count()

    # Recent history (conversions)
    conversions = db.query(AlertHistory).filter(
        AlertHistory.converted == True
    ).count()

    return {
        "activeAlerts": {
            "priceDrop": price_drop_active,
            "backInStock": back_in_stock_active,
            "total": price_drop_active + back_in_stock_active
        },
        "triggeredAlerts": {
            "priceDrop": price_drop_triggered,
            "backInStock": back_in_stock_triggered,
            "total": price_drop_triggered + back_in_stock_triggered
        },
        "usersWithAlerts": users_with_alerts,
        "productsWithAlerts": products_with_alerts,
        "conversions": conversions
    }


@admin_router.get("/all")
def get_all_alerts(
    alert_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    product_id: Optional[int] = None,
    user_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: dict = Depends(verify_admin_access)
):
    """Get all alerts (admin view)"""
    query = db.query(ProductAlert)

    # Filters
    if alert_type:
        try:
            type_enum = AlertType(alert_type)
            query = query.filter(ProductAlert.alert_type == type_enum)
        except ValueError:
            pass

    if is_active is not None:
        query = query.filter(ProductAlert.is_active == is_active)

    if product_id:
        query = query.filter(ProductAlert.product_id == product_id)

    if user_id:
        query = query.filter(ProductAlert.user_id == user_id)

    total = query.count()

    alerts = query.order_by(desc(ProductAlert.created_at))\
        .offset((page - 1) * limit).limit(limit).all()

    return {
        "alerts": [alert.to_dict() for alert in alerts],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }


@admin_router.post("/trigger")
def trigger_alerts(
    request: TriggerAlertsRequest,
    db: Session = Depends(get_db),
    admin: dict = Depends(verify_admin_access)
):
    """
    Manually trigger alert checks and send notifications.

    This endpoint checks all active alerts and sends notifications for:
    - Price drop alerts: when current price <= target price
    - Back-in-stock alerts: when product/variant has stock > 0
    """
    results = {
        "checked": 0,
        "triggered": 0,
        "notifications_sent": 0,
        "errors": [],
        "dry_run": request.dry_run,
        "triggered_alerts": []
    }

    # Build query
    query = db.query(ProductAlert).filter(
        ProductAlert.is_active == True,
        ProductAlert.notification_sent == False
    )

    if request.alert_type:
        try:
            type_enum = AlertType(request.alert_type)
            query = query.filter(ProductAlert.alert_type == type_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid alert type: {request.alert_type}"
            )

    if request.product_id:
        query = query.filter(ProductAlert.product_id == request.product_id)

    alerts = query.all()
    results["checked"] = len(alerts)

    for alert in alerts:
        try:
            should_trigger = False
            triggered_price = None

            # Check price drop alerts
            if alert.alert_type == AlertType.PRICE_DROP:
                product = db.query(Product).filter(Product.id == alert.product_id).first()
                if product:
                    current_price = product.current_price or product.price
                    if current_price <= alert.target_price:
                        should_trigger = True
                        triggered_price = current_price

            # Check back-in-stock alerts
            elif alert.alert_type == AlertType.BACK_IN_STOCK:
                if alert.variant_id:
                    variant = db.query(ProductVariant).filter(
                        ProductVariant.id == alert.variant_id
                    ).first()
                    if variant and variant.quantity > 0:
                        should_trigger = True
                else:
                    product = db.query(Product).filter(Product.id == alert.product_id).first()
                    if product and product.total_stock > 0:
                        should_trigger = True

            if should_trigger:
                results["triggered"] += 1
                results["triggered_alerts"].append({
                    "alertId": alert.id,
                    "userId": alert.user_id,
                    "productId": alert.product_id,
                    "alertType": alert.alert_type.value,
                    "triggeredPrice": triggered_price
                })

                if not request.dry_run:
                    # Update alert status
                    alert.triggered_at = datetime.utcnow()
                    alert.triggered_price = triggered_price
                    alert.notification_sent = True
                    alert.notification_sent_at = datetime.utcnow()
                    alert.is_active = False  # Deactivate after triggering

                    # Create notification
                    product = db.query(Product).filter(Product.id == alert.product_id).first()
                    if product:
                        if alert.alert_type == AlertType.PRICE_DROP:
                            notification = Notification(
                                user_id=alert.user_id,
                                type=NotificationType.PRICE_DROP,
                                priority=NotificationPriority.NORMAL,
                                title="Baisse de prix !",
                                message=f"Le prix de {product.title} est maintenant de {triggered_price} TND !",
                                icon="local_offer",
                                product_id=alert.product_id,
                                action_url=f"/produit/{product.slug}",
                                action_label="Voir le produit"
                            )
                        else:
                            notification = Notification(
                                user_id=alert.user_id,
                                type=NotificationType.BACK_IN_STOCK,
                                priority=NotificationPriority.NORMAL,
                                title="Retour en stock !",
                                message=f"{product.title} est de nouveau disponible !",
                                icon="inventory_2",
                                product_id=alert.product_id,
                                action_url=f"/produit/{product.slug}",
                                action_label="Voir le produit"
                            )
                        db.add(notification)
                        results["notifications_sent"] += 1

                        # Create history record
                        history = AlertHistory(
                            alert_id=alert.id,
                            user_id=alert.user_id,
                            product_id=alert.product_id,
                            alert_type=alert.alert_type,
                            target_price=alert.target_price,
                            triggered_price=triggered_price,
                            notification_channel="in_app"
                        )
                        db.add(history)

        except Exception as e:
            results["errors"].append({
                "alertId": alert.id,
                "error": str(e)
            })

    if not request.dry_run:
        db.commit()

    return results


@admin_router.delete("/{alert_id}")
def admin_delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(verify_admin_access)
):
    """Admin: Delete any alert"""
    alert = db.query(ProductAlert).filter(ProductAlert.id == alert_id).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )

    db.delete(alert)
    db.commit()

    return {
        "success": True,
        "message": f"Alert {alert_id} deleted"
    }


@admin_router.post("/product/{product_id}/notify-watchers")
def notify_product_watchers(
    product_id: int,
    message: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: dict = Depends(verify_admin_access)
):
    """Send a custom notification to all users watching a product"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    # Get all active alerts for this product
    alerts = db.query(ProductAlert).filter(
        ProductAlert.product_id == product_id,
        ProductAlert.is_active == True
    ).all()

    if not alerts:
        return {
            "success": True,
            "notified": 0,
            "message": "No active alerts for this product"
        }

    notified_users = set()
    for alert in alerts:
        if alert.user_id not in notified_users:
            notification = Notification(
                user_id=alert.user_id,
                type=NotificationType.SYSTEM,
                priority=NotificationPriority.NORMAL,
                title=f"Mise a jour: {product.title}",
                message=message or f"Une mise a jour est disponible pour {product.title}",
                icon="notifications",
                product_id=product_id,
                action_url=f"/produit/{product.slug}",
                action_label="Voir le produit"
            )
            db.add(notification)
            notified_users.add(alert.user_id)

    db.commit()

    return {
        "success": True,
        "notified": len(notified_users),
        "message": f"Notification sent to {len(notified_users)} users"
    }


@admin_router.get("/history")
def get_alert_history(
    alert_type: Optional[str] = None,
    converted_only: bool = False,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: dict = Depends(verify_admin_access)
):
    """Get alert history for analytics"""
    query = db.query(AlertHistory)

    if alert_type:
        try:
            type_enum = AlertType(alert_type)
            query = query.filter(AlertHistory.alert_type == type_enum)
        except ValueError:
            pass

    if converted_only:
        query = query.filter(AlertHistory.converted == True)

    total = query.count()

    history = query.order_by(desc(AlertHistory.created_at))\
        .offset((page - 1) * limit).limit(limit).all()

    return {
        "history": [h.to_dict() for h in history],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }
