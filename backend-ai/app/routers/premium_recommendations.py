"""
Barsha Premium Recommendations API
===================================
Advanced recommendation endpoints for a luxury e-commerce experience.

Endpoints organized by context:
- Product Detail Page: similar, complementary, complete_the_look, alternatives
- Homepage: trending, new_arrivals, seasonal, personalized, editorial
- Cart: cart_recommendations
- Discovery: style_discovery
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recommendations", tags=["Premium Recommendations"])

# Import premium engine
try:
    from app.services.premium_recommendation_engine import (
        get_premium_recommendation_engine,
        RecommendationStrategy,
        RecommendationSet,
        RecommendationItem,
        StyleProfile
    )
    ENGINE_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Premium recommendation engine not available: {e}")
    ENGINE_AVAILABLE = False


# ═══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class ProductRecommendationDTO(BaseModel):
    """Single product recommendation."""
    id: int
    reference: str
    name: str
    price: str
    originalPrice: Optional[str] = None
    discount: Optional[int] = None
    image: str
    secondImage: Optional[str] = None
    url: str
    colors: List[str] = []
    category: Optional[str] = None
    family: Optional[str] = None
    score: float
    confidence: float
    reason: str
    reasonKey: str
    position: int


class RecommendationSetDTO(BaseModel):
    """Complete recommendation set response."""
    success: bool = True
    strategy: str
    title: str
    subtitle: str
    explanation: str
    products: List[ProductRecommendationDTO]
    totalCandidates: int
    processingTimeMs: float
    metadata: Dict[str, Any] = {}


class PersonalizedRequest(BaseModel):
    """Request for personalized recommendations."""
    wishlist: List[Dict[str, Any]] = []
    orders: List[Dict[str, Any]] = []
    viewedProducts: List[int] = []
    limit: int = Field(default=8, ge=1, le=20)


class CartRecommendationsRequest(BaseModel):
    """Request for cart-based recommendations."""
    cartProductIds: List[int]
    limit: int = Field(default=4, ge=1, le=8)


class MultiRecommendationsRequest(BaseModel):
    """Request for multiple recommendation sets at once."""
    productId: Optional[int] = None
    strategies: List[str] = []
    limit: int = Field(default=8, ge=1, le=20)
    family: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _format_product(item: RecommendationItem) -> ProductRecommendationDTO:
    """Convert engine RecommendationItem to API DTO."""
    product = item.product_data
    pid = product.get("id", 0)

    # Extract image
    img = product.get("image") or product.get("firstImg") or ""
    if isinstance(img, dict):
        img = img.get("url") or (img.get("medium") or {}).get("url") or ""
    if img and not img.startswith("http"):
        img = f"https://barsha.com.tn/{img.lstrip('/')}"

    # Second image
    second_img = product.get("secondImg") or ""
    if isinstance(second_img, dict):
        second_img = second_img.get("url") or ""

    # Price handling
    current_price = product.get("currentPrice") or product.get("prix") or product.get("price") or 0
    original_price = product.get("price") or product.get("prix") or current_price

    try:
        current_price_val = float(current_price)
        original_price_val = float(original_price)
    except (ValueError, TypeError):
        current_price_val = 0
        original_price_val = 0

    discount = None
    if original_price_val > current_price_val > 0:
        discount = int(((original_price_val - current_price_val) / original_price_val) * 100)

    # Format prices as strings
    price_str = f"{current_price_val:.2f} TND" if current_price_val else "Prix sur demande"
    original_price_str = f"{original_price_val:.2f} TND" if discount else None

    # Extract colors
    colors = []
    for dec in (product.get("declinaisons") or []):
        color = dec.get("couleur") or dec.get("libellet") or ""
        if color:
            colors.append(color)

    return ProductRecommendationDTO(
        id=pid,
        reference=product.get("sku") or product.get("reference") or f"BRSH-{pid}",
        name=product.get("nom") or product.get("title") or product.get("name") or "Article",
        price=price_str,
        originalPrice=original_price_str,
        discount=discount,
        image=img or "https://barsha.com.tn/assets/images/placeholder.jpg",
        secondImage=second_img or None,
        url=f"/produit/{pid}",
        colors=colors[:5],  # Limit to 5 colors
        category=item.metadata.get("category"),
        family=product.get("Famille") or product.get("famille") or product.get("genre"),
        score=round(item.score, 2),
        confidence=round(item.confidence, 2),
        reason=item.reason,
        reasonKey=item.reason_key,
        position=item.position
    )


def _format_response(rec_set: RecommendationSet) -> RecommendationSetDTO:
    """Convert engine RecommendationSet to API DTO."""
    return RecommendationSetDTO(
        success=True,
        strategy=rec_set.strategy.value,
        title=rec_set.title,
        subtitle=rec_set.subtitle,
        explanation=rec_set.explanation,
        products=[_format_product(item) for item in rec_set.items],
        totalCandidates=rec_set.total_candidates,
        processingTimeMs=round(rec_set.processing_time_ms, 2),
        metadata=rec_set.metadata
    )


def _check_engine():
    """Check if recommendation engine is available."""
    if not ENGINE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Premium recommendation engine not available"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCT DETAIL PAGE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/v2/similar/{product_id}", response_model=RecommendationSetDTO)
async def get_similar_products(
    product_id: int,
    limit: int = Query(default=8, ge=1, le=20)
):
    """
    Get products similar to a given product.

    Returns items with same category, family, colors, and price range.
    Perfect for "Dans le meme style" sections.
    """
    _check_engine()
    try:
        engine = get_premium_recommendation_engine()
        result = engine.get_similar_products(product_id, limit=limit)
        return _format_response(result)
    except Exception as e:
        logger.error(f"Error getting similar products: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v2/complementary/{product_id}", response_model=RecommendationSetDTO)
async def get_complementary_products(
    product_id: int,
    limit: int = Query(default=6, ge=1, le=12)
):
    """
    Get products that complement the given product.

    Uses fashion outfit rules and color harmony for recommendations.
    Perfect for "Pour completer ce look" sections.
    """
    _check_engine()
    try:
        engine = get_premium_recommendation_engine()
        result = engine.get_complementary_products(product_id, limit=limit)
        return _format_response(result)
    except Exception as e:
        logger.error(f"Error getting complementary products: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v2/complete-look/{product_id}", response_model=RecommendationSetDTO)
async def get_complete_the_look(
    product_id: int,
    limit: int = Query(default=4, ge=2, le=6)
):
    """
    Get a complete outfit suggestion for the given product.

    Returns one item from each complementary category to create a full look.
    Perfect for "Le look complet" carousels.
    """
    _check_engine()
    try:
        engine = get_premium_recommendation_engine()
        result = engine.get_complete_the_look(product_id, limit=limit)
        return _format_response(result)
    except Exception as e:
        logger.error(f"Error getting complete look: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v2/premium-alternatives/{product_id}", response_model=RecommendationSetDTO)
async def get_premium_alternatives(
    product_id: int,
    limit: int = Query(default=4, ge=1, le=8)
):
    """
    Get more premium alternatives to the given product.

    Returns similar items at higher price points for upselling.
    Perfect for "Version premium" sections.
    """
    _check_engine()
    try:
        engine = get_premium_recommendation_engine()
        result = engine.get_premium_alternatives(product_id, limit=limit)
        return _format_response(result)
    except Exception as e:
        logger.error(f"Error getting premium alternatives: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v2/affordable-alternatives/{product_id}", response_model=RecommendationSetDTO)
async def get_affordable_alternatives(
    product_id: int,
    limit: int = Query(default=4, ge=1, le=8)
):
    """
    Get more affordable alternatives to the given product.

    Returns similar items at lower price points.
    Perfect for "Alternatives accessibles" sections.
    """
    _check_engine()
    try:
        engine = get_premium_recommendation_engine()
        result = engine.get_affordable_alternatives(product_id, limit=limit)
        return _format_response(result)
    except Exception as e:
        logger.error(f"Error getting affordable alternatives: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# HOMEPAGE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/v2/trending", response_model=RecommendationSetDTO)
async def get_trending_products(
    limit: int = Query(default=8, ge=1, le=20),
    family: Optional[str] = Query(default=None, description="Filter by family: WOMEN, MEN, KIDS")
):
    """
    Get trending/popular products.

    Returns currently popular items based on engagement.
    Perfect for "Tendances Barsha" homepage sections.
    """
    _check_engine()
    try:
        engine = get_premium_recommendation_engine()
        result = engine.get_trending_products(limit=limit, family=family)
        return _format_response(result)
    except Exception as e:
        logger.error(f"Error getting trending products: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v2/new-arrivals", response_model=RecommendationSetDTO)
async def get_new_arrivals(
    limit: int = Query(default=8, ge=1, le=20),
    family: Optional[str] = Query(default=None)
):
    """
    Get newest products in the catalog.

    Returns most recently added items.
    Perfect for "Nouveautes" homepage sections.
    """
    _check_engine()
    try:
        engine = get_premium_recommendation_engine()
        result = engine.get_new_arrivals(limit=limit, family=family)
        return _format_response(result)
    except Exception as e:
        logger.error(f"Error getting new arrivals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v2/seasonal", response_model=RecommendationSetDTO)
async def get_seasonal_picks(
    limit: int = Query(default=8, ge=1, le=20),
    family: Optional[str] = Query(default=None)
):
    """
    Get seasonally relevant products.

    Returns items appropriate for the current season.
    Perfect for "Selection de saison" homepage sections.
    """
    _check_engine()
    try:
        engine = get_premium_recommendation_engine()
        result = engine.get_seasonal_picks(limit=limit, family=family)
        return _format_response(result)
    except Exception as e:
        logger.error(f"Error getting seasonal picks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v2/editorial", response_model=RecommendationSetDTO)
async def get_editorial_selection(
    limit: int = Query(default=6, ge=1, le=12)
):
    """
    Get editorially curated selection.

    Returns hand-picked items from different categories.
    Perfect for "Selection editoriale" premium sections.
    """
    _check_engine()
    try:
        engine = get_premium_recommendation_engine()
        result = engine.get_editorial_selection(limit=limit)
        return _format_response(result)
    except Exception as e:
        logger.error(f"Error getting editorial selection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v2/personalized", response_model=RecommendationSetDTO)
async def get_personalized_recommendations(request: PersonalizedRequest):
    """
    Get personalized recommendations based on user behavior.

    Analyzes wishlist, orders, and browsing history.
    Perfect for "Selectionne pour vous" logged-in user sections.
    """
    _check_engine()
    try:
        engine = get_premium_recommendation_engine()
        user_context = {
            "wishlist": request.wishlist,
            "orders": request.orders,
            "viewed_products": request.viewedProducts
        }
        result = engine.get_personalized_recommendations(
            user_context=user_context,
            limit=request.limit
        )
        return _format_response(result)
    except Exception as e:
        logger.error(f"Error getting personalized recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# CART & CHECKOUT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/v2/cart-recommendations", response_model=RecommendationSetDTO)
async def get_cart_recommendations(request: CartRecommendationsRequest):
    """
    Get recommendations based on cart contents.

    Returns complementary items to complete the order.
    Perfect for "Pour completer votre commande" checkout sections.
    """
    _check_engine()
    try:
        engine = get_premium_recommendation_engine()
        result = engine.get_cart_recommendations(
            cart_product_ids=request.cartProductIds,
            limit=request.limit
        )
        return _format_response(result)
    except Exception as e:
        logger.error(f"Error getting cart recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# DISCOVERY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

class StyleEnum(str, Enum):
    casual = "casual"
    chic = "chic"
    sporty = "sporty"
    elegant = "elegant"
    bohemian = "bohemian"
    minimalist = "minimalist"
    trendy = "trendy"


@router.get("/v2/style/{style}", response_model=RecommendationSetDTO)
async def get_style_recommendations(
    style: StyleEnum,
    limit: int = Query(default=8, ge=1, le=20)
):
    """
    Get products matching a specific style profile.

    Returns items that match the selected aesthetic.
    Perfect for style discovery and profile-based sections.
    """
    _check_engine()
    try:
        engine = get_premium_recommendation_engine()
        style_profile = StyleProfile(style.value)
        result = engine.get_style_discovery(style=style_profile, limit=limit)
        return _format_response(result)
    except Exception as e:
        logger.error(f"Error getting style recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# MULTI-STRATEGY ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

class MultiRecommendationResponse(BaseModel):
    """Response containing multiple recommendation sets."""
    success: bool = True
    sets: Dict[str, RecommendationSetDTO]
    totalProcessingTimeMs: float


@router.post("/v2/multi", response_model=MultiRecommendationResponse)
async def get_multiple_recommendations(request: MultiRecommendationsRequest):
    """
    Get multiple recommendation sets in a single request.

    Optimized for loading all recommendations on a page at once.
    Specify which strategies you want in the request body.

    Available strategies:
    - similar, complementary, complete_the_look (require productId)
    - premium_alternative, affordable_alternative (require productId)
    - trending, new_arrivals, seasonal, editorial, personalized
    """
    _check_engine()

    engine = get_premium_recommendation_engine()
    results = {}
    total_time = 0

    for strategy in request.strategies:
        try:
            rec_set = None

            if strategy == "similar" and request.productId:
                rec_set = engine.get_similar_products(request.productId, limit=request.limit)
            elif strategy == "complementary" and request.productId:
                rec_set = engine.get_complementary_products(request.productId, limit=request.limit)
            elif strategy == "complete_the_look" and request.productId:
                rec_set = engine.get_complete_the_look(request.productId, limit=4)
            elif strategy == "premium_alternative" and request.productId:
                rec_set = engine.get_premium_alternatives(request.productId, limit=4)
            elif strategy == "affordable_alternative" and request.productId:
                rec_set = engine.get_affordable_alternatives(request.productId, limit=4)
            elif strategy == "trending":
                rec_set = engine.get_trending_products(limit=request.limit, family=request.family)
            elif strategy == "new_arrivals":
                rec_set = engine.get_new_arrivals(limit=request.limit, family=request.family)
            elif strategy == "seasonal":
                rec_set = engine.get_seasonal_picks(limit=request.limit, family=request.family)
            elif strategy == "editorial":
                rec_set = engine.get_editorial_selection(limit=6)

            if rec_set:
                results[strategy] = _format_response(rec_set)
                total_time += rec_set.processing_time_ms

        except Exception as e:
            logger.error(f"Error getting {strategy} recommendations: {e}")

    return MultiRecommendationResponse(
        success=True,
        sets=results,
        totalProcessingTimeMs=round(total_time, 2)
    )


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH & INFO
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/v2/health")
async def recommendations_health():
    """Check recommendation engine health and stats."""
    try:
        engine = get_premium_recommendation_engine()
        return {
            "status": "healthy",
            "catalogSize": len(engine.catalog),
            "indexes": {
                "categories": len(engine.category_index),
                "families": len(engine.family_index),
                "colors": len(engine.color_index),
                "priceTiers": len(engine.price_tier_index)
            },
            "strategies": [s.value for s in RecommendationStrategy],
            "version": "2.0.0"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }


# Export router
premium_recommendations_router = router
