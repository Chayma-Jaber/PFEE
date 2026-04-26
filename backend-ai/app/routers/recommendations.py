"""
Barsha AI Recommendations API
=============================
Dedicated endpoints for intelligent product recommendations.

Endpoints:
- GET /api/recommendations/similar/{product_id}
- GET /api/recommendations/complementary/{product_id}
- POST /api/recommendations/personalized
- GET /api/recommendations/trending
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recommendations", tags=["AI Recommendations"])

# Import recommendation engine
try:
    from app.services.recommendation_engine import (
        get_recommendation_engine,
        RecommendationType,
        RecommendationResponse as EngineResponse
    )
    ENGINE_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Recommendation engine not available: {e}")
    ENGINE_AVAILABLE = False


class ProductRecommendation(BaseModel):
    """Single product recommendation."""
    id: int
    reference: str
    nom: str
    prix: str
    image: str
    url: str
    score: float
    reason: str  # Why this product is recommended


class RecommendationAPIResponse(BaseModel):
    """API response for recommendations."""
    success: bool
    strategy: str
    explanation: str
    products: List[ProductRecommendation]
    total_candidates: int


class PersonalizedRequest(BaseModel):
    """Request for personalized recommendations."""
    user_context: Optional[Dict[str, Any]] = None
    limit: int = 8


def _format_product(product_data: Dict, score: float, reason: str) -> ProductRecommendation:
    """Format a product dict into API response format."""
    pid = product_data.get("id", 0)

    # Handle image URL
    img = product_data.get("image") or product_data.get("firstImg") or ""
    if isinstance(img, dict):
        img = img.get("url") or (img.get("medium") or {}).get("url") or ""
    if img and not img.startswith("http"):
        img = f"https://barsha.com.tn/{img.lstrip('/')}"

    # Handle price
    prix = product_data.get("currentPrice") or product_data.get("prix") or product_data.get("price") or ""
    if prix and "TND" not in str(prix).upper():
        prix = f"{prix} TND"

    return ProductRecommendation(
        id=pid,
        reference=product_data.get("sku") or product_data.get("reference") or "",
        nom=product_data.get("nom") or product_data.get("title") or product_data.get("name") or "Article",
        prix=str(prix),
        image=img,
        url=f"https://barsha.com.tn/fr/produit/{pid}",
        score=round(score, 2),
        reason=reason
    )


def _engine_to_api_response(engine_resp: EngineResponse) -> RecommendationAPIResponse:
    """Convert engine response to API response."""
    products = []
    for rec in engine_resp.recommendations:
        products.append(_format_product(
            rec.product_data,
            rec.score,
            rec.reason
        ))

    return RecommendationAPIResponse(
        success=True,
        strategy=engine_resp.strategy_used.value,
        explanation=engine_resp.explanation,
        products=products,
        total_candidates=engine_resp.total_candidates
    )


@router.get("/similar/{product_id}", response_model=RecommendationAPIResponse)
async def get_similar_products(
    product_id: int,
    limit: int = Query(default=8, ge=1, le=20)
):
    """
    Get products similar to a given product.

    Uses intelligent matching based on:
    - Product category (tops, bottoms, etc.)
    - Target family (men, women, etc.)
    - Color availability
    - Price range

    Each recommendation includes a reason explaining why it's similar.
    """
    if not ENGINE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Recommendation engine not available")

    try:
        engine = get_recommendation_engine()
        result = engine.get_similar_products(product_id, limit=limit)
        return _engine_to_api_response(result)
    except Exception as e:
        logger.error(f"Error getting similar products: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/complementary/{product_id}", response_model=RecommendationAPIResponse)
async def get_complementary_products(
    product_id: int,
    limit: int = Query(default=6, ge=1, le=12)
):
    """
    Get products that complement the given product (outfit logic).

    Uses fashion-aware matching based on:
    - Cross-category outfit rules (tops go with bottoms, etc.)
    - Target family consistency
    - Color harmony rules

    Perfect for "Complete the Look" sections.
    """
    if not ENGINE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Recommendation engine not available")

    try:
        engine = get_recommendation_engine()
        result = engine.get_complementary_products(product_id, limit=limit)
        return _engine_to_api_response(result)
    except Exception as e:
        logger.error(f"Error getting complementary products: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/personalized", response_model=RecommendationAPIResponse)
async def get_personalized_recommendations(request: PersonalizedRequest):
    """
    Get personalized recommendations based on user behavior.

    Analyzes:
    - Wishlist items
    - Order history
    - Browsing patterns (if available)

    Returns products that match the user's demonstrated preferences.
    """
    if not ENGINE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Recommendation engine not available")

    try:
        engine = get_recommendation_engine()
        user_context = request.user_context or {}
        result = engine.get_personalized_recommendations(user_context, limit=request.limit)
        return _engine_to_api_response(result)
    except Exception as e:
        logger.error(f"Error getting personalized recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trending", response_model=RecommendationAPIResponse)
async def get_trending_products(
    limit: int = Query(default=8, ge=1, le=20)
):
    """
    Get trending/popular products.

    Fallback recommendation strategy for users without history.
    """
    if not ENGINE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Recommendation engine not available")

    try:
        engine = get_recommendation_engine()
        result = engine._get_trending_recommendations(limit=limit)
        return _engine_to_api_response(result)
    except Exception as e:
        logger.error(f"Error getting trending products: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Export router
recommendations_router = router
