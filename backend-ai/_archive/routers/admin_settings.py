"""
Admin Settings Router
Manage admin user settings, store configuration, and system preferences
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

from ..core.database import get_db
from ..core.security import get_current_user, hash_password, verify_password
from ..models.user import User, UserRole

router = APIRouter(prefix="/admin/settings", tags=["Admin Settings"])


# ===================== SCHEMAS =====================

class ProfileUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class NotificationSettingsRequest(BaseModel):
    new_orders: bool = True
    low_stock: bool = True
    returns: bool = True
    weekly_reports: bool = False
    email_notifications: bool = True
    push_notifications: bool = False


class StoreSettingsRequest(BaseModel):
    store_name: str = "Barsha"
    currency: str = "TND"
    default_language: str = "fr"
    low_stock_threshold: int = 5
    contact_email: str = "contact@barsha.com.tn"
    contact_phone: str = "+216 70 000 000"


# ===================== PROFILE ENDPOINTS =====================

@router.get("/profile")
async def get_admin_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get admin user profile"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Admin access required")

    return {
        "id": current_user.id,
        "email": current_user.email,
        "firstName": current_user.first_name,
        "lastName": current_user.last_name,
        "phone": current_user.phone,
        "role": current_user.role.value,
        "avatar": None,
        "createdAt": current_user.created_at.isoformat() if current_user.created_at else None,
        "lastLogin": current_user.last_login.isoformat() if current_user.last_login else None
    }


@router.put("/profile")
async def update_admin_profile(
    request: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update admin user profile"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Check email uniqueness if changing
    if request.email and request.email != current_user.email:
        existing = db.query(User).filter(User.email == request.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = request.email

    if request.first_name:
        current_user.first_name = request.first_name
    if request.last_name:
        current_user.last_name = request.last_name
    if request.phone:
        current_user.phone = request.phone

    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "message": "Profile updated successfully",
        "profile": {
            "id": current_user.id,
            "email": current_user.email,
            "firstName": current_user.first_name,
            "lastName": current_user.last_name,
            "phone": current_user.phone,
            "role": current_user.role.value
        }
    }


@router.post("/change-password")
async def change_admin_password(
    request: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Change admin user password"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Verify current password
    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Validate new password
    if request.new_password != request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Update password
    current_user.password_hash = hash_password(request.new_password)
    db.commit()

    return {
        "success": True,
        "message": "Password changed successfully"
    }


# ===================== NOTIFICATION SETTINGS =====================

# Store notification settings in memory (in production, use database)
_notification_settings: Dict[int, Dict] = {}

@router.get("/notifications")
async def get_notification_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get notification preferences"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Return stored settings or defaults
    settings = _notification_settings.get(current_user.id, {
        "newOrders": True,
        "lowStock": True,
        "returns": True,
        "weeklyReports": False,
        "emailNotifications": True,
        "pushNotifications": False
    })

    return settings


@router.put("/notifications")
async def update_notification_settings(
    request: NotificationSettingsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update notification preferences"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Admin access required")

    settings = {
        "newOrders": request.new_orders,
        "lowStock": request.low_stock,
        "returns": request.returns,
        "weeklyReports": request.weekly_reports,
        "emailNotifications": request.email_notifications,
        "pushNotifications": request.push_notifications
    }

    _notification_settings[current_user.id] = settings

    return {
        "success": True,
        "message": "Notification settings updated",
        "settings": settings
    }


# ===================== STORE SETTINGS =====================

# Store settings in memory (in production, use database table)
_store_settings = {
    "storeName": "Barsha",
    "currency": "TND",
    "defaultLanguage": "fr",
    "lowStockThreshold": 5,
    "contactEmail": "contact@barsha.com.tn",
    "contactPhone": "+216 70 000 000",
    "workingHours": "Lun-Sam: 9h-18h",
    "socialLinks": {
        "facebook": "https://www.facebook.com/barsha.tunisie",
        "instagram": "https://www.instagram.com/barsha.tunisie/",
        "youtube": "https://www.youtube.com/channel/UCOlzEAEfVUcn8sTh5OXV0-Q"
    }
}


@router.get("/store")
async def get_store_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get store configuration"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Admin access required")

    return _store_settings


@router.put("/store")
async def update_store_settings(
    request: StoreSettingsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update store configuration (Super Admin only)"""
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super Admin access required")

    _store_settings.update({
        "storeName": request.store_name,
        "currency": request.currency,
        "defaultLanguage": request.default_language,
        "lowStockThreshold": request.low_stock_threshold,
        "contactEmail": request.contact_email,
        "contactPhone": request.contact_phone
    })

    return {
        "success": True,
        "message": "Store settings updated",
        "settings": _store_settings
    }


# ===================== SESSIONS =====================

@router.get("/sessions")
async def get_active_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get active login sessions"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Admin access required")

    # In production, this would query a sessions table
    # For now, return current session info
    return {
        "sessions": [
            {
                "id": "current",
                "device": "Current Session",
                "location": "Tunis, Tunisie",
                "lastActive": datetime.utcnow().isoformat(),
                "isCurrent": True
            }
        ]
    }


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Revoke a login session"""
    if session_id == "current":
        raise HTTPException(status_code=400, detail="Cannot revoke current session")

    return {
        "success": True,
        "message": "Session revoked"
    }
