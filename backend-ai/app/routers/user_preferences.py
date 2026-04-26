"""
Barsha User Preferences API
============================
RESTful API for user style profile management.

Endpoints:
- GET  /api/preferences/profile - Get user style profile
- PUT  /api/preferences/profile - Update user style profile
- POST /api/preferences/merge   - Merge session into user (on login)
- GET  /api/preferences/context - Get recommendation context
- POST /api/preferences/refresh-inferred - Refresh behavior-based preferences
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
import logging

from app.core.database import get_db
from app.services.user_preferences_service import UserPreferencesService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/preferences", tags=["User Preferences"])


# Request/Response Models
class StyleProfileRequest(BaseModel):
    """Request body for updating style profile."""
    styles: Optional[List[str]] = Field(None, description="Preferred styles (casual, chic, sporty, elegant)")
    colors: Optional[List[str]] = Field(None, description="Preferred colors")
    occasions: Optional[List[str]] = Field(None, description="Shopping occasions (work, weekend, evening)")
    categories: Optional[List[str]] = Field(None, description="Preferred product categories")
    size_top: Optional[str] = Field(None, description="Top/shirt size (S, M, L, XL)")
    size_bottom: Optional[str] = Field(None, description="Bottom/pants size (36, 38, 40)")
    size_shoes: Optional[str] = Field(None, description="Shoe size")
    price_sensitivity: Optional[str] = Field(None, description="Price preference (low, medium, high, luxury)")
    min_price: Optional[float] = Field(None, description="Minimum price preference")
    max_price: Optional[float] = Field(None, description="Maximum price preference")


class StyleProfileResponse(BaseModel):
    """Response containing full style profile."""
    success: bool
    profile: Dict[str, Any]
    message: Optional[str] = None


class MergeRequest(BaseModel):
    """Request to merge session profile into user profile."""
    session_id: str


class RecommendationContextResponse(BaseModel):
    """Recommendation context for personalization."""
    success: bool
    context: Dict[str, Any]


# Helper to extract user context from headers
def get_user_context(
    authorization: Optional[str] = Header(None),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
) -> Dict[str, Any]:
    """Extract user_id and session_id from request headers."""
    user_id = None
    session_id = x_session_id

    # Try to extract user_id from JWT token
    if authorization and authorization.startswith("Bearer "):
        try:
            import jwt
            token = authorization.split(" ")[1]
            # Decode without verification for user_id extraction
            # In production, verify with secret
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub") or payload.get("user_id") or payload.get("id")
            if user_id:
                user_id = int(user_id)
        except Exception as e:
            logger.warning(f"Failed to decode JWT: {e}")

    return {"user_id": user_id, "session_id": session_id}


@router.get("/profile", response_model=StyleProfileResponse)
async def get_style_profile(
    user_context: Dict = Depends(get_user_context),
    db: Session = Depends(get_db)
):
    """
    Get user style profile.

    Returns explicit preferences + inferred preferences from behavior.
    Works for both authenticated users and anonymous sessions.
    """
    try:
        service = UserPreferencesService(db)
        profile = service.get_or_create_profile(
            user_id=user_context.get("user_id"),
            session_id=user_context.get("session_id")
        )

        return StyleProfileResponse(
            success=True,
            profile=profile.to_dict()
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting style profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to get style profile")


@router.put("/profile", response_model=StyleProfileResponse)
async def update_style_profile(
    request: StyleProfileRequest,
    user_context: Dict = Depends(get_user_context),
    db: Session = Depends(get_db)
):
    """
    Update user style profile with explicit preferences.

    This saves user's stated preferences (styles, colors, sizes, etc.).
    These are combined with behavior-inferred preferences for recommendations.
    """
    try:
        service = UserPreferencesService(db)
        profile = service.update_profile(
            user_id=user_context.get("user_id"),
            session_id=user_context.get("session_id"),
            styles=request.styles,
            colors=request.colors,
            occasions=request.occasions,
            categories=request.categories,
            size_top=request.size_top,
            size_bottom=request.size_bottom,
            size_shoes=request.size_shoes,
            price_sensitivity=request.price_sensitivity,
            min_price=request.min_price,
            max_price=request.max_price
        )

        return StyleProfileResponse(
            success=True,
            profile=profile.to_dict(),
            message="Profile updated successfully"
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating style profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to update style profile")


@router.post("/merge", response_model=StyleProfileResponse)
async def merge_session_to_user(
    request: MergeRequest,
    user_context: Dict = Depends(get_user_context),
    db: Session = Depends(get_db)
):
    """
    Merge anonymous session profile into authenticated user profile.

    Call this after user login to preserve preferences collected
    during anonymous browsing.
    """
    user_id = user_context.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        service = UserPreferencesService(db)
        profile = service.merge_session_to_user(
            user_id=user_id,
            session_id=request.session_id
        )

        return StyleProfileResponse(
            success=True,
            profile=profile.to_dict() if profile else {},
            message="Session merged successfully"
        )

    except Exception as e:
        logger.error(f"Error merging session profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to merge profiles")


@router.get("/context", response_model=RecommendationContextResponse)
async def get_recommendation_context(
    user_context: Dict = Depends(get_user_context),
    db: Session = Depends(get_db)
):
    """
    Get optimized recommendation context for personalization.

    Returns combined explicit + inferred preferences formatted
    for the recommendation engine.
    """
    try:
        service = UserPreferencesService(db)
        context = service.get_recommendation_context(
            user_id=user_context.get("user_id"),
            session_id=user_context.get("session_id")
        )

        return RecommendationContextResponse(
            success=True,
            context=context
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting recommendation context: {e}")
        raise HTTPException(status_code=500, detail="Failed to get context")


@router.post("/refresh-inferred")
async def refresh_inferred_preferences(
    lookback_days: int = 30,
    user_context: Dict = Depends(get_user_context),
    db: Session = Depends(get_db)
):
    """
    Refresh behavior-inferred preferences from recent activity.

    Analyzes user's recent browsing, cart, wishlist, and purchase
    behavior to infer style preferences.
    """
    try:
        service = UserPreferencesService(db)
        profile = service.update_inferred_preferences(
            user_id=user_context.get("user_id"),
            session_id=user_context.get("session_id"),
            lookback_days=lookback_days
        )

        return {
            "success": True,
            "inferred_styles": profile.inferred_styles,
            "inferred_colors": profile.inferred_colors,
            "category_affinity": profile.category_affinity,
            "last_updated": profile.last_behavior_update.isoformat() if profile.last_behavior_update else None
        }

    except Exception as e:
        logger.error(f"Error refreshing inferred preferences: {e}")
        raise HTTPException(status_code=500, detail="Failed to refresh preferences")


# Admin endpoints for analytics
@router.get("/admin/stats")
async def get_preference_stats(
    db: Session = Depends(get_db)
):
    """
    Get aggregate statistics about user style preferences.
    For admin dashboard.
    """
    from sqlalchemy import func
    from app.models.analytics import UserStyleProfile

    try:
        total_profiles = db.query(func.count(UserStyleProfile.id)).scalar() or 0
        authenticated_profiles = db.query(func.count(UserStyleProfile.id)).filter(
            UserStyleProfile.user_id.isnot(None)
        ).scalar() or 0
        anonymous_profiles = total_profiles - authenticated_profiles

        avg_completion = db.query(func.avg(UserStyleProfile.completion_score)).scalar() or 0

        # Most popular styles
        style_counts: Dict[str, int] = {}
        profiles = db.query(UserStyleProfile).filter(
            UserStyleProfile.preferred_styles.isnot(None)
        ).all()

        for profile in profiles:
            for style in (profile.preferred_styles or []):
                style_counts[style] = style_counts.get(style, 0) + 1

        # Most popular colors
        color_counts: Dict[str, int] = {}
        for profile in profiles:
            for color in (profile.preferred_colors or []):
                color_counts[color] = color_counts.get(color, 0) + 1

        return {
            "total_profiles": total_profiles,
            "authenticated_profiles": authenticated_profiles,
            "anonymous_profiles": anonymous_profiles,
            "average_completion_score": round(avg_completion, 1),
            "top_styles": sorted(style_counts.items(), key=lambda x: -x[1])[:5],
            "top_colors": sorted(color_counts.items(), key=lambda x: -x[1])[:8]
        }

    except Exception as e:
        logger.error(f"Error getting preference stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get stats")
