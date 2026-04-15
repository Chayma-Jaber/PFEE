"""
Barsha AI Recommendation Engines
=================================
Provides multiple recommendation strategies for the Barsha e-commerce platform.
"""

from .recommendation_engine import (
    RecommendationEngine,
    get_recommendation_engine,
    RecommendationType,
    RecommendationResult,
    RecommendationResponse,
)

from .premium_recommendation_engine import (
    PremiumRecommendationEngine,
)

from .next_gen_recommendation_engine import (
    NextGenRecommendationEngine,
)

__all__ = [
    "RecommendationEngine",
    "get_recommendation_engine",
    "RecommendationType",
    "RecommendationResult",
    "RecommendationResponse",
    "PremiumRecommendationEngine",
    "NextGenRecommendationEngine",
]
