"""
BARSHA NEXT-GENERATION RECOMMENDATIONS API
==========================================
Version: 3.0.0

Premium recommendation endpoints with:
- 20+ strategies
- Full analytics tracking
- A/B testing support
- Comprehensive metadata
- Performance monitoring
"""

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import time
import logging

from app.services.next_gen_recommendation_engine import (
    get_next_gen_engine,
    UserContext,
    RecommendationStrategy
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recommendations/v3", tags=["Next-Gen Recommendations"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class PersonalizedRequest(BaseModel):
    """Request for personalized recommendations with full user context"""
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    viewed_product_ids: List[int] = Field(default_factory=list)
    wishlist_product_ids: List[int] = Field(default_factory=list)
    cart_product_ids: List[int] = Field(default_factory=list)
    purchased_product_ids: List[int] = Field(default_factory=list)
    preferred_categories: List[str] = Field(default_factory=list)
    preferred_colors: List[str] = Field(default_factory=list)
    preferred_styles: List[str] = Field(default_factory=list)
    preferred_occasions: List[str] = Field(default_factory=list)
    category_affinity: Dict[str, float] = Field(default_factory=dict)
    price_sensitivity: Optional[str] = "medium"
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    size_top: Optional[str] = None
    size_bottom: Optional[str] = None
    profile_completeness: float = Field(default=0.0, ge=0, le=100)
    device_type: str = "desktop"
    limit: int = Field(default=8, ge=1, le=24)


class CartRequest(BaseModel):
    """Request for cart-based recommendations"""
    cart_product_ids: List[int]


class MultiStrategyRequest(BaseModel):
    """Request for multiple strategies at once"""
    strategies: List[str]
    product_id: Optional[int] = None
    user_context: Optional[PersonalizedRequest] = None
    limit: int = Field(default=8, ge=1, le=20)
    family: Optional[str] = None


class BecauseYouViewedRequest(BaseModel):
    """Request for because-you-viewed recommendations"""
    viewed_product_ids: List[int]


class CustomersAlsoLikedRequest(BaseModel):
    """Request for collaborative filtering recommendations"""
    product_ids: List[int]


class RecommendationAnalyticsEvent(BaseModel):
    """Analytics event for recommendation tracking"""
    event_type: str  # impression, click, add_to_cart, purchase
    recommendation_id: str
    product_id: int
    strategy: str
    position: int
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    timestamp: Optional[str] = None


# ============================================================================
# PRODUCT DETAIL PAGE ENDPOINTS
# ============================================================================

@router.get("/similar/{product_id}")
async def get_similar(
    product_id: int,
    limit: int = Query(default=8, ge=1, le=20),
    family: Optional[str] = Query(default=None)
):
    """
    Get products similar to the specified product.

    Uses deep content-based similarity:
    - Category matching
    - Color harmony
    - Style profile matching
    - Price similarity
    """
    try:
        engine = get_next_gen_engine()
        response = engine.get_similar_products(product_id, limit, family)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_similar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/complementary/{product_id}")
async def get_complementary(
    product_id: int,
    limit: int = Query(default=6, ge=1, le=20),
    family: Optional[str] = Query(default=None)
):
    """
    Get products that complement the specified product.

    Uses fashion-aware outfit rules:
    - Category complementarity
    - Color harmony
    - Outfit construction logic
    """
    try:
        engine = get_next_gen_engine()
        response = engine.get_complementary_products(product_id, limit, family)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_complementary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/complete-look/{product_id}")
async def get_complete_look(
    product_id: int,
    limit: int = Query(default=4, ge=1, le=8)
):
    """
    Get a curated outfit to complete the look.

    Returns a balanced outfit across categories:
    - Best matching bottoms/tops
    - Complementary footwear
    - Finishing accessories
    """
    try:
        engine = get_next_gen_engine()
        response = engine.get_complete_the_look(product_id, limit)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_complete_look: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/premium-alternatives/{product_id}")
async def get_premium_alternatives(
    product_id: int,
    limit: int = Query(default=4, ge=1, le=12)
):
    """
    Get premium alternatives (tasteful upsell).

    Returns similar products that are 20-100% more expensive
    but maintain style coherence.
    """
    try:
        engine = get_next_gen_engine()
        response = engine.get_premium_alternatives(product_id, limit)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_premium_alternatives: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/affordable-alternatives/{product_id}")
async def get_affordable_alternatives(
    product_id: int,
    limit: int = Query(default=4, ge=1, le=12)
):
    """
    Get affordable alternatives (smart downgrade).

    Returns similar products that are 20-60% cheaper
    while maintaining style.
    """
    try:
        engine = get_next_gen_engine()
        response = engine.get_affordable_alternatives(product_id, limit)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_affordable_alternatives: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/frequently-bought-together/{product_id}")
async def get_frequently_bought_together(
    product_id: int,
    limit: int = Query(default=4, ge=1, le=8)
):
    """
    Get products frequently bought together.

    Uses co-purchase analysis to find items
    that are commonly purchased as a set.
    """
    try:
        engine = get_next_gen_engine()
        response = engine.get_frequently_bought_together(product_id, limit)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_frequently_bought_together: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HOMEPAGE ENDPOINTS
# ============================================================================

@router.get("/trending")
async def get_trending(
    limit: int = Query(default=8, ge=1, le=24),
    family: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None)
):
    """
    Get trending products based on real analytics.

    Uses:
    - View counts
    - Add-to-cart rates
    - Purchase velocity
    - Wishlist additions
    """
    try:
        engine = get_next_gen_engine()
        response = engine.get_trending(limit, family, category)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_trending: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/new-arrivals")
async def get_new_arrivals(
    limit: int = Query(default=8, ge=1, le=24),
    family: Optional[str] = Query(default=None)
):
    """
    Get newly arrived products.

    Sorted by product ID (higher = newer) with
    optional gender filtering.
    """
    try:
        engine = get_next_gen_engine()
        response = engine.get_new_arrivals(limit, family)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_new_arrivals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/seasonal")
async def get_seasonal(
    limit: int = Query(default=8, ge=1, le=24),
    family: Optional[str] = Query(default=None)
):
    """
    Get season-appropriate products.

    Automatically detects current season and
    weights categories appropriately.
    """
    try:
        engine = get_next_gen_engine()
        response = engine.get_seasonal(limit, family)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_seasonal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/editorial")
async def get_editorial(
    limit: int = Query(default=6, ge=1, le=16)
):
    """
    Get editorially curated products.

    A mix of:
    - High-performing products
    - Diverse categories
    - Quality discounts
    """
    try:
        engine = get_next_gen_engine()
        response = engine.get_editorial(limit)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_editorial: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/style/{style}")
async def get_style_discovery(
    style: str,
    limit: int = Query(default=8, ge=1, le=24),
    family: Optional[str] = Query(default=None)
):
    """
    Get products for style discovery.

    Available styles:
    - casual, chic, sporty, elegant
    - bohemian, minimalist, trendy
    - classic, streetwear, romantic
    """
    valid_styles = ["casual", "chic", "sporty", "elegant", "bohemian",
                    "minimalist", "trendy", "classic", "streetwear", "romantic"]

    if style.lower() not in valid_styles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid style. Must be one of: {', '.join(valid_styles)}"
        )

    try:
        engine = get_next_gen_engine()
        response = engine.get_style_discovery(style, limit, family)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_style_discovery: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/by-colors")
async def get_by_colors(
    colors: str = Query(..., description="Comma-separated list of colors"),
    limit: int = Query(default=8, ge=1, le=24),
    family: Optional[str] = Query(default=None)
):
    """
    Get products matching user's preferred colors.

    Colors are matched against product color attributes.
    Returns products sorted by color match quality.
    """
    try:
        color_list = [c.strip().lower() for c in colors.split(",") if c.strip()]
        if not color_list:
            raise HTTPException(status_code=400, detail="At least one color required")

        engine = get_next_gen_engine()
        response = engine.get_by_colors(color_list, limit, family)
        return response.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_by_colors: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PERSONALIZATION ENDPOINTS
# ============================================================================

@router.post("/personalized")
async def get_personalized(request: PersonalizedRequest):
    """
    Get personalized recommendations based on user behavior and preferences.

    Uses:
    - Explicit preferences (styles, colors, occasions)
    - Wishlist items
    - Recently viewed products
    - Purchase history
    - Category affinity
    - Price sensitivity
    - Profile completeness for confidence weighting
    """
    try:
        engine = get_next_gen_engine()

        user_context = UserContext(
            user_id=request.user_id,
            session_id=request.session_id,
            is_authenticated=bool(request.user_id),
            viewed_product_ids=request.viewed_product_ids,
            wishlist_product_ids=request.wishlist_product_ids,
            cart_product_ids=request.cart_product_ids,
            purchased_product_ids=request.purchased_product_ids,
            preferred_categories=request.preferred_categories,
            preferred_colors=request.preferred_colors,
            preferred_styles=request.preferred_styles,
            preferred_occasions=request.preferred_occasions,
            category_affinity=request.category_affinity,
            price_sensitivity=request.price_sensitivity,
            min_price=request.min_price,
            max_price=request.max_price,
            profile_completeness=request.profile_completeness,
            device_type=request.device_type
        )

        response = engine.get_personalized(user_context, request.limit)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_personalized: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/because-you-viewed")
async def get_because_you_viewed(request: BecauseYouViewedRequest):
    """
    Get recommendations based on recently viewed products.

    Returns products similar to the most recently viewed item
    with personalized reason text.
    """
    try:
        engine = get_next_gen_engine()
        response = engine.get_because_you_viewed(request.viewed_product_ids)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_because_you_viewed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/customers-also-liked")
async def get_customers_also_liked(request: CustomersAlsoLikedRequest):
    """
    Get products that similar customers also liked.

    Uses collaborative filtering patterns based on
    similar user behavior.
    """
    try:
        engine = get_next_gen_engine()
        response = engine.get_customers_also_liked(request.product_ids)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_customers_also_liked: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CART ENDPOINTS
# ============================================================================

@router.post("/cart-recommendations")
async def get_cart_recommendations(request: CartRequest):
    """
    Get recommendations to complete the shopping cart.

    Analyzes cart contents and recommends:
    - Missing outfit pieces
    - Complementary accessories
    - Items that harmonize with cart colors
    """
    try:
        engine = get_next_gen_engine()
        response = engine.get_cart_recommendations(request.cart_product_ids)
        return response.to_dict()
    except Exception as e:
        logger.error(f"Error in get_cart_recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# BATCH / MULTI-STRATEGY ENDPOINTS
# ============================================================================

@router.post("/multi")
async def get_multi_strategy(request: MultiStrategyRequest):
    """
    Get multiple recommendation strategies in one request.

    Useful for:
    - Product detail pages (similar + complementary + alternatives)
    - Homepage sections (trending + new + seasonal)
    - Reducing API calls
    """
    try:
        engine = get_next_gen_engine()
        results = {}

        for strategy in request.strategies:
            try:
                if strategy == "similar" and request.product_id:
                    resp = engine.get_similar_products(
                        request.product_id, request.limit, request.family
                    )
                elif strategy == "complementary" and request.product_id:
                    resp = engine.get_complementary_products(
                        request.product_id, request.limit, request.family
                    )
                elif strategy == "complete_the_look" and request.product_id:
                    resp = engine.get_complete_the_look(request.product_id, 4)
                elif strategy == "premium_alternative" and request.product_id:
                    resp = engine.get_premium_alternatives(request.product_id, 4)
                elif strategy == "affordable_alternative" and request.product_id:
                    resp = engine.get_affordable_alternatives(request.product_id, 4)
                elif strategy == "frequently_bought_together" and request.product_id:
                    resp = engine.get_frequently_bought_together(request.product_id, 4)
                elif strategy == "trending":
                    resp = engine.get_trending(request.limit, request.family)
                elif strategy == "new_arrivals":
                    resp = engine.get_new_arrivals(request.limit, request.family)
                elif strategy == "seasonal":
                    resp = engine.get_seasonal(request.limit, request.family)
                elif strategy == "editorial":
                    resp = engine.get_editorial(min(request.limit, 6))
                elif strategy == "personalized" and request.user_context:
                    user_ctx = UserContext(
                        user_id=request.user_context.user_id,
                        session_id=request.user_context.session_id,
                        viewed_product_ids=request.user_context.viewed_product_ids,
                        wishlist_product_ids=request.user_context.wishlist_product_ids,
                        cart_product_ids=request.user_context.cart_product_ids,
                        purchased_product_ids=request.user_context.purchased_product_ids
                    )
                    resp = engine.get_personalized(user_ctx, request.limit)
                else:
                    continue

                results[strategy] = resp.to_dict()
            except Exception as strategy_error:
                logger.error(f"Error in strategy {strategy}: {strategy_error}")
                results[strategy] = {"error": str(strategy_error)}

        return {
            "strategies": results,
            "requested": request.strategies,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error in get_multi_strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PRODUCT DETAIL PAGE BUNDLE
# ============================================================================

@router.get("/pdp-bundle/{product_id}")
async def get_pdp_bundle(
    product_id: int,
    family: Optional[str] = Query(default=None)
):
    """
    Get all recommendations for a product detail page in one request.

    Returns:
    - complete_the_look (4)
    - similar (8)
    - complementary (6)
    - frequently_bought_together (4)
    - premium_alternative (4)
    - affordable_alternative (4)
    """
    try:
        engine = get_next_gen_engine()

        return {
            "complete_the_look": engine.get_complete_the_look(product_id, 4).to_dict(),
            "similar": engine.get_similar_products(product_id, 8, family).to_dict(),
            "complementary": engine.get_complementary_products(product_id, 6, family).to_dict(),
            "frequently_bought_together": engine.get_frequently_bought_together(product_id, 4).to_dict(),
            "premium_alternative": engine.get_premium_alternatives(product_id, 4).to_dict(),
            "affordable_alternative": engine.get_affordable_alternatives(product_id, 4).to_dict(),
            "product_id": product_id,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error in get_pdp_bundle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HOMEPAGE BUNDLE
# ============================================================================

@router.get("/homepage-bundle")
async def get_homepage_bundle(
    family: Optional[str] = Query(default=None),
    include_personalized: bool = Query(default=False)
):
    """
    Get all recommendations for the homepage in one request.

    Returns:
    - trending (8)
    - new_arrivals (8)
    - seasonal (8)
    - editorial (6)
    - (optionally) personalized
    """
    try:
        engine = get_next_gen_engine()

        result = {
            "trending": engine.get_trending(8, family).to_dict(),
            "new_arrivals": engine.get_new_arrivals(8, family).to_dict(),
            "seasonal": engine.get_seasonal(8, family).to_dict(),
            "editorial": engine.get_editorial(6).to_dict(),
            "timestamp": datetime.now().isoformat()
        }

        return result
    except Exception as e:
        logger.error(f"Error in get_homepage_bundle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

@router.post("/track")
async def track_recommendation_event(event: RecommendationAnalyticsEvent):
    """
    Track recommendation interaction events with database persistence.

    Event types:
    - impression: Recommendation was shown
    - click: User clicked on recommendation
    - add_to_cart: User added recommended item to cart
    - purchase: User purchased recommended item

    Events are persisted to database for:
    - Analytics and reporting
    - Behavior-inferred preferences
    - A/B testing analysis
    """
    try:
        # Log the event
        logger.info(
            f"Recommendation event: {event.event_type} | "
            f"rec_id={event.recommendation_id} | "
            f"product={event.product_id} | "
            f"strategy={event.strategy} | "
            f"position={event.position}"
        )

        # Persist to database
        try:
            from app.core.database import SessionLocal
            from app.models.analytics import RecommendationEvent
            from datetime import datetime

            db = SessionLocal()
            try:
                # Create recommendation event record
                rec_event = RecommendationEvent(
                    recommendation_id=event.recommendation_id,
                    event_type=event.event_type,
                    product_id=event.product_id,
                    strategy=event.strategy,
                    position=event.position,
                    session_id=event.session_id,
                    user_id=int(event.user_id) if event.user_id and event.user_id.isdigit() else None,
                    timestamp=datetime.fromisoformat(event.timestamp.replace('Z', '+00:00')) if event.timestamp else datetime.utcnow()
                )
                db.add(rec_event)
                db.commit()
                logger.debug(f"Saved recommendation event to database: {rec_event.id}")
            finally:
                db.close()
        except Exception as db_error:
            # Don't fail the request if DB write fails
            logger.warning(f"Failed to persist recommendation event: {db_error}")

        return {
            "status": "tracked",
            "event_id": f"{event.recommendation_id}_{event.event_type}_{datetime.now().timestamp()}"
        }
    except Exception as e:
        logger.error(f"Error tracking event: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HEALTH & DEBUG ENDPOINTS
# ============================================================================

@router.get("/health")
async def health_check():
    """
    Get recommendation engine health status.

    Returns:
    - Catalog size
    - Cache statistics
    - Available strategies
    - Current season
    """
    try:
        engine = get_next_gen_engine()
        return engine.get_health()
    except Exception as e:
        logger.error(f"Error in health_check: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/strategies")
async def list_strategies():
    """
    List all available recommendation strategies.
    """
    return {
        "strategies": [
            {
                "id": s.value,
                "name": s.name,
                "description": _get_strategy_description(s)
            }
            for s in RecommendationStrategy
        ],
        "total": len(RecommendationStrategy)
    }


def _get_strategy_description(strategy: RecommendationStrategy) -> str:
    """Get human-readable description for a strategy"""
    descriptions = {
        RecommendationStrategy.SIMILAR: "Products with similar style and attributes",
        RecommendationStrategy.COMPLEMENTARY: "Products that complement the outfit",
        RecommendationStrategy.COMPLETE_THE_LOOK: "Complete outfit curation",
        RecommendationStrategy.PREMIUM_ALTERNATIVE: "Higher-end alternatives",
        RecommendationStrategy.AFFORDABLE_ALTERNATIVE: "Budget-friendly alternatives",
        RecommendationStrategy.TRENDING: "Currently popular products",
        RecommendationStrategy.NEW_ARRIVALS: "Recently added products",
        RecommendationStrategy.SEASONAL: "Season-appropriate picks",
        RecommendationStrategy.EDITORIAL: "Curated by stylists",
        RecommendationStrategy.PERSONALIZED: "Based on user behavior",
        RecommendationStrategy.CART_COMPLEMENT: "Complete your cart",
        RecommendationStrategy.STYLE_DISCOVERY: "Explore new styles",
        RecommendationStrategy.BECAUSE_YOU_VIEWED: "Based on recently viewed",
        RecommendationStrategy.BECAUSE_YOU_LIKED: "Based on wishlist items",
        RecommendationStrategy.FREQUENTLY_BOUGHT_TOGETHER: "Often purchased together",
        RecommendationStrategy.CUSTOMERS_ALSO_LIKED: "Similar customers liked",
        RecommendationStrategy.RECENTLY_VIEWED: "Continue browsing",
        RecommendationStrategy.SAME_VIBE: "Same aesthetic",
        RecommendationStrategy.OCCASION_BASED: "Perfect for the occasion",
        RecommendationStrategy.BACK_IN_STOCK: "Recently restocked",
        RecommendationStrategy.PRICE_DROP: "Price reduced items"
    }
    return descriptions.get(strategy, "Recommended products")


@router.post("/invalidate-cache")
async def invalidate_cache(strategy: Optional[str] = None):
    """
    Invalidate recommendation cache.

    Use this after product updates or to refresh recommendations.
    """
    try:
        engine = get_next_gen_engine()
        engine.invalidate_cache(strategy)
        return {
            "status": "invalidated",
            "strategy": strategy or "all",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error invalidating cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))
