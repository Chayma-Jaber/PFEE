"""
Wishlist Sharing Router
Endpoints for creating and managing shareable wishlist links
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import uuid

from app.core.database import get_db
from app.models.wishlist_share import WishlistShare
from app.models.wishlist import WishlistItem
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/wishlist", tags=["Wishlist Sharing"])


# ========================
# Pydantic Schemas
# ========================

class CreateShareRequest(BaseModel):
    """Request to create a shareable wishlist link"""
    title: Optional[str] = Field(None, max_length=255, description="Custom title for the shared wishlist")
    description: Optional[str] = Field(None, max_length=1000, description="Optional description")
    is_public: bool = Field(True, description="Whether the link is publicly accessible")
    expires_in_days: Optional[int] = Field(None, ge=1, le=365, description="Number of days until link expires (optional)")


class UpdateShareRequest(BaseModel):
    """Request to update share settings"""
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    is_public: Optional[bool] = None
    expires_in_days: Optional[int] = Field(None, ge=1, le=365, description="Set new expiration (days from now)")
    remove_expiration: Optional[bool] = Field(False, description="Remove expiration date")


class ShareResponse(BaseModel):
    """Response containing share details"""
    success: bool
    share: dict
    share_url: str
    message: str


# ========================
# Public Endpoints (No Auth Required)
# ========================

@router.get("/shared/{token}")
def view_shared_wishlist(
    token: str,
    db: Session = Depends(get_db)
):
    """
    View a shared wishlist by its token.
    This endpoint is PUBLIC - no authentication required.
    """
    # Find the share by token
    share = db.query(WishlistShare).filter(
        WishlistShare.share_token == token
    ).first()

    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared wishlist not found or link is invalid"
        )

    # Check if share is accessible
    if not share.is_public:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This wishlist is no longer shared"
        )

    if share.is_expired:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This share link has expired"
        )

    # Increment view count
    share.increment_view_count()
    db.commit()

    # Get wishlist items for the user
    wishlist_items = db.query(WishlistItem).filter(
        WishlistItem.user_id == share.user_id
    ).all()

    return {
        "shareToken": share.share_token,
        "title": share.title or "Ma liste de favoris Barsha",
        "description": share.description,
        "viewCount": share.view_count,
        "createdAt": share.created_at.isoformat() if share.created_at else None,
        "ownerName": share.user.first_name if share.user else "Un utilisateur Barsha",
        "itemCount": len(wishlist_items),
        "wishlistItems": [item.to_dict() for item in wishlist_items]
    }


# ========================
# Authenticated Endpoints
# ========================

@router.post("/share")
def create_share_link(
    request: CreateShareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a shareable link for the current user's wishlist.
    Requires authentication.
    """
    # Check if user has items in wishlist
    wishlist_count = db.query(WishlistItem).filter(
        WishlistItem.user_id == current_user.id
    ).count()

    if wishlist_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your wishlist is empty. Add some items before sharing."
        )

    # Generate unique token
    token = str(uuid.uuid4())
    while db.query(WishlistShare).filter(WishlistShare.share_token == token).first():
        token = str(uuid.uuid4())

    # Calculate expiration date if specified
    expires_at = None
    if request.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=request.expires_in_days)

    # Create share record
    share = WishlistShare(
        user_id=current_user.id,
        share_token=token,
        title=request.title,
        description=request.description,
        is_public=request.is_public,
        expires_at=expires_at
    )
    db.add(share)
    db.commit()
    db.refresh(share)

    # Construct share URL
    share_url = f"https://barsha.com.tn/wishlist/shared/{share.share_token}"

    return {
        "success": True,
        "share": share.to_dict(include_wishlist=True),
        "shareUrl": share_url,
        "message": "Lien de partage cree avec succes!"
    }


@router.get("/my-shares")
def get_my_shares(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    include_expired: bool = Query(False, description="Include expired shares"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all shared wishlist links created by the current user.
    Requires authentication.
    """
    query = db.query(WishlistShare).filter(
        WishlistShare.user_id == current_user.id
    )

    # Optionally filter out expired shares
    if not include_expired:
        now = datetime.utcnow()
        query = query.filter(
            (WishlistShare.expires_at == None) | (WishlistShare.expires_at > now)
        )

    # Get total count
    total = query.count()

    # Get paginated results ordered by creation date
    shares = query.order_by(desc(WishlistShare.created_at))\
        .offset((page - 1) * limit).limit(limit).all()

    return {
        "shares": [
            {
                **share.to_dict(),
                "shareUrl": f"https://barsha.com.tn/wishlist/shared/{share.share_token}"
            }
            for share in shares
        ],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total > 0 else 0
        }
    }


@router.put("/share/{share_id}")
def update_share_settings(
    share_id: int,
    request: UpdateShareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update settings for a shared wishlist link.
    Requires authentication and ownership.
    """
    # Find the share
    share = db.query(WishlistShare).filter(
        WishlistShare.id == share_id,
        WishlistShare.user_id == current_user.id
    ).first()

    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found or you don't have permission to modify it"
        )

    # Apply updates
    if request.title is not None:
        share.title = request.title

    if request.description is not None:
        share.description = request.description

    if request.is_public is not None:
        share.is_public = request.is_public

    if request.remove_expiration:
        share.expires_at = None
    elif request.expires_in_days is not None:
        share.expires_at = datetime.utcnow() + timedelta(days=request.expires_in_days)

    share.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(share)

    return {
        "success": True,
        "share": share.to_dict(),
        "shareUrl": f"https://barsha.com.tn/wishlist/shared/{share.share_token}",
        "message": "Parametres de partage mis a jour"
    }


@router.delete("/share/{share_id}")
def revoke_share_link(
    share_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Revoke (delete) a shared wishlist link.
    Requires authentication and ownership.
    """
    # Find the share
    share = db.query(WishlistShare).filter(
        WishlistShare.id == share_id,
        WishlistShare.user_id == current_user.id
    ).first()

    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found or you don't have permission to delete it"
        )

    # Delete the share
    db.delete(share)
    db.commit()

    return {
        "success": True,
        "message": "Lien de partage revoque avec succes"
    }


@router.get("/share/{share_id}/stats")
def get_share_stats(
    share_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics for a specific shared wishlist link.
    Requires authentication and ownership.
    """
    # Find the share
    share = db.query(WishlistShare).filter(
        WishlistShare.id == share_id,
        WishlistShare.user_id == current_user.id
    ).first()

    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found or you don't have permission to view it"
        )

    # Get current wishlist item count
    wishlist_count = db.query(WishlistItem).filter(
        WishlistItem.user_id == current_user.id
    ).count()

    return {
        "shareId": share.id,
        "shareToken": share.share_token,
        "title": share.title,
        "isPublic": share.is_public,
        "isExpired": share.is_expired,
        "stats": {
            "viewCount": share.view_count,
            "itemCount": wishlist_count,
            "createdAt": share.created_at.isoformat() if share.created_at else None,
            "lastViewedAt": share.last_viewed_at.isoformat() if share.last_viewed_at else None,
            "expiresAt": share.expires_at.isoformat() if share.expires_at else None,
            "daysUntilExpiry": (share.expires_at - datetime.utcnow()).days if share.expires_at and not share.is_expired else None
        }
    }
