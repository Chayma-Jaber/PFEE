"""
Newsletter Router
Email subscription management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict

from app.core.database import get_db
from app.models.newsletter import NewsletterSubscriber

router = APIRouter(prefix="/newsletter", tags=["Newsletter"])


# ========================
# Request/Response Schemas
# ========================

class SubscribeRequest(BaseModel):
    """Newsletter subscription request"""
    email: EmailStr
    first_name: Optional[str] = None
    preferences: Optional[Dict[str, bool]] = None
    source: Optional[str] = "website"


class SubscribeResponse(BaseModel):
    """Newsletter subscription response"""
    success: bool
    message: str
    requires_confirmation: bool = True


class UnsubscribeRequest(BaseModel):
    """Newsletter unsubscribe request"""
    email: EmailStr
    reason: Optional[str] = None


class PreferencesUpdateRequest(BaseModel):
    """Newsletter preferences update request"""
    email: EmailStr
    preferences: Dict[str, bool]


class PreferencesResponse(BaseModel):
    """Newsletter preferences response"""
    email: str
    preferences: Dict[str, bool]
    is_active: bool


# ========================
# Routes
# ========================

@router.post("/subscribe", response_model=SubscribeResponse)
async def subscribe_newsletter(
    request: SubscribeRequest,
    db: Session = Depends(get_db)
):
    """
    Subscribe to the newsletter.

    Creates a new subscription or reactivates an existing one.
    Returns a confirmation token for double opt-in verification.
    """
    # Check for existing subscription
    existing = db.query(NewsletterSubscriber).filter(
        NewsletterSubscriber.email == request.email.lower()
    ).first()

    if existing:
        if existing.is_active and existing.is_confirmed:
            return SubscribeResponse(
                success=True,
                message="Vous etes deja inscrit a notre newsletter.",
                requires_confirmation=False
            )
        elif existing.is_active and not existing.is_confirmed:
            # Resend confirmation
            existing.confirmation_token = NewsletterSubscriber.generate_token()
            db.commit()
            return SubscribeResponse(
                success=True,
                message="Un email de confirmation a ete renvoye.",
                requires_confirmation=True
            )
        else:
            # Reactivate subscription
            existing.is_active = True
            existing.unsubscribed_at = None
            existing.confirmation_token = NewsletterSubscriber.generate_token()
            existing.first_name = request.first_name or existing.first_name
            existing.preferences = request.preferences or existing.preferences
            existing.source = request.source or existing.source
            db.commit()
            return SubscribeResponse(
                success=True,
                message="Votre abonnement a ete reactive. Veuillez confirmer votre email.",
                requires_confirmation=True
            )

    # Create new subscription
    default_preferences = {
        "promotions": True,
        "new_arrivals": True,
        "style_tips": True
    }
    if request.preferences:
        default_preferences.update(request.preferences)

    subscriber = NewsletterSubscriber(
        email=request.email.lower(),
        first_name=request.first_name,
        preferences=default_preferences,
        confirmation_token=NewsletterSubscriber.generate_token(),
        source=request.source or "website",
        is_active=True,
        is_confirmed=False
    )
    db.add(subscriber)
    db.commit()
    db.refresh(subscriber)

    # In a real application, send confirmation email here
    # For now, we'll auto-confirm for simplicity
    # TODO: Integrate with email service

    return SubscribeResponse(
        success=True,
        message="Merci pour votre inscription! Verifiez votre email pour confirmer.",
        requires_confirmation=True
    )


@router.get("/confirm/{token}")
async def confirm_subscription(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Confirm newsletter subscription using the confirmation token.

    This endpoint is called when the user clicks the confirmation link in their email.
    """
    subscriber = db.query(NewsletterSubscriber).filter(
        NewsletterSubscriber.confirmation_token == token
    ).first()

    if not subscriber:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token de confirmation invalide ou expire."
        )

    if subscriber.is_confirmed:
        return {
            "success": True,
            "message": "Votre email est deja confirme.",
            "already_confirmed": True
        }

    subscriber.is_confirmed = True
    subscriber.confirmed_at = datetime.utcnow()
    subscriber.confirmation_token = None  # Invalidate token after use
    db.commit()

    return {
        "success": True,
        "message": "Votre inscription a la newsletter est confirmee!",
        "already_confirmed": False
    }


@router.post("/unsubscribe")
async def unsubscribe_newsletter(
    request: UnsubscribeRequest,
    db: Session = Depends(get_db)
):
    """
    Unsubscribe from the newsletter.

    Marks the subscription as inactive rather than deleting it,
    allowing for potential resubscription later.
    """
    subscriber = db.query(NewsletterSubscriber).filter(
        NewsletterSubscriber.email == request.email.lower()
    ).first()

    if not subscriber:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email non trouve dans notre liste de diffusion."
        )

    if not subscriber.is_active:
        return {
            "success": True,
            "message": "Vous etes deja desabonne de notre newsletter."
        }

    subscriber.is_active = False
    subscriber.unsubscribed_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "message": "Vous avez ete desabonne de notre newsletter avec succes."
    }


@router.put("/preferences")
async def update_preferences(
    request: PreferencesUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Update newsletter preferences.

    Allows subscribers to customize which types of emails they receive:
    - promotions: Sales and discount notifications
    - new_arrivals: New product announcements
    - style_tips: Fashion advice and styling suggestions
    """
    subscriber = db.query(NewsletterSubscriber).filter(
        NewsletterSubscriber.email == request.email.lower()
    ).first()

    if not subscriber:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email non trouve. Veuillez vous inscrire d'abord."
        )

    if not subscriber.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Votre abonnement est inactif. Veuillez vous reabonner."
        )

    # Update preferences
    current_preferences = subscriber.preferences or {}
    current_preferences.update(request.preferences)
    subscriber.preferences = current_preferences
    subscriber.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(subscriber)

    return PreferencesResponse(
        email=subscriber.email,
        preferences=subscriber.preferences,
        is_active=subscriber.is_active
    )


@router.get("/status/{email}")
async def get_subscription_status(
    email: str,
    db: Session = Depends(get_db)
):
    """
    Get the subscription status for an email address.

    Returns subscription details including preferences and status.
    """
    subscriber = db.query(NewsletterSubscriber).filter(
        NewsletterSubscriber.email == email.lower()
    ).first()

    if not subscriber:
        return {
            "subscribed": False,
            "message": "Email non inscrit a la newsletter."
        }

    return {
        "subscribed": True,
        "isActive": subscriber.is_active,
        "isConfirmed": subscriber.is_confirmed,
        "preferences": subscriber.preferences,
        "subscribedAt": subscriber.subscribed_at.isoformat() if subscriber.subscribed_at else None
    }
