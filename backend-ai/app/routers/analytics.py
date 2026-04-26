"""
Barsha Analytics API
=====================
API endpoints for event tracking and analytics retrieval.

Endpoints:
- POST /api/analytics/track - Track user events
- GET /api/analytics/ai-stats - Get AI module statistics
- GET /api/analytics/trending - Get trending products
- GET /api/admin/analytics/dashboard - Admin AI dashboard
"""

from fastapi import APIRouter, HTTPException, Query, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Analytics"])

# Import services
try:
    from app.services.analytics_service import get_analytics_service, AnalyticsService
    from app.core.database import get_db
    from sqlalchemy.orm import Session
    ANALYTICS_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Analytics service not available: {e}")
    ANALYTICS_AVAILABLE = False


# ─────────────────────────────────────────────────────────────
# REQUEST/RESPONSE MODELS
# ─────────────────────────────────────────────────────────────

class TrackEventRequest(BaseModel):
    """Request model for tracking events."""
    session_id: str = Field(..., description="Unique session identifier")
    event_type: str = Field(..., description="Type of event (product_view, add_to_cart, etc.)")
    user_id: Optional[int] = Field(None, description="User ID if logged in")
    product_id: Optional[int] = Field(None, description="Product ID if applicable")
    category_id: Optional[int] = Field(None, description="Category ID if applicable")
    search_query: Optional[str] = Field(None, description="Search query if applicable")
    recommendation_type: Optional[str] = Field(None, description="Type of recommendation clicked")
    recommendation_position: Optional[int] = Field(None, description="Position in recommendation list")
    recommendation_source: Optional[str] = Field(None, description="Source placement of recommendation")
    event_data: Optional[Dict[str, Any]] = Field(None, description="Additional event data")
    page_url: Optional[str] = Field(None, description="Current page URL")
    device_type: Optional[str] = Field(None, description="Device type (mobile, desktop, tablet)")


class TrackBatchRequest(BaseModel):
    """Request model for batch event tracking."""
    events: List[TrackEventRequest]


class AIStatsResponse(BaseModel):
    """Response model for AI statistics."""
    period_days: int
    assistant: Dict[str, Any]
    visual_search: Dict[str, Any]
    recommendations: Dict[str, Any]
    total_events: int


class TrendingProductResponse(BaseModel):
    """Response model for trending products."""
    product_id: int
    score: float


class RecommendationPerformanceResponse(BaseModel):
    """Response model for recommendation performance."""
    type: str
    impressions: int
    clicks: int
    add_to_carts: int
    click_rate: float
    cart_rate: float


# ─────────────────────────────────────────────────────────────
# EVENT TRACKING ENDPOINTS
# ─────────────────────────────────────────────────────────────

@router.post("/api/analytics/track")
async def track_event(request: TrackEventRequest):
    """
    Track a user behavior event.

    Supported event types:
    - product_view: User viewed a product
    - category_view: User viewed a category
    - search_query: User performed a search
    - recommendation_impression: Recommendations were shown
    - recommendation_click: User clicked a recommendation
    - recommendation_add_to_cart: User added recommended product to cart
    - add_to_cart: User added product to cart
    - wishlist_add: User added to wishlist
    - assistant_open: User opened AI assistant
    - assistant_message: User sent message to assistant
    - assistant_product_click: User clicked product from assistant
    - visual_search_upload: User uploaded image for visual search
    - visual_search_result_click: User clicked visual search result
    """
    if not ANALYTICS_AVAILABLE:
        return {"success": True, "message": "Event tracking not configured (mock mode)"}

    try:
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            service = get_analytics_service(db)
            success = service.track_event(
                session_id=request.session_id,
                event_type=request.event_type,
                user_id=request.user_id,
                product_id=request.product_id,
                category_id=request.category_id,
                search_query=request.search_query,
                recommendation_type=request.recommendation_type,
                recommendation_position=request.recommendation_position,
                recommendation_source=request.recommendation_source,
                event_data=request.event_data,
                page_url=request.page_url,
                device_type=request.device_type
            )
            return {"success": success, "event_type": request.event_type}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error tracking event: {e}")
        # Don't fail the request - tracking is non-critical
        return {"success": False, "error": str(e)}


@router.post("/api/analytics/track/batch")
async def track_events_batch(request: TrackBatchRequest):
    """
    Track multiple events in a single request.
    Useful for batching events from the frontend.
    """
    if not ANALYTICS_AVAILABLE:
        return {"success": True, "tracked": 0, "message": "Event tracking not configured"}

    try:
        from app.core.database import SessionLocal
        db = SessionLocal()
        tracked = 0
        try:
            service = get_analytics_service(db)
            for event in request.events:
                if service.track_event(
                    session_id=event.session_id,
                    event_type=event.event_type,
                    user_id=event.user_id,
                    product_id=event.product_id,
                    category_id=event.category_id,
                    search_query=event.search_query,
                    recommendation_type=event.recommendation_type,
                    recommendation_position=event.recommendation_position,
                    recommendation_source=event.recommendation_source,
                    event_data=event.event_data,
                    page_url=event.page_url,
                    device_type=event.device_type
                ):
                    tracked += 1
            return {"success": True, "tracked": tracked, "total": len(request.events)}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error tracking batch events: {e}")
        return {"success": False, "error": str(e)}


# ─────────────────────────────────────────────────────────────
# ANALYTICS RETRIEVAL ENDPOINTS
# ─────────────────────────────────────────────────────────────

@router.get("/api/analytics/ai-stats", response_model=AIStatsResponse)
async def get_ai_stats(days: int = Query(default=30, ge=1, le=365)):
    """
    Get AI module usage statistics.

    Returns metrics for:
    - AI Assistant (sessions, messages, product clicks, conversions)
    - Visual Search (uploads, result clicks, conversions)
    - Recommendations (impressions, clicks, add-to-carts)
    """
    if not ANALYTICS_AVAILABLE:
        # Return mock data when analytics not configured
        return {
            "period_days": days,
            "assistant": {"sessions": 0, "messages": 0, "product_clicks": 0, "add_to_carts": 0, "click_rate": 0.0},
            "visual_search": {"uploads": 0, "result_clicks": 0, "add_to_carts": 0, "click_rate": 0.0},
            "recommendations": {"impressions": 0, "clicks": 0, "add_to_carts": 0, "click_rate": 0.0, "cart_rate": 0.0},
            "total_events": 0
        }

    try:
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            service = get_analytics_service(db)
            return service.get_ai_module_stats(days=days)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting AI stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/analytics/trending", response_model=List[TrendingProductResponse])
async def get_trending_products(
    days: int = Query(default=7, ge=1, le=30),
    limit: int = Query(default=20, ge=1, le=50)
):
    """
    Get trending products based on user activity.

    Products are scored based on:
    - Views (1 point)
    - Clicks (2 points)
    - Add to carts (5 points)
    - Purchases (10 points)
    """
    if not ANALYTICS_AVAILABLE:
        return []

    try:
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            service = get_analytics_service(db)
            return service.get_trending_products(days=days, limit=limit)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting trending products: {e}")
        return []


@router.get("/api/analytics/recently-viewed")
async def get_recently_viewed(
    session_id: str,
    user_id: Optional[int] = None,
    limit: int = Query(default=10, ge=1, le=20)
):
    """
    Get recently viewed products for a session/user.
    Used for "Recently Viewed" recommendations.
    """
    if not ANALYTICS_AVAILABLE:
        return {"products": []}

    try:
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            service = get_analytics_service(db)
            product_ids = service.get_recently_viewed(session_id, user_id, limit)
            return {"products": product_ids}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting recently viewed: {e}")
        return {"products": []}


@router.get("/api/analytics/user-interests")
async def get_user_interests(
    user_id: int,
    days: int = Query(default=30, ge=1, le=90)
):
    """
    Get user interest profile based on behavior.
    Used for personalized recommendations.
    """
    if not ANALYTICS_AVAILABLE:
        return {}

    try:
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            service = get_analytics_service(db)
            return service.get_user_interests(user_id, days=days)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting user interests: {e}")
        return {}


@router.get("/api/analytics/session-context")
async def get_session_context(session_id: str):
    """
    Get current session context for personalization.
    Returns recent activity in the current browsing session.
    """
    if not ANALYTICS_AVAILABLE:
        return {}

    try:
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            service = get_analytics_service(db)
            return service.get_session_context(session_id)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting session context: {e}")
        return {}


# ─────────────────────────────────────────────────────────────
# ADMIN ANALYTICS ENDPOINTS
# ─────────────────────────────────────────────────────────────

@router.get("/api/admin/analytics/ai-dashboard")
async def get_admin_ai_dashboard(days: int = Query(default=30, ge=1, le=365)):
    """
    Get comprehensive AI analytics dashboard for admin.

    Returns:
    - AI module usage stats
    - Recommendation performance by type
    - Trending products
    - Search trends (if available)
    """
    if not ANALYTICS_AVAILABLE:
        return {
            "ai_stats": {
                "period_days": days,
                "assistant": {"sessions": 0, "messages": 0, "product_clicks": 0, "add_to_carts": 0},
                "visual_search": {"uploads": 0, "result_clicks": 0, "add_to_carts": 0},
                "recommendations": {"impressions": 0, "clicks": 0, "add_to_carts": 0}
            },
            "recommendation_performance": [],
            "trending_products": [],
            "note": "Analytics database not configured. These are placeholder values."
        }

    try:
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            service = get_analytics_service(db)

            return {
                "ai_stats": service.get_ai_module_stats(days=days),
                "recommendation_performance": service.get_recommendation_performance_by_type(days=days),
                "trending_products": service.get_trending_products(days=7, limit=10)
            }
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting admin AI dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/admin/analytics/recommendation-performance")
async def get_recommendation_performance(
    days: int = Query(default=30, ge=1, le=365)
) -> List[RecommendationPerformanceResponse]:
    """
    Get detailed recommendation performance by type.

    Shows which recommendation strategies are performing best.
    """
    if not ANALYTICS_AVAILABLE:
        return []

    try:
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            service = get_analytics_service(db)
            return service.get_recommendation_performance_by_type(days=days)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting recommendation performance: {e}")
        return []


# Export router
analytics_router = router
