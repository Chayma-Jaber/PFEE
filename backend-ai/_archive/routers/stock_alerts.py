"""
Stock Alerts Router
Back in Stock notification endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr

from app.core.database import get_db
from app.models.stock_alerts import StockAlert
from app.models.user import User
from app.routers.auth import get_current_user, get_current_user_optional


# ========================
# Pydantic Schemas
# ========================

class CreateStockAlertRequest(BaseModel):
    """Schema for creating a stock alert"""
    product_id: str = Field(..., description="Product ID to track")
    email: Optional[str] = Field(None, description="Email for guest users")
    size: Optional[str] = Field(None, description="Specific size to track")
    color: Optional[str] = Field(None, description="Specific color to track")
    product_name: Optional[str] = Field(None, description="Product name for display")
    product_image: Optional[str] = Field(None, description="Product image URL")
    product_price: Optional[str] = Field(None, description="Product price")

    class Config:
        json_schema_extra = {
            "example": {
                "product_id": "123",
                "email": "user@example.com",
                "size": "M",
                "color": "Noir",
                "product_name": "T-shirt Basic",
                "product_image": "https://example.com/image.jpg",
                "product_price": "49.900 TND"
            }
        }


class StockAlertResponse(BaseModel):
    """Response schema for stock alerts"""
    id: int
    user_id: Optional[int]
    email: Optional[str]
    product_id: str
    size: Optional[str]
    color: Optional[str]
    is_notified: bool
    created_at: Optional[str]
    notified_at: Optional[str]
    product_name: Optional[str]
    product_image: Optional[str]
    product_price: Optional[str]


class CheckAlertResponse(BaseModel):
    """Response for checking if alert exists"""
    has_alert: bool
    alert_id: Optional[int]
    size: Optional[str]
    color: Optional[str]


# ========================
# Router
# ========================

router = APIRouter(prefix="/stock-alerts", tags=["Stock Alerts"])


# ========================
# User Endpoints
# ========================

@router.post("", status_code=status.HTTP_201_CREATED)
def create_stock_alert(
    request: CreateStockAlertRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Create a back-in-stock alert for a product.

    - Logged in users: Alert is linked to their account
    - Guest users: Email is required
    """
    user_id = current_user.id if current_user else None
    email = request.email

    # Validate: either user_id or email must be provided
    if not user_id and not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email requis pour les utilisateurs non connectes"
        )

    # If user is logged in, use their email if not provided
    if user_id and not email and current_user.email:
        email = current_user.email

    # Check for existing active alert
    query = db.query(StockAlert).filter(
        StockAlert.product_id == request.product_id,
        StockAlert.is_notified == False
    )

    if user_id:
        query = query.filter(StockAlert.user_id == user_id)
    else:
        query = query.filter(StockAlert.email == email)

    # Check for same size and color
    if request.size:
        query = query.filter(StockAlert.size == request.size)
    else:
        query = query.filter(StockAlert.size.is_(None))

    if request.color:
        query = query.filter(StockAlert.color == request.color)
    else:
        query = query.filter(StockAlert.color.is_(None))

    existing = query.first()

    if existing:
        # Alert already exists
        return {
            "success": True,
            "message": "Vous etes deja inscrit pour cette alerte",
            "alert": existing.to_dict(),
            "already_subscribed": True
        }

    # Create new alert
    alert = StockAlert.create_alert(
        product_id=request.product_id,
        user_id=user_id,
        email=email,
        size=request.size,
        color=request.color,
        product_name=request.product_name,
        product_image=request.product_image,
        product_price=request.product_price
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    return {
        "success": True,
        "message": "Alerte creee avec succes. Vous serez notifie quand le produit sera disponible.",
        "alert": alert.to_dict(),
        "already_subscribed": False
    }


@router.get("/my-alerts")
def get_my_alerts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    include_notified: bool = Query(False, description="Include already notified alerts"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all stock alerts for the current user"""
    query = db.query(StockAlert).filter(StockAlert.user_id == current_user.id)

    if not include_notified:
        query = query.filter(StockAlert.is_notified == False)

    # Get total count
    total = query.count()

    # Get paginated results
    alerts = query.order_by(desc(StockAlert.created_at))\
        .offset((page - 1) * limit).limit(limit).all()

    # Count stats
    active_count = db.query(StockAlert).filter(
        StockAlert.user_id == current_user.id,
        StockAlert.is_notified == False
    ).count()

    notified_count = db.query(StockAlert).filter(
        StockAlert.user_id == current_user.id,
        StockAlert.is_notified == True
    ).count()

    return {
        "alerts": [alert.to_dict() for alert in alerts],
        "stats": {
            "active": active_count,
            "notified": notified_count,
            "total": active_count + notified_count
        },
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }


@router.delete("/{alert_id}")
def delete_stock_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a stock alert"""
    alert = db.query(StockAlert).filter(
        StockAlert.id == alert_id,
        StockAlert.user_id == current_user.id
    ).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alerte non trouvee"
        )

    db.delete(alert)
    db.commit()

    return {
        "success": True,
        "message": "Alerte supprimee avec succes"
    }


@router.post("/check/{product_id}")
def check_user_alert(
    product_id: str,
    size: Optional[str] = Query(None),
    color: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Check if user has an active alert for a specific product"""
    query = db.query(StockAlert).filter(
        StockAlert.product_id == product_id,
        StockAlert.is_notified == False
    )

    if current_user:
        query = query.filter(StockAlert.user_id == current_user.id)
    elif email:
        query = query.filter(StockAlert.email == email)
    else:
        return {
            "has_alert": False,
            "alert_id": None,
            "size": None,
            "color": None
        }

    # Check for specific size/color
    if size:
        query = query.filter(StockAlert.size == size)
    if color:
        query = query.filter(StockAlert.color == color)

    alert = query.first()

    if alert:
        return {
            "has_alert": True,
            "alert_id": alert.id,
            "size": alert.size,
            "color": alert.color
        }

    return {
        "has_alert": False,
        "alert_id": None,
        "size": None,
        "color": None
    }


@router.get("/product/{product_id}/count")
def get_product_alert_count(
    product_id: str,
    db: Session = Depends(get_db)
):
    """Get the number of users waiting for a product (admin use)"""
    count = db.query(StockAlert).filter(
        StockAlert.product_id == product_id,
        StockAlert.is_notified == False
    ).count()

    return {
        "product_id": product_id,
        "waiting_count": count
    }


@router.delete("/unsubscribe")
def unsubscribe_by_email(
    product_id: str = Query(...),
    email: str = Query(...),
    db: Session = Depends(get_db)
):
    """Unsubscribe from alert using email (for email unsubscribe links)"""
    alert = db.query(StockAlert).filter(
        StockAlert.product_id == product_id,
        StockAlert.email == email,
        StockAlert.is_notified == False
    ).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alerte non trouvee"
        )

    db.delete(alert)
    db.commit()

    return {
        "success": True,
        "message": "Vous avez ete desabonne de cette alerte"
    }
