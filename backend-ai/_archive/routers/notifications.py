"""
Notifications Router
User notifications management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.models.notification import Notification, NotificationType, NotificationPriority
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ========================
# User Endpoints
# ========================

@router.get("")
def get_notifications(
    unread_only: bool = False,
    type_filter: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's notifications"""
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_archived == False
    )

    # Filter by unread
    if unread_only:
        query = query.filter(Notification.is_read == False)

    # Filter by type
    if type_filter:
        try:
            notif_type = NotificationType(type_filter)
            query = query.filter(Notification.type == notif_type)
        except ValueError:
            pass

    # Count total and unread
    total = query.count()
    unread_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
        Notification.is_archived == False
    ).count()

    # Get paginated results
    notifications = query.order_by(desc(Notification.created_at))\
        .offset((page - 1) * limit).limit(limit).all()

    return {
        "notifications": [n.to_dict() for n in notifications],
        "unreadCount": unread_count,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }


@router.get("/count")
def get_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get unread notification count"""
    unread_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
        Notification.is_archived == False
    ).count()

    return {"unreadCount": unread_count}


@router.post("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a notification as read"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        db.commit()

    return {"success": True}


@router.post("/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read"""
    now = datetime.utcnow()
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({
        Notification.is_read: True,
        Notification.read_at: now
    })
    db.commit()

    return {"success": True, "message": "All notifications marked as read"}


@router.post("/{notification_id}/archive")
def archive_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Archive a notification"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_archived = True
    db.commit()

    return {"success": True}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a notification"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notification)
    db.commit()

    return {"success": True}


# ========================
# Notification Service Functions
# (Called by other parts of the app)
# ========================

def create_notification(
    db: Session,
    user_id: int,
    type: NotificationType,
    title: str,
    message: str,
    icon: str = None,
    priority: NotificationPriority = NotificationPriority.NORMAL,
    order_id: int = None,
    ticket_id: int = None,
    product_id: int = None,
    action_url: str = None,
    action_label: str = None
) -> Notification:
    """Create a new notification for a user"""
    notification = Notification(
        user_id=user_id,
        type=type,
        priority=priority,
        title=title,
        message=message,
        icon=icon,
        order_id=order_id,
        ticket_id=ticket_id,
        product_id=product_id,
        action_url=action_url,
        action_label=action_label
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def create_order_notification(
    db: Session,
    user_id: int,
    order_id: int,
    order_ref: str,
    status: str
) -> Notification:
    """Create notification for order status change"""
    notification = Notification.create_order_notification(
        user_id=user_id,
        order_id=order_id,
        order_ref=order_ref,
        status=status
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def create_support_notification(
    db: Session,
    user_id: int,
    ticket_id: int,
    ticket_ref: str,
    notification_type: str = "reply"
) -> Notification:
    """Create notification for support ticket update"""
    notification = Notification.create_support_notification(
        user_id=user_id,
        ticket_id=ticket_id,
        ticket_ref=ticket_ref,
        notification_type=notification_type
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def create_promotion_notification(
    db: Session,
    user_ids: List[int],
    title: str,
    message: str,
    action_url: str = None
) -> List[Notification]:
    """Create promotional notification for multiple users"""
    notifications = []
    for user_id in user_ids:
        notification = Notification(
            user_id=user_id,
            type=NotificationType.PROMOTION,
            priority=NotificationPriority.LOW,
            title=title,
            message=message,
            icon="local_offer",
            action_url=action_url,
            action_label="D\u00e9couvrir"
        )
        db.add(notification)
        notifications.append(notification)
    db.commit()
    return notifications
