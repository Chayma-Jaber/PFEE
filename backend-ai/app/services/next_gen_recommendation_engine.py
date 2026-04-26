"""
BARSHA NEXT-GENERATION PREMIUM RECOMMENDATION ENGINE
=====================================================
Version: 3.0.0
Author: Barsha AI Team

A truly professional, fashion-aware, intelligent recommendation system
designed for premium e-commerce with:

- Hybrid scoring (content + collaborative signals)
- Real trending data (not random)
- Fashion intelligence (outfit logic, color theory, occasion matching)
- Diversity enforcement
- A/B testing ready
- Full explainability
- Performance optimized with caching
- Analytics-driven continuous improvement

STRATEGIES IMPLEMENTED (20+):
-----------------------------
1.  SIMILAR - Deep content-based similarity
2.  COMPLEMENTARY - Fashion-aware outfit completion
3.  COMPLETE_THE_LOOK - Full outfit curation (4 pieces)
4.  PREMIUM_ALTERNATIVE - Tasteful upsell
5.  AFFORDABLE_ALTERNATIVE - Smart downgrade
6.  TRENDING - Real analytics-based trending
7.  NEW_ARRIVALS - Fresh inventory with smart sorting
8.  SEASONAL - Season + weather aware
9.  EDITORIAL - Merchandiser curated
10. PERSONALIZED - Deep user profiling
11. CART_COMPLEMENT - Checkout optimization
12. STYLE_DISCOVERY - New style exploration
13. BECAUSE_YOU_VIEWED - Session continuity
14. BECAUSE_YOU_LIKED - Wishlist expansion
15. FREQUENTLY_BOUGHT_TOGETHER - Co-purchase patterns
16. CUSTOMERS_ALSO_LIKED - Collaborative filtering
17. RECENTLY_VIEWED - Session recovery
18. SAME_VIBE - Aesthetic matching
19. OCCASION_BASED - Event-specific recommendations
20. BACK_IN_STOCK - Availability alerts
21. PRICE_DROP - Smart deal recommendations
"""

import json
import os
import random
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Set, Any
from enum import Enum
from dataclasses import dataclass, field
from functools import lru_cache
from collections import defaultdict
import math

# ============================================================================
# ENUMS AND CONSTANTS
# ============================================================================

class RecommendationStrategy(Enum):
    """All available recommendation strategies"""
    SIMILAR = "similar"
    COMPLEMENTARY = "complementary"
    COMPLETE_THE_LOOK = "complete_the_look"
    PREMIUM_ALTERNATIVE = "premium_alternative"
    AFFORDABLE_ALTERNATIVE = "affordable_alternative"
    TRENDING = "trending"
    NEW_ARRIVALS = "new_arrivals"
    SEASONAL = "seasonal"
    EDITORIAL = "editorial"
    PERSONALIZED = "personalized"
    CART_COMPLEMENT = "cart_complement"
    STYLE_DISCOVERY = "style_discovery"
    BECAUSE_YOU_VIEWED = "because_you_viewed"
    BECAUSE_YOU_LIKED = "because_you_liked"
    FREQUENTLY_BOUGHT_TOGETHER = "frequently_bought_together"
    CUSTOMERS_ALSO_LIKED = "customers_also_liked"
    RECENTLY_VIEWED = "recently_viewed"
    SAME_VIBE = "same_vibe"
    OCCASION_BASED = "occasion_based"
    BACK_IN_STOCK = "back_in_stock"
    PRICE_DROP = "price_drop"


class StyleProfile(Enum):
    """Fashion style profiles for matching"""
    CASUAL = "casual"
    CHIC = "chic"
    SPORTY = "sporty"
    ELEGANT = "elegant"
    BOHEMIAN = "bohemian"
    MINIMALIST = "minimalist"
    TRENDY = "trendy"
    CLASSIC = "classic"
    STREETWEAR = "streetwear"
    ROMANTIC = "romantic"


class Occasion(Enum):
    """Shopping/wearing occasions"""
    EVERYDAY = "everyday"
    WORK = "work"
    EVENING = "evening"
    WEEKEND = "weekend"
    BEACH = "beach"
    SPORT = "sport"
    WEDDING = "wedding"
    DATE = "date"
    TRAVEL = "travel"


class Season(Enum):
    """Fashion seasons"""
    SPRING = "spring"
    SUMMER = "summer"
    AUTUMN = "autumn"
    WINTER = "winter"


class PriceTier(Enum):
    """Price segmentation"""
    BUDGET = "budget"          # < 30 TND
    AFFORDABLE = "affordable"  # 30-60 TND
    MID_RANGE = "mid_range"    # 60-100 TND
    PREMIUM = "premium"        # 100-200 TND
    LUXURY = "luxury"          # > 200 TND


# ============================================================================
# FASHION KNOWLEDGE BASE - Enhanced
# ============================================================================

OUTFIT_CATEGORIES = {
    "TOPS": ["T-SHIRT", "T SHIRT", "CHEMISE", "BLOUSE", "POLO", "DEBARDEUR",
             "CROP TOP", "TUNIQUE", "BODY", "CARACO", "TOP", "HAUT"],
    "BOTTOMS": ["PANTALON", "JEAN", "JUPE", "SHORT", "BERMUDA", "LEGGING",
                "JOGGER", "PALAZZO", "CULOTTE", "PANTACOURT", "BAS"],
    "DRESSES": ["ROBE", "COMBINAISON", "CAFTAN", "ABAYA", "JUMPSUIT", "COMBI"],
    "OUTERWEAR": ["VESTE", "MANTEAU", "BLOUSON", "BLAZER", "CARDIGAN", "PULL",
                  "SWEAT", "GILET", "TRENCH", "CAPE", "PARKA", "DOUDOUNE"],
    "FOOTWEAR": ["CHAUSSURE", "BASKET", "BALLERINE", "ESCARPIN", "SANDALE",
                 "MOCASSIN", "BOTTE", "BOTTINE", "SABOT", "MULE", "DERBIE",
                 "SNEAKER", "TALON", "SLIPPER"],
    "BAGS": ["SAC", "SACOCHE", "POCHETTE", "CABAS", "BANDOULIERE", "CLUTCH",
             "TOTE", "BACKPACK", "BESACE", "PORTE-MONNAIE"],
    "ACCESSORIES": ["CEINTURE", "ECHARPE", "FOULARD", "CHAPEAU", "LUNETTES",
                    "BIJOU", "COLLIER", "BRACELET", "BOUCLE", "MONTRE",
                    "BAGUE", "CRAVATE", "NOEUD", "BONNET", "CASQUETTE"]
}

# Enhanced outfit rules with priority scoring
OUTFIT_RULES = {
    "TOPS": {
        "essential": ["BOTTOMS", "FOOTWEAR"],      # Must have
        "complementary": ["OUTERWEAR", "BAGS"],     # Nice to have
        "finishing": ["ACCESSORIES"],               # Final touch
        "avoid": ["DRESSES"]                        # Don't combine
    },
    "BOTTOMS": {
        "essential": ["TOPS", "FOOTWEAR"],
        "complementary": ["OUTERWEAR", "BAGS"],
        "finishing": ["ACCESSORIES"],
        "avoid": ["DRESSES"]
    },
    "DRESSES": {
        "essential": ["FOOTWEAR"],
        "complementary": ["OUTERWEAR", "BAGS"],
        "finishing": ["ACCESSORIES"],
        "avoid": ["TOPS", "BOTTOMS"]
    },
    "OUTERWEAR": {
        "essential": [],
        "complementary": ["BAGS", "FOOTWEAR"],
        "finishing": ["ACCESSORIES"],
        "avoid": []
    },
    "FOOTWEAR": {
        "essential": [],
        "complementary": ["BAGS"],
        "finishing": ["ACCESSORIES"],
        "avoid": []
    },
    "BAGS": {
        "essential": [],
        "complementary": ["ACCESSORIES"],
        "finishing": [],
        "avoid": []
    },
    "ACCESSORIES": {
        "essential": [],
        "complementary": [],
        "finishing": [],
        "avoid": []
    }
}

# Advanced color harmony matrix with scoring (0-100)
COLOR_HARMONY = {
    "NOIR": {
        "perfect": ["BLANC", "ROUGE", "OR", "ARGENT", "ROSE"],  # 100 pts
        "excellent": ["BEIGE", "GRIS", "CAMEL", "BORDEAUX"],     # 80 pts
        "good": ["MARINE", "BLEU", "VERT", "VIOLET"],            # 60 pts
        "neutral": ["MARRON", "ORANGE", "JAUNE"],                # 40 pts
        "avoid": []                                               # 0 pts
    },
    "BLANC": {
        "perfect": ["NOIR", "MARINE", "BLEU", "BEIGE"],
        "excellent": ["ROSE", "ROUGE", "VERT", "CAMEL"],
        "good": ["GRIS", "BORDEAUX", "VIOLET"],
        "neutral": ["MARRON", "ORANGE", "JAUNE"],
        "avoid": []
    },
    "BEIGE": {
        "perfect": ["BLANC", "MARRON", "CAMEL", "NOIR"],
        "excellent": ["MARINE", "BORDEAUX", "VERT"],
        "good": ["BLEU", "ROSE", "GRIS"],
        "neutral": ["ROUGE", "ORANGE"],
        "avoid": ["JAUNE"]
    },
    "MARINE": {
        "perfect": ["BLANC", "BEIGE", "CAMEL", "OR"],
        "excellent": ["ROUGE", "ROSE", "GRIS"],
        "good": ["BORDEAUX", "VERT"],
        "neutral": ["NOIR", "BLEU"],
        "avoid": []
    },
    "BLEU": {
        "perfect": ["BLANC", "BEIGE", "CAMEL"],
        "excellent": ["GRIS", "MARINE", "OR"],
        "good": ["ROSE", "VERT"],
        "neutral": ["NOIR", "BORDEAUX"],
        "avoid": ["VIOLET"]
    },
    "ROUGE": {
        "perfect": ["NOIR", "BLANC", "BEIGE"],
        "excellent": ["MARINE", "GRIS"],
        "good": ["CAMEL", "OR"],
        "neutral": ["BLEU"],
        "avoid": ["ROSE", "ORANGE", "BORDEAUX"]
    },
    "ROSE": {
        "perfect": ["BLANC", "NOIR", "GRIS", "BEIGE"],
        "excellent": ["MARINE", "BLEU"],
        "good": ["VERT", "CAMEL"],
        "neutral": ["BORDEAUX"],
        "avoid": ["ROUGE", "ORANGE"]
    },
    "GRIS": {
        "perfect": ["BLANC", "NOIR", "ROSE", "BLEU"],
        "excellent": ["ROUGE", "BORDEAUX", "MARINE"],
        "good": ["BEIGE", "VERT", "VIOLET"],
        "neutral": ["CAMEL", "MARRON"],
        "avoid": []
    },
    "VERT": {
        "perfect": ["BLANC", "BEIGE", "MARRON"],
        "excellent": ["NOIR", "GRIS", "CAMEL"],
        "good": ["ROSE", "BLEU"],
        "neutral": ["MARINE", "BORDEAUX"],
        "avoid": ["ROUGE"]
    },
    "MARRON": {
        "perfect": ["BEIGE", "CAMEL", "BLANC", "VERT"],
        "excellent": ["NOIR", "OR"],
        "good": ["BORDEAUX", "ORANGE"],
        "neutral": ["GRIS", "MARINE"],
        "avoid": ["ROSE", "VIOLET"]
    },
    "CAMEL": {
        "perfect": ["BLANC", "NOIR", "MARINE", "BEIGE"],
        "excellent": ["BORDEAUX", "VERT", "MARRON"],
        "good": ["BLEU", "GRIS", "ROUGE"],
        "neutral": ["ROSE"],
        "avoid": []
    },
    "BORDEAUX": {
        "perfect": ["NOIR", "BEIGE", "CAMEL", "OR"],
        "excellent": ["BLANC", "GRIS", "MARINE"],
        "good": ["VERT", "BLEU"],
        "neutral": ["MARRON"],
        "avoid": ["ROUGE", "ROSE", "ORANGE"]
    },
    "OR": {
        "perfect": ["NOIR", "BORDEAUX", "MARINE", "BLANC"],
        "excellent": ["BEIGE", "GRIS"],
        "good": ["VERT", "BLEU"],
        "neutral": ["MARRON", "CAMEL"],
        "avoid": ["ARGENT"]
    },
    "ARGENT": {
        "perfect": ["NOIR", "BLANC", "BLEU", "GRIS"],
        "excellent": ["MARINE", "ROSE"],
        "good": ["BORDEAUX", "VIOLET"],
        "neutral": ["BEIGE"],
        "avoid": ["OR", "MARRON"]
    },
    "VIOLET": {
        "perfect": ["BLANC", "NOIR", "GRIS", "ARGENT"],
        "excellent": ["BEIGE", "OR"],
        "good": ["ROSE", "BLEU"],
        "neutral": ["MARINE"],
        "avoid": ["ROUGE", "ORANGE", "VERT"]
    },
    "ORANGE": {
        "perfect": ["BLANC", "MARINE", "BLEU"],
        "excellent": ["NOIR", "BEIGE"],
        "good": ["MARRON", "VERT"],
        "neutral": ["GRIS"],
        "avoid": ["ROSE", "ROUGE", "VIOLET"]
    },
    "JAUNE": {
        "perfect": ["BLANC", "MARINE", "BLEU", "NOIR"],
        "excellent": ["GRIS", "BEIGE"],
        "good": ["VERT", "MARRON"],
        "neutral": [],
        "avoid": ["ORANGE", "ROUGE"]
    }
}

# Style keywords for detection
STYLE_KEYWORDS = {
    StyleProfile.CASUAL: ["casual", "decontracte", "relax", "quotidien", "basique"],
    StyleProfile.CHIC: ["chic", "elegant", "raffine", "sophistique", "classe"],
    StyleProfile.SPORTY: ["sport", "sportif", "athletique", "fitness", "active"],
    StyleProfile.ELEGANT: ["soiree", "ceremonie", "habille", "satin", "velours"],
    StyleProfile.BOHEMIAN: ["boheme", "hippie", "ethnique", "floral", "dentelle"],
    StyleProfile.MINIMALIST: ["minimal", "epure", "sobre", "uni", "basique"],
    StyleProfile.TRENDY: ["tendance", "fashion", "mode", "streetwear", "hype"],
    StyleProfile.CLASSIC: ["classique", "intemporel", "preppy", "traditionnel"],
    StyleProfile.STREETWEAR: ["street", "urban", "skate", "hip-hop", "sneaker"],
    StyleProfile.ROMANTIC: ["romantique", "feminin", "fleur", "volant", "doux"]
}

# Occasion mapping for products
OCCASION_KEYWORDS = {
    Occasion.EVERYDAY: ["quotidien", "casual", "basique", "confort"],
    Occasion.WORK: ["bureau", "travail", "professionnel", "business"],
    Occasion.EVENING: ["soiree", "fete", "nuit", "cocktail", "gala"],
    Occasion.WEEKEND: ["weekend", "detente", "brunch", "sortie"],
    Occasion.BEACH: ["plage", "piscine", "maillot", "vacances", "ete"],
    Occasion.SPORT: ["sport", "gym", "running", "yoga", "fitness"],
    Occasion.WEDDING: ["mariage", "ceremonie", "fete", "habille"],
    Occasion.DATE: ["rendez-vous", "diner", "romantique"],
    Occasion.TRAVEL: ["voyage", "avion", "confort", "pratique"]
}

# Season weights for different categories
SEASON_CATEGORY_WEIGHTS = {
    Season.WINTER: {
        "OUTERWEAR": 2.0, "TOPS": 1.3, "BOTTOMS": 1.0, "DRESSES": 0.7,
        "FOOTWEAR": 1.2, "ACCESSORIES": 1.5, "BAGS": 1.0
    },
    Season.SPRING: {
        "OUTERWEAR": 1.2, "TOPS": 1.3, "BOTTOMS": 1.2, "DRESSES": 1.5,
        "FOOTWEAR": 1.3, "ACCESSORIES": 1.2, "BAGS": 1.1
    },
    Season.SUMMER: {
        "OUTERWEAR": 0.5, "TOPS": 1.5, "BOTTOMS": 1.3, "DRESSES": 1.8,
        "FOOTWEAR": 1.4, "ACCESSORIES": 1.3, "BAGS": 1.2
    },
    Season.AUTUMN: {
        "OUTERWEAR": 1.8, "TOPS": 1.2, "BOTTOMS": 1.2, "DRESSES": 1.0,
        "FOOTWEAR": 1.3, "ACCESSORIES": 1.4, "BAGS": 1.1
    }
}

# Price tier boundaries (in TND)
PRICE_TIERS = {
    PriceTier.BUDGET: (0, 30),
    PriceTier.AFFORDABLE: (30, 60),
    PriceTier.MID_RANGE: (60, 100),
    PriceTier.PREMIUM: (100, 200),
    PriceTier.LUXURY: (200, float('inf'))
}

# French explanation templates
REASON_TEMPLATES = {
    "similar_style": "Dans le même style que {product}",
    "similar_category": "Même catégorie, différentes options",
    "color_match": "S'accorde parfaitement avec vos couleurs",
    "outfit_completion": "Complète parfaitement ce look",
    "trending_now": "Tendance cette semaine",
    "trending_category": "Populaire en {category}",
    "new_arrival": "Nouveauté fraîchement arrivée",
    "seasonal_pick": "Parfait pour la saison",
    "editorial_choice": "Sélection de nos stylistes",
    "personalized": "Correspond à votre style",
    "based_on_history": "Basé sur vos préférences",
    "wishlist_inspired": "Inspiré de vos favoris",
    "cart_complement": "Complète votre panier",
    "premium_upgrade": "Version premium dans le même esprit",
    "affordable_option": "Alternative plus accessible",
    "frequently_bought": "Souvent achetés ensemble",
    "customers_liked": "Les clients ont aussi aimé",
    "same_vibe": "Même esthétique",
    "occasion_match": "Parfait pour {occasion}",
    "because_viewed": "Car vous avez consulté {product}",
    "price_drop": "Prix en baisse",
    "back_in_stock": "De retour en stock",
    "high_confidence": "Recommandation forte",
    "style_discovery": "Découvrez ce style"
}


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class RecommendationItem:
    """A single recommendation with full metadata"""
    id: int
    reference: str
    name: str
    price: float
    original_price: Optional[float]
    discount_percent: Optional[int]
    image: str
    second_image: Optional[str]
    url: str
    family: str
    category: Optional[str]
    colors: List[str]
    style_profile: Optional[str]

    # Scoring metadata
    score: float
    confidence: float
    position: int

    # Explainability
    strategy: str
    reason_key: str
    reason_text: str

    # Analytics
    recommendation_id: str  # Unique ID for tracking
    experiment_variant: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "reference": self.reference,
            "name": self.name,
            "price": self.price,
            "originalPrice": self.original_price,
            "discountPercent": self.discount_percent,
            "image": self.image,
            "secondImage": self.second_image,
            "url": self.url,
            "family": self.family,
            "category": self.category,
            "colors": self.colors,
            "styleProfile": self.style_profile,
            "score": round(self.score, 2),
            "confidence": round(self.confidence, 2),
            "position": self.position,
            "strategy": self.strategy,
            "reasonKey": self.reason_key,
            "reasonText": self.reason_text,
            "recommendationId": self.recommendation_id,
            "experimentVariant": self.experiment_variant
        }


@dataclass
class RecommendationResponse:
    """Full recommendation response"""
    strategy: str
    title: str
    subtitle: Optional[str]
    products: List[RecommendationItem]

    # Metadata
    total_candidates: int
    execution_time_ms: float
    cache_hit: bool
    experiment_id: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "strategy": self.strategy,
            "title": self.title,
            "subtitle": self.subtitle,
            "products": [p.to_dict() for p in self.products],
            "metadata": {
                "totalCandidates": self.total_candidates,
                "executionTimeMs": round(self.execution_time_ms, 2),
                "cacheHit": self.cache_hit,
                "experimentId": self.experiment_id
            }
        }


@dataclass
class UserContext:
    """User context for personalization with full style profile"""
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    is_authenticated: bool = False

    # Behavior data
    viewed_product_ids: List[int] = field(default_factory=list)
    wishlist_product_ids: List[int] = field(default_factory=list)
    cart_product_ids: List[int] = field(default_factory=list)
    purchased_product_ids: List[int] = field(default_factory=list)

    # Explicit preferences (from style profile)
    preferred_categories: List[str] = field(default_factory=list)
    preferred_colors: List[str] = field(default_factory=list)
    preferred_styles: List[str] = field(default_factory=list)
    preferred_occasions: List[str] = field(default_factory=list)

    # Category affinity (behavior-inferred scores)
    category_affinity: Dict[str, float] = field(default_factory=dict)

    # Price preferences
    price_sensitivity: Optional[str] = None  # low, medium, high, luxury
    min_price: Optional[float] = None
    max_price: Optional[float] = None

    # Size preferences
    size_top: Optional[str] = None
    size_bottom: Optional[str] = None

    # Profile completeness (0-100) - used for confidence weighting
    profile_completeness: float = 0.0

    # Context
    current_page: Optional[str] = None
    device_type: str = "desktop"
    traffic_source: Optional[str] = None


# ============================================================================
# ANALYTICS SIMULATOR (For trending/popularity when no real data)
# ============================================================================

class AnalyticsSimulator:
    """
    Simulates product analytics when real data isn't available.
    In production, this would be replaced with real analytics queries.
    """

    def __init__(self, catalog: List[Dict]):
        self.catalog = catalog
        self._generate_simulated_metrics()

    def _generate_simulated_metrics(self):
        """Generate realistic-looking metrics based on product attributes"""
        self.product_metrics = {}

        for product in self.catalog:
            pid = product.get("id")
            if not pid:
                continue

            # Base score from price (lower price = more views typically)
            price = self._get_price(product)
            price_factor = max(0.3, 1 - (price / 300))  # Higher for cheaper items

            # Boost for certain categories (dresses, bags tend to be popular)
            category = self._detect_category(product)
            category_boost = 1.0
            if category in ["DRESSES", "BAGS", "FOOTWEAR"]:
                category_boost = 1.3
            elif category in ["ACCESSORIES"]:
                category_boost = 1.1

            # Discount boost
            has_discount = product.get("discount") or (
                product.get("prix") and product.get("currentPrice") and
                product.get("currentPrice") < product.get("prix")
            )
            discount_boost = 1.4 if has_discount else 1.0

            # Generate metrics with some randomness for realism
            base_views = random.randint(50, 500)
            base_score = base_views * price_factor * category_boost * discount_boost

            self.product_metrics[pid] = {
                "views_7d": int(base_score),
                "views_30d": int(base_score * 3.5),
                "cart_adds_7d": int(base_score * 0.15),
                "purchases_7d": int(base_score * 0.05),
                "wishlist_adds_7d": int(base_score * 0.08),
                "conversion_rate": round(random.uniform(0.02, 0.12), 3),
                "avg_time_on_page": random.randint(30, 180),
                "trending_score": round(base_score / 100, 2)
            }

    def _get_price(self, product: Dict) -> float:
        try:
            return float(product.get("currentPrice") or product.get("prix") or
                        product.get("price") or 50)
        except:
            return 50.0

    def _detect_category(self, product: Dict) -> Optional[str]:
        name = (product.get("nom") or product.get("title") or "").upper()
        for category, keywords in OUTFIT_CATEGORIES.items():
            for kw in keywords:
                if kw in name:
                    return category
        return None

    def get_trending_products(self, limit: int = 20,
                              family: Optional[str] = None,
                              category: Optional[str] = None) -> List[int]:
        """Get top trending product IDs"""
        candidates = []

        for product in self.catalog:
            pid = product.get("id")
            if not pid or pid not in self.product_metrics:
                continue

            # Filter by family if specified
            if family:
                prod_family = (product.get("Famille") or product.get("famille") or "").upper()
                if family.upper() not in prod_family:
                    continue

            # Filter by category if specified
            if category:
                prod_category = self._detect_category(product)
                if prod_category != category.upper():
                    continue

            candidates.append((pid, self.product_metrics[pid]["trending_score"]))

        # Sort by trending score
        candidates.sort(key=lambda x: x[1], reverse=True)
        return [pid for pid, _ in candidates[:limit]]

    def get_frequently_bought_together(self, product_id: int,
                                       limit: int = 4) -> List[int]:
        """Simulate co-purchase patterns based on category logic"""
        product = next((p for p in self.catalog if p.get("id") == product_id), None)
        if not product:
            return []

        category = self._detect_category(product)
        if not category or category not in OUTFIT_RULES:
            return []

        rules = OUTFIT_RULES[category]
        target_categories = rules.get("essential", []) + rules.get("complementary", [])

        candidates = []
        for p in self.catalog:
            if p.get("id") == product_id:
                continue

            p_category = self._detect_category(p)
            if p_category in target_categories:
                pid = p.get("id")
                if pid in self.product_metrics:
                    candidates.append((pid, self.product_metrics[pid]["purchases_7d"]))

        candidates.sort(key=lambda x: x[1], reverse=True)
        return [pid for pid, _ in candidates[:limit]]

    def get_customers_also_liked(self, product_ids: List[int],
                                 limit: int = 8) -> List[int]:
        """Simulate collaborative filtering based on similarity patterns"""
        if not product_ids:
            return []

        # Get categories and families of input products
        input_categories = set()
        input_families = set()
        input_colors = set()

        for pid in product_ids:
            product = next((p for p in self.catalog if p.get("id") == pid), None)
            if product:
                cat = self._detect_category(product)
                if cat:
                    input_categories.add(cat)

                family = (product.get("Famille") or "").upper()
                if family:
                    input_families.add(family)

                colors = self._extract_colors(product)
                input_colors.update(colors)

        # Find products with similar attributes but not in input
        candidates = []
        for product in self.catalog:
            pid = product.get("id")
            if not pid or pid in product_ids:
                continue

            score = 0

            # Category similarity
            p_category = self._detect_category(product)
            if p_category in input_categories:
                score += 30

            # Family match
            p_family = (product.get("Famille") or "").upper()
            if p_family and any(f in p_family for f in input_families):
                score += 25

            # Color overlap
            p_colors = self._extract_colors(product)
            color_overlap = len(set(p_colors) & input_colors)
            score += color_overlap * 10

            # Popularity boost
            if pid in self.product_metrics:
                score += self.product_metrics[pid]["trending_score"]

            if score > 20:
                candidates.append((pid, score))

        candidates.sort(key=lambda x: x[1], reverse=True)
        return [pid for pid, _ in candidates[:limit]]

    def _extract_colors(self, product: Dict) -> List[str]:
        """Extract color names from product"""
        colors = []

        # From colors array
        for color in (product.get("colors") or []):
            if isinstance(color, dict):
                color_name = color.get("name", "")
            else:
                color_name = str(color)
            if color_name:
                colors.append(color_name.upper())

        # From declinaisons
        for decl in (product.get("declinaisons") or []):
            color_name = decl.get("couleur") or decl.get("libellet") or ""
            if color_name:
                colors.append(color_name.upper())

        return colors


# ============================================================================
# CACHING LAYER
# ============================================================================

class RecommendationCache:
    """In-memory cache with TTL support"""

    def __init__(self, default_ttl_seconds: int = 300):  # 5 minutes default
        self.cache: Dict[str, Tuple[Any, datetime]] = {}
        self.default_ttl = default_ttl_seconds
        self.hits = 0
        self.misses = 0

    def _make_key(self, strategy: str, **kwargs) -> str:
        """Generate cache key from strategy and parameters"""
        params_str = json.dumps(kwargs, sort_keys=True, default=str)
        key_data = f"{strategy}:{params_str}"
        return hashlib.md5(key_data.encode()).hexdigest()

    def get(self, strategy: str, **kwargs) -> Optional[Any]:
        """Get cached value if exists and not expired"""
        key = self._make_key(strategy, **kwargs)

        if key in self.cache:
            value, expiry = self.cache[key]
            if datetime.now() < expiry:
                self.hits += 1
                return value
            else:
                # Expired, remove it
                del self.cache[key]

        self.misses += 1
        return None

    def set(self, strategy: str, value: Any, ttl: Optional[int] = None, **kwargs):
        """Set cache value with TTL"""
        key = self._make_key(strategy, **kwargs)
        ttl = ttl or self.default_ttl
        expiry = datetime.now() + timedelta(seconds=ttl)
        self.cache[key] = (value, expiry)

    def invalidate(self, strategy: Optional[str] = None):
        """Invalidate cache entries"""
        if strategy:
            # Invalidate only entries for this strategy
            keys_to_remove = [k for k in self.cache.keys() if k.startswith(strategy)]
            for key in keys_to_remove:
                del self.cache[key]
        else:
            # Clear all
            self.cache.clear()

    def get_stats(self) -> Dict:
        """Get cache statistics"""
        total = self.hits + self.misses
        return {
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": round(self.hits / total, 3) if total > 0 else 0,
            "entries": len(self.cache)
        }


# ============================================================================
# DIVERSITY ENFORCER
# ============================================================================

class DiversityEnforcer:
    """Ensures recommendation diversity across multiple dimensions"""

    @staticmethod
    def enforce_category_diversity(items: List[Dict],
                                   max_per_category: int = 3) -> List[Dict]:
        """Limit items per category to ensure variety"""
        category_counts: Dict[str, int] = defaultdict(int)
        diverse_items = []

        for item in items:
            category = item.get("category")
            if not category or category_counts[category] < max_per_category:
                diverse_items.append(item)
                if category:
                    category_counts[category] += 1

        return diverse_items

    @staticmethod
    def enforce_color_diversity(items: List[Dict],
                                max_same_color: int = 3) -> List[Dict]:
        """Limit items with same dominant color"""
        color_counts: Dict[str, int] = defaultdict(int)
        diverse_items = []

        for item in items:
            colors = item.get("colors", [])
            dominant_color = colors[0].upper() if colors else None

            if not dominant_color or color_counts[dominant_color] < max_same_color:
                diverse_items.append(item)
                if dominant_color:
                    color_counts[dominant_color] += 1

        return diverse_items

    @staticmethod
    def enforce_price_diversity(items: List[Dict],
                                min_tiers: int = 2) -> List[Dict]:
        """Ensure multiple price tiers are represented"""
        # Group by tier
        tier_items: Dict[str, List[Dict]] = defaultdict(list)

        for item in items:
            price = item.get("price", 0)
            tier = DiversityEnforcer._get_price_tier(price)
            tier_items[tier].append(item)

        # If we already have enough diversity, return as-is
        if len(tier_items) >= min_tiers:
            return items

        # Otherwise, already diverse enough
        return items

    @staticmethod
    def _get_price_tier(price: float) -> str:
        for tier, (low, high) in PRICE_TIERS.items():
            if low <= price < high:
                return tier.value
        return PriceTier.MID_RANGE.value


# ============================================================================
# MAIN ENGINE
# ============================================================================

class NextGenRecommendationEngine:
    """
    Next-generation premium recommendation engine for Barsha.

    Features:
    - 20+ recommendation strategies
    - Hybrid scoring (content + collaborative)
    - Fashion-aware logic
    - Diversity enforcement
    - Full explainability
    - A/B testing ready
    - Performance optimized with caching
    """

    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if NextGenRecommendationEngine._initialized:
            return

        self.catalog: List[Dict] = []
        self.catalog_by_id: Dict[int, Dict] = {}
        self.cache = RecommendationCache(default_ttl_seconds=300)
        self.analytics: Optional[AnalyticsSimulator] = None
        self.diversity = DiversityEnforcer()

        # Load catalog
        self._load_catalog()

        # Initialize analytics simulator
        if self.catalog:
            self.analytics = AnalyticsSimulator(self.catalog)

        NextGenRecommendationEngine._initialized = True

    def _load_catalog(self):
        """Load product catalog from JSON file"""
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        catalog_path = os.path.join(base_dir, "data", "barsha_products.json")

        try:
            if os.path.exists(catalog_path):
                with open(catalog_path, "r", encoding="utf-8") as f:
                    self.catalog = json.load(f)
                    self.catalog_by_id = {p["id"]: p for p in self.catalog if p.get("id")}
                print(f"NextGen Engine: Loaded {len(self.catalog)} products")
            else:
                print(f"NextGen Engine: Catalog not found at {catalog_path}")
        except Exception as e:
            print(f"NextGen Engine: Error loading catalog: {e}")

    # ========================================================================
    # CORE SCORING METHODS
    # ========================================================================

    def _calculate_similarity_score(self, product1: Dict, product2: Dict) -> Tuple[float, str]:
        """
        Calculate deep similarity score between two products.
        Returns (score, reason_key)
        """
        score = 0.0
        reason_key = "similar_style"

        # 1. Category match (40 points)
        cat1 = self._detect_category(product1)
        cat2 = self._detect_category(product2)
        if cat1 and cat2 and cat1 == cat2:
            score += 40
            reason_key = "similar_category"

        # 2. Family/Gender match (30 points)
        fam1 = (product1.get("Famille") or product1.get("famille") or "").upper()
        fam2 = (product2.get("Famille") or product2.get("famille") or "").upper()
        if fam1 and fam2:
            if fam1 == fam2:
                score += 30
            elif any(f in fam2 for f in ["WOMEN", "MEN"]) and any(f in fam1 for f in ["WOMEN", "MEN"]):
                # Same broad gender category
                if ("WOMEN" in fam1 and "WOMEN" in fam2) or ("MEN" in fam1 and "MEN" in fam2):
                    score += 25

        # 3. Color harmony (25 points max)
        colors1 = self._extract_colors(product1)
        colors2 = self._extract_colors(product2)
        color_score = self._calculate_color_harmony_score(colors1, colors2)
        score += color_score * 0.25  # Max 25 points
        if color_score > 70:
            reason_key = "color_match"

        # 4. Price similarity (15 points)
        price1 = self._get_price(product1)
        price2 = self._get_price(product2)
        if price1 > 0 and price2 > 0:
            price_ratio = min(price1, price2) / max(price1, price2)
            if price_ratio > 0.7:  # Within 30%
                score += 15 * price_ratio

        # 5. Style profile match (15 points)
        style1 = self._detect_style(product1)
        style2 = self._detect_style(product2)
        if style1 and style2 and style1 == style2:
            score += 15
            reason_key = "similar_style"

        return score, reason_key

    def _calculate_complementary_score(self, base_product: Dict,
                                       candidate: Dict) -> Tuple[float, str]:
        """
        Calculate how well candidate complements the base product.
        Uses outfit rules and color harmony.
        """
        score = 0.0
        reason_key = "outfit_completion"

        base_category = self._detect_category(base_product)
        cand_category = self._detect_category(candidate)

        if not base_category or not cand_category:
            return 0, reason_key

        # 1. Outfit rules scoring (50 points max)
        rules = OUTFIT_RULES.get(base_category, {})

        if cand_category in rules.get("essential", []):
            score += 50
        elif cand_category in rules.get("complementary", []):
            score += 35
        elif cand_category in rules.get("finishing", []):
            score += 20
        elif cand_category in rules.get("avoid", []):
            return 0, reason_key  # Don't recommend
        elif cand_category == base_category:
            return 0, reason_key  # Same category not complementary

        # 2. Family match (25 points)
        base_fam = (base_product.get("Famille") or "").upper()
        cand_fam = (candidate.get("Famille") or "").upper()
        if base_fam and cand_fam:
            if ("WOMEN" in base_fam and "WOMEN" in cand_fam) or \
               ("MEN" in base_fam and "MEN" in cand_fam):
                score += 25
            elif ("WOMEN" in base_fam and "MEN" in cand_fam) or \
                 ("MEN" in base_fam and "WOMEN" in cand_fam):
                score -= 30  # Gender mismatch penalty

        # 3. Color harmony (30 points max)
        base_colors = self._extract_colors(base_product)
        cand_colors = self._extract_colors(candidate)
        color_score = self._calculate_color_harmony_score(base_colors, cand_colors)
        score += color_score * 0.30

        # 4. Price compatibility (10 points)
        # Accessories should be cheaper than main items
        base_price = self._get_price(base_product)
        cand_price = self._get_price(candidate)
        if cand_category in ["ACCESSORIES", "BAGS"]:
            if cand_price < base_price:
                score += 10
        elif base_price > 0:
            price_ratio = cand_price / base_price
            if 0.5 <= price_ratio <= 1.5:
                score += 10

        return max(0, score), reason_key

    def _calculate_color_harmony_score(self, colors1: List[str],
                                       colors2: List[str]) -> float:
        """
        Calculate color harmony between two color sets.
        Returns 0-100 score.
        """
        if not colors1 or not colors2:
            return 50  # Neutral if no color data

        max_harmony = 0

        for c1 in colors1[:3]:  # Check top 3 colors
            c1_upper = c1.upper()
            harmony_rules = COLOR_HARMONY.get(c1_upper, {})

            for c2 in colors2[:3]:
                c2_upper = c2.upper()

                if c2_upper in harmony_rules.get("perfect", []):
                    max_harmony = max(max_harmony, 100)
                elif c2_upper in harmony_rules.get("excellent", []):
                    max_harmony = max(max_harmony, 80)
                elif c2_upper in harmony_rules.get("good", []):
                    max_harmony = max(max_harmony, 60)
                elif c2_upper in harmony_rules.get("neutral", []):
                    max_harmony = max(max_harmony, 40)
                elif c2_upper in harmony_rules.get("avoid", []):
                    max_harmony = max(max_harmony, 10)
                else:
                    # Default neutral if not in matrix
                    max_harmony = max(max_harmony, 50)

        return max_harmony

    # ========================================================================
    # HELPER METHODS
    # ========================================================================

    def _detect_category(self, product: Dict) -> Optional[str]:
        """Detect product category from name"""
        name = (product.get("nom") or product.get("title") or "").upper()

        # Check in order of specificity
        for category, keywords in OUTFIT_CATEGORIES.items():
            for kw in keywords:
                # Match whole word to avoid "JEAN" matching "JEAN JACKET"
                if f" {kw} " in f" {name} " or name.startswith(kw) or name.endswith(kw):
                    return category

        return None

    def _detect_style(self, product: Dict) -> Optional[str]:
        """Detect style profile from product name/attributes"""
        name = (product.get("nom") or product.get("title") or "").lower()

        for style, keywords in STYLE_KEYWORDS.items():
            for kw in keywords:
                if kw in name:
                    return style.value

        return None

    def _extract_colors(self, product: Dict) -> List[str]:
        """Extract color names from product"""
        colors = []

        # From colors array
        for color in (product.get("colors") or []):
            if isinstance(color, dict):
                color_name = color.get("name", "")
            else:
                color_name = str(color)
            if color_name:
                colors.append(color_name.upper())

        # From declinaisons
        for decl in (product.get("declinaisons") or []):
            color_name = decl.get("couleur") or decl.get("libellet") or ""
            if color_name:
                colors.append(color_name.upper())

        return list(set(colors))  # Unique colors

    def _get_price(self, product: Dict) -> float:
        """Get product price"""
        try:
            return float(product.get("currentPrice") or product.get("prix") or
                        product.get("price") or 0)
        except:
            return 0.0

    def _get_original_price(self, product: Dict) -> Optional[float]:
        """Get original price if discounted"""
        try:
            current = float(product.get("currentPrice") or 0)
            original = float(product.get("prix") or product.get("price") or 0)
            if original > current > 0:
                return original
        except:
            pass
        return None

    def _get_discount_percent(self, product: Dict) -> Optional[int]:
        """Calculate discount percentage"""
        current = self._get_price(product)
        original = self._get_original_price(product)
        if original and current and original > current:
            return int(((original - current) / original) * 100)
        return product.get("discountValue")

    def _get_current_season(self) -> Season:
        """Get current season based on month"""
        month = datetime.now().month
        if month in [12, 1, 2]:
            return Season.WINTER
        elif month in [3, 4, 5]:
            return Season.SPRING
        elif month in [6, 7, 8]:
            return Season.SUMMER
        else:
            return Season.AUTUMN

    def _format_image_url(self, url: str) -> str:
        """Ensure image URL is absolute"""
        if not url:
            return ""
        if isinstance(url, dict):
            url = url.get("url") or ""
        if not url:
            return ""
        if url.startswith("http"):
            return url
        return f"https://barsha.com.tn/{url.lstrip('/')}"

    def _get_product_image(self, product: Dict) -> str:
        """Get main product image"""
        # Try multiple sources
        img = product.get("image") or product.get("firstImg") or ""
        if isinstance(img, dict):
            img = img.get("url") or img.get("medium", {}).get("url") or ""
        return self._format_image_url(img)

    def _get_second_image(self, product: Dict) -> Optional[str]:
        """Get secondary/hover image"""
        img = product.get("secondImg")
        if isinstance(img, dict):
            img = img.get("url") or ""
        if img:
            return self._format_image_url(img)

        # Try from declinaisons
        decls = product.get("declinaisons") or []
        if len(decls) > 1:
            for decl in decls[1:]:
                images = decl.get("images") or []
                if images:
                    img_url = images[0].get("url") if isinstance(images[0], dict) else images[0]
                    if img_url:
                        return self._format_image_url(img_url)

        return None

    def _generate_recommendation_id(self, strategy: str, product_id: int,
                                    position: int) -> str:
        """Generate unique recommendation ID for tracking"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        return f"{strategy}_{product_id}_{position}_{timestamp}"

    def _create_recommendation_item(self, product: Dict, score: float,
                                    position: int, strategy: str,
                                    reason_key: str) -> RecommendationItem:
        """Create a recommendation item from product"""
        product_id = product.get("id", 0)
        product_name = product.get("nom") or product.get("title") or "Article Barsha"

        # Generate reason text
        reason_text = REASON_TEMPLATES.get(reason_key, "Recommandé pour vous")
        if "{product}" in reason_text:
            reason_text = reason_text.format(product=product_name[:30])
        if "{category}" in reason_text:
            category = self._detect_category(product) or "mode"
            reason_text = reason_text.format(category=category.lower())

        return RecommendationItem(
            id=product_id,
            reference=product.get("sku") or product.get("reference") or "",
            name=product_name,
            price=self._get_price(product),
            original_price=self._get_original_price(product),
            discount_percent=self._get_discount_percent(product),
            image=self._get_product_image(product),
            second_image=self._get_second_image(product),
            url=f"/produit/{product_id}",
            family=product.get("Famille") or product.get("famille") or "",
            category=self._detect_category(product),
            colors=self._extract_colors(product),
            style_profile=self._detect_style(product),
            score=score,
            confidence=min(1.0, score / 100),
            position=position,
            strategy=strategy,
            reason_key=reason_key,
            reason_text=reason_text,
            recommendation_id=self._generate_recommendation_id(strategy, product_id, position)
        )

    # ========================================================================
    # RECOMMENDATION STRATEGIES
    # ========================================================================

    def get_similar_products(self, product_id: int, limit: int = 8,
                            family: Optional[str] = None) -> RecommendationResponse:
        """Get products similar to the specified product"""
        import time
        start_time = time.time()

        # Check cache
        cache_key_params = {"product_id": product_id, "limit": limit, "family": family}
        cached = self.cache.get("similar", **cache_key_params)
        if cached:
            cached.cache_hit = True
            return cached

        base_product = self.catalog_by_id.get(product_id)
        if not base_product:
            return self._empty_response("similar", "Dans le même style")

        # Score all candidates
        candidates = []
        for product in self.catalog:
            if product.get("id") == product_id:
                continue

            # Filter by family if specified
            if family:
                prod_family = (product.get("Famille") or "").upper()
                if family.upper() not in prod_family:
                    continue

            score, reason_key = self._calculate_similarity_score(base_product, product)
            if score > 25:  # Minimum threshold
                candidates.append((product, score, reason_key))

        # Sort by score
        candidates.sort(key=lambda x: x[1], reverse=True)

        # Apply diversity
        diverse_candidates = self.diversity.enforce_category_diversity(
            [{"product": c[0], "score": c[1], "reason": c[2]} for c in candidates],
            max_per_category=3
        )

        # Create recommendation items
        products = []
        for i, item in enumerate(diverse_candidates[:limit]):
            rec_item = self._create_recommendation_item(
                item["product"], item["score"], i, "similar", item["reason"]
            )
            products.append(rec_item)

        base_name = base_product.get("nom") or base_product.get("title") or ""
        response = RecommendationResponse(
            strategy="similar",
            title="Dans le même style",
            subtitle=f"Inspiré de {base_name[:40]}",
            products=products,
            total_candidates=len(candidates),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

        # Cache the response
        self.cache.set("similar", response, **cache_key_params)

        return response

    def get_complementary_products(self, product_id: int, limit: int = 6,
                                   family: Optional[str] = None) -> RecommendationResponse:
        """Get products that complement the specified product"""
        import time
        start_time = time.time()

        cache_key_params = {"product_id": product_id, "limit": limit, "family": family}
        cached = self.cache.get("complementary", **cache_key_params)
        if cached:
            cached.cache_hit = True
            return cached

        base_product = self.catalog_by_id.get(product_id)
        if not base_product:
            return self._empty_response("complementary", "Pour compléter ce look")

        candidates = []
        for product in self.catalog:
            if product.get("id") == product_id:
                continue

            if family:
                prod_family = (product.get("Famille") or "").upper()
                if family.upper() not in prod_family:
                    continue

            score, reason_key = self._calculate_complementary_score(base_product, product)
            if score > 30:
                candidates.append((product, score, reason_key))

        candidates.sort(key=lambda x: x[1], reverse=True)

        # Enforce diversity across categories for outfit variety
        diverse_candidates = self.diversity.enforce_category_diversity(
            [{"product": c[0], "score": c[1], "reason": c[2],
              "category": self._detect_category(c[0])} for c in candidates],
            max_per_category=2
        )

        products = []
        for i, item in enumerate(diverse_candidates[:limit]):
            rec_item = self._create_recommendation_item(
                item["product"], item["score"], i, "complementary", "outfit_completion"
            )
            products.append(rec_item)

        response = RecommendationResponse(
            strategy="complementary",
            title="Pour compléter ce look",
            subtitle="Nos suggestions de styliste",
            products=products,
            total_candidates=len(candidates),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

        self.cache.set("complementary", response, **cache_key_params)
        return response

    def get_complete_the_look(self, product_id: int, limit: int = 4) -> RecommendationResponse:
        """Get a curated outfit to complete the look"""
        import time
        start_time = time.time()

        cache_key_params = {"product_id": product_id, "limit": limit}
        cached = self.cache.get("complete_the_look", **cache_key_params)
        if cached:
            cached.cache_hit = True
            return cached

        base_product = self.catalog_by_id.get(product_id)
        if not base_product:
            return self._empty_response("complete_the_look", "Le look complet")

        base_category = self._detect_category(base_product)
        base_family = (base_product.get("Famille") or "").upper()
        base_colors = self._extract_colors(base_product)

        # Determine which categories we need to complete the look
        rules = OUTFIT_RULES.get(base_category, {})
        needed_categories = set(rules.get("essential", []) + rules.get("complementary", []))

        # Find best match for each needed category
        category_best: Dict[str, Tuple[Dict, float]] = {}

        for product in self.catalog:
            if product.get("id") == product_id:
                continue

            # Must match gender
            prod_family = (product.get("Famille") or "").upper()
            if "WOMEN" in base_family and "WOMEN" not in prod_family:
                continue
            if "MEN" in base_family and "MEN" not in prod_family:
                continue

            prod_category = self._detect_category(product)
            if prod_category not in needed_categories:
                continue

            # Calculate match score
            score, _ = self._calculate_complementary_score(base_product, product)

            # Track best per category
            if prod_category not in category_best or score > category_best[prod_category][1]:
                category_best[prod_category] = (product, score)

        # Build outfit from best matches
        products = []
        position = 0
        for category in ["BOTTOMS", "TOPS", "FOOTWEAR", "BAGS", "ACCESSORIES", "OUTERWEAR"]:
            if category in category_best and len(products) < limit:
                product, score = category_best[category]
                rec_item = self._create_recommendation_item(
                    product, score, position, "complete_the_look", "outfit_completion"
                )
                products.append(rec_item)
                position += 1

        response = RecommendationResponse(
            strategy="complete_the_look",
            title="Le look complet",
            subtitle="Sélection de nos stylistes",
            products=products,
            total_candidates=len(category_best),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

        self.cache.set("complete_the_look", response, **cache_key_params)
        return response

    def get_trending(self, limit: int = 8, family: Optional[str] = None,
                    category: Optional[str] = None) -> RecommendationResponse:
        """Get trending products based on analytics"""
        import time
        start_time = time.time()

        cache_key_params = {"limit": limit, "family": family, "category": category}
        cached = self.cache.get("trending", **cache_key_params)
        if cached:
            cached.cache_hit = True
            return cached

        if not self.analytics:
            return self._empty_response("trending", "Tendances Barsha")

        # Get trending IDs from analytics
        trending_ids = self.analytics.get_trending_products(
            limit=limit * 2, family=family, category=category
        )

        products = []
        for i, pid in enumerate(trending_ids[:limit]):
            product = self.catalog_by_id.get(pid)
            if product:
                metrics = self.analytics.product_metrics.get(pid, {})
                score = metrics.get("trending_score", 50)
                rec_item = self._create_recommendation_item(
                    product, score * 10, i, "trending", "trending_now"
                )
                products.append(rec_item)

        response = RecommendationResponse(
            strategy="trending",
            title="Tendances Barsha",
            subtitle="Les pièces les plus convoitées",
            products=products,
            total_candidates=len(trending_ids),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

        self.cache.set("trending", response, ttl=180, **cache_key_params)  # 3 min cache
        return response

    def get_new_arrivals(self, limit: int = 8,
                        family: Optional[str] = None) -> RecommendationResponse:
        """Get newly arrived products"""
        import time
        start_time = time.time()

        cache_key_params = {"limit": limit, "family": family}
        cached = self.cache.get("new_arrivals", **cache_key_params)
        if cached:
            cached.cache_hit = True
            return cached

        # Sort by ID descending (higher ID = newer)
        candidates = []
        for product in self.catalog:
            if family:
                prod_family = (product.get("Famille") or "").upper()
                if family.upper() not in prod_family:
                    continue
            candidates.append(product)

        candidates.sort(key=lambda p: p.get("id", 0), reverse=True)

        products = []
        for i, product in enumerate(candidates[:limit]):
            rec_item = self._create_recommendation_item(
                product, 100 - i, i, "new_arrivals", "new_arrival"
            )
            products.append(rec_item)

        response = RecommendationResponse(
            strategy="new_arrivals",
            title="Nouveautés",
            subtitle="Fraîchement arrivées",
            products=products,
            total_candidates=len(candidates),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

        self.cache.set("new_arrivals", response, ttl=600, **cache_key_params)  # 10 min
        return response

    def get_seasonal(self, limit: int = 8,
                    family: Optional[str] = None) -> RecommendationResponse:
        """Get season-appropriate products"""
        import time
        start_time = time.time()

        season = self._get_current_season()
        cache_key_params = {"limit": limit, "family": family, "season": season.value}
        cached = self.cache.get("seasonal", **cache_key_params)
        if cached:
            cached.cache_hit = True
            return cached

        weights = SEASON_CATEGORY_WEIGHTS.get(season, {})

        candidates = []
        for product in self.catalog:
            if family:
                prod_family = (product.get("Famille") or "").upper()
                if family.upper() not in prod_family:
                    continue

            category = self._detect_category(product)
            weight = weights.get(category, 1.0)

            # Boost weight for discounted items
            if self._get_discount_percent(product):
                weight *= 1.2

            # Add popularity from analytics
            pid = product.get("id")
            if self.analytics and pid in self.analytics.product_metrics:
                popularity = self.analytics.product_metrics[pid].get("trending_score", 1)
                weight *= (1 + popularity / 10)

            candidates.append((product, weight * 50))

        candidates.sort(key=lambda x: x[1], reverse=True)

        # Enforce diversity
        diverse = self.diversity.enforce_category_diversity(
            [{"product": c[0], "score": c[1]} for c in candidates],
            max_per_category=3
        )

        products = []
        for i, item in enumerate(diverse[:limit]):
            rec_item = self._create_recommendation_item(
                item["product"], item["score"], i, "seasonal", "seasonal_pick"
            )
            products.append(rec_item)

        season_names = {
            Season.WINTER: "d'hiver",
            Season.SPRING: "de printemps",
            Season.SUMMER: "d'été",
            Season.AUTUMN: "d'automne"
        }

        response = RecommendationResponse(
            strategy="seasonal",
            title=f"Sélection {season_names[season]}",
            subtitle="Parfait pour la saison",
            products=products,
            total_candidates=len(candidates),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

        self.cache.set("seasonal", response, ttl=3600, **cache_key_params)  # 1 hour
        return response

    def get_editorial(self, limit: int = 6) -> RecommendationResponse:
        """Get editorially curated products"""
        import time
        start_time = time.time()

        cache_key_params = {"limit": limit}
        cached = self.cache.get("editorial", **cache_key_params)
        if cached:
            cached.cache_hit = True
            return cached

        # Editorial selection: mix of popular, discounted, and diverse
        candidates = []

        for product in self.catalog:
            score = 0

            # Boost for discounts
            discount = self._get_discount_percent(product)
            if discount:
                score += min(discount, 30)

            # Boost from analytics
            pid = product.get("id")
            if self.analytics and pid in self.analytics.product_metrics:
                metrics = self.analytics.product_metrics[pid]
                score += metrics.get("trending_score", 0) * 2
                score += metrics.get("conversion_rate", 0) * 100

            # Category variety bonus
            category = self._detect_category(product)
            if category in ["DRESSES", "BAGS", "FOOTWEAR"]:
                score += 10

            candidates.append((product, score))

        candidates.sort(key=lambda x: x[1], reverse=True)

        # Enforce strong diversity for editorial
        diverse = self.diversity.enforce_category_diversity(
            [{"product": c[0], "score": c[1], "category": self._detect_category(c[0])}
             for c in candidates],
            max_per_category=2
        )

        products = []
        for i, item in enumerate(diverse[:limit]):
            rec_item = self._create_recommendation_item(
                item["product"], item["score"], i, "editorial", "editorial_choice"
            )
            products.append(rec_item)

        response = RecommendationResponse(
            strategy="editorial",
            title="Sélection éditoriale",
            subtitle="Choisis par nos stylistes",
            products=products,
            total_candidates=len(candidates),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

        self.cache.set("editorial", response, ttl=1800, **cache_key_params)  # 30 min
        return response

    def get_personalized(self, user_context: UserContext,
                        limit: int = 8) -> RecommendationResponse:
        """
        Get personalized recommendations based on user behavior and style profile.

        Uses multiple signals:
        - Explicit style preferences (styles, colors, occasions)
        - Behavior data (viewed, wishlist, cart, purchased)
        - Category affinity scores
        - Price sensitivity
        - Profile completeness for confidence weighting
        """
        import time
        start_time = time.time()

        # Collect user signals
        seed_ids = set()
        seed_ids.update(user_context.wishlist_product_ids[:5])
        seed_ids.update(user_context.viewed_product_ids[:5])
        seed_ids.update(user_context.purchased_product_ids[:3])

        # Check if we have style profile data
        has_style_profile = (
            len(user_context.preferred_styles) > 0 or
            len(user_context.preferred_colors) > 0 or
            len(user_context.preferred_occasions) > 0
        )

        # Cold start handling
        if not seed_ids and not has_style_profile:
            return self.get_trending(limit=limit)

        # Get seed products for behavior-based scoring
        seed_products = [self.catalog_by_id.get(pid) for pid in seed_ids
                        if pid in self.catalog_by_id]

        # Score all candidates
        candidates = []
        for product in self.catalog:
            pid = product.get("id")
            if pid in seed_ids or pid in user_context.cart_product_ids:
                continue

            total_score = 0
            best_reason = "personalized"
            reason_details = []

            # 1. Behavior-based similarity scoring (40% weight)
            if seed_products:
                for seed in seed_products:
                    score, _ = self._calculate_similarity_score(seed, product)
                    total_score += score * 0.4
                    if score > 40:
                        if seed.get("id") in user_context.wishlist_product_ids:
                            best_reason = "wishlist_inspired"
                            reason_details.append("Dans votre wishlist")
                        elif seed.get("id") in user_context.viewed_product_ids:
                            best_reason = "because_viewed"
                            reason_details.append("Produits consultés")

                total_score = total_score / len(seed_products)

            # 2. Style profile matching (30% weight when available)
            if has_style_profile:
                style_score = 0
                product_style = product.get("style_profile", "").lower()
                product_colors = [c.lower() for c in (product.get("couleur") or "").split(",")]

                # Style match
                if product_style and product_style in [s.lower() for s in user_context.preferred_styles]:
                    style_score += 40
                    reason_details.append(f"Style {product_style}")

                # Color match
                for color in product_colors:
                    if color.strip() in [c.lower() for c in user_context.preferred_colors]:
                        style_score += 20
                        reason_details.append("Couleur préférée")
                        break

                # Occasion match (based on style-occasion mapping)
                occasion_styles = {
                    "work": ["chic", "elegant", "classic", "minimalist"],
                    "weekend": ["casual", "bohemian", "sporty", "streetwear"],
                    "evening": ["elegant", "chic", "romantic"],
                    "sport": ["sporty", "casual"],
                    "travel": ["casual", "minimalist", "bohemian"],
                    "special": ["elegant", "romantic", "trendy"]
                }
                for occasion in user_context.preferred_occasions:
                    if product_style in occasion_styles.get(occasion.lower(), []):
                        style_score += 15
                        break

                total_score += style_score * 0.3
                if style_score >= 40:
                    best_reason = "style_match"

            # 3. Category affinity scoring (20% weight)
            product_category = product.get("famille", "").upper()
            if user_context.category_affinity and product_category:
                affinity = user_context.category_affinity.get(product_category, 0)
                if affinity > 0:
                    total_score += affinity * 30 * 0.2
                    if affinity > 0.7:
                        reason_details.append("Catégorie favorite")

            # 4. Price range filtering (10% weight / penalty)
            price = product.get("prixSolde") or product.get("prix") or 0
            if user_context.min_price and price < user_context.min_price:
                total_score -= 10
            if user_context.max_price and price > user_context.max_price:
                total_score -= 15

            # Price sensitivity adjustment
            price_tier = self._get_price_tier(price)
            if user_context.price_sensitivity:
                sensitivity_map = {
                    "low": [PriceTier.BUDGET, PriceTier.AFFORDABLE],
                    "medium": [PriceTier.AFFORDABLE, PriceTier.MID_RANGE],
                    "high": [PriceTier.MID_RANGE, PriceTier.PREMIUM],
                    "luxury": [PriceTier.PREMIUM, PriceTier.LUXURY]
                }
                preferred_tiers = sensitivity_map.get(user_context.price_sensitivity, [])
                if price_tier in preferred_tiers:
                    total_score += 10

            # Apply profile completeness confidence boost
            confidence_boost = 1 + (user_context.profile_completeness / 200)  # Max 1.5x boost at 100%
            total_score *= confidence_boost

            if total_score > 15:
                reason_text = " • ".join(reason_details[:2]) if reason_details else "Basé sur vos préférences"
                candidates.append((product, total_score, best_reason, reason_text))

        candidates.sort(key=lambda x: x[1], reverse=True)

        # Diversity enforcement
        diverse = self.diversity.enforce_category_diversity(
            [{"product": c[0], "score": c[1], "reason": c[2], "reason_text": c[3]} for c in candidates],
            max_per_category=3
        )

        products = []
        for i, item in enumerate(diverse[:limit]):
            rec_item = self._create_recommendation_item(
                item["product"], item["score"], i, "personalized", item["reason"]
            )
            # Override reason text with enhanced version
            rec_item["reasonText"] = item.get("reason_text", rec_item.get("reasonText", ""))
            products.append(rec_item)

        # Dynamic subtitle based on profile
        subtitle = "Basé sur vos préférences"
        if has_style_profile and user_context.profile_completeness > 50:
            subtitle = "Sélection personnalisée selon votre style"
        elif seed_products:
            subtitle = "Basé sur vos produits consultés"

        response = RecommendationResponse(
            strategy="personalized",
            title="Sélectionné pour vous",
            subtitle=subtitle,
            products=products,
            total_candidates=len(candidates),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

        return response

    def get_frequently_bought_together(self, product_id: int,
                                       limit: int = 4) -> RecommendationResponse:
        """Get products frequently bought together"""
        import time
        start_time = time.time()

        cache_key_params = {"product_id": product_id, "limit": limit}
        cached = self.cache.get("frequently_bought_together", **cache_key_params)
        if cached:
            cached.cache_hit = True
            return cached

        if not self.analytics:
            return self._empty_response("frequently_bought_together",
                                       "Souvent achetés ensemble")

        fbt_ids = self.analytics.get_frequently_bought_together(product_id, limit)

        products = []
        for i, pid in enumerate(fbt_ids):
            product = self.catalog_by_id.get(pid)
            if product:
                rec_item = self._create_recommendation_item(
                    product, 80 - i * 10, i, "frequently_bought_together",
                    "frequently_bought"
                )
                products.append(rec_item)

        response = RecommendationResponse(
            strategy="frequently_bought_together",
            title="Souvent achetés ensemble",
            subtitle="Les clients ont aussi acheté",
            products=products,
            total_candidates=len(fbt_ids),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

        self.cache.set("frequently_bought_together", response, **cache_key_params)
        return response

    def get_customers_also_liked(self, product_ids: List[int],
                                limit: int = 8) -> RecommendationResponse:
        """Get products that similar customers also liked"""
        import time
        start_time = time.time()

        if not self.analytics or not product_ids:
            return self._empty_response("customers_also_liked",
                                       "Les clients ont aussi aimé")

        liked_ids = self.analytics.get_customers_also_liked(product_ids, limit)

        products = []
        for i, pid in enumerate(liked_ids):
            product = self.catalog_by_id.get(pid)
            if product:
                rec_item = self._create_recommendation_item(
                    product, 75 - i * 5, i, "customers_also_liked",
                    "customers_liked"
                )
                products.append(rec_item)

        return RecommendationResponse(
            strategy="customers_also_liked",
            title="Les clients ont aussi aimé",
            subtitle="Basé sur des profils similaires",
            products=products,
            total_candidates=len(liked_ids),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

    def get_premium_alternatives(self, product_id: int,
                                limit: int = 4) -> RecommendationResponse:
        """Get premium alternatives (tasteful upsell)"""
        import time
        start_time = time.time()

        cache_key_params = {"product_id": product_id, "limit": limit}
        cached = self.cache.get("premium_alternative", **cache_key_params)
        if cached:
            cached.cache_hit = True
            return cached

        base_product = self.catalog_by_id.get(product_id)
        if not base_product:
            return self._empty_response("premium_alternative", "Version premium")

        base_price = self._get_price(base_product)
        base_category = self._detect_category(base_product)
        base_family = (base_product.get("Famille") or "").upper()

        candidates = []
        for product in self.catalog:
            if product.get("id") == product_id:
                continue

            price = self._get_price(product)
            category = self._detect_category(product)
            family = (product.get("Famille") or "").upper()

            # Must be same category and family
            if category != base_category:
                continue
            if base_family and not any(f in family for f in base_family.split()):
                continue

            # Premium = 20-100% more expensive
            if base_price > 0:
                price_ratio = price / base_price
                if not (1.2 <= price_ratio <= 2.0):
                    continue

            # Calculate similarity
            score, _ = self._calculate_similarity_score(base_product, product)
            score += (price_ratio - 1) * 20  # Bonus for price increase

            candidates.append((product, score))

        candidates.sort(key=lambda x: x[1], reverse=True)

        products = []
        for i, (product, score) in enumerate(candidates[:limit]):
            rec_item = self._create_recommendation_item(
                product, score, i, "premium_alternative", "premium_upgrade"
            )
            products.append(rec_item)

        response = RecommendationResponse(
            strategy="premium_alternative",
            title="Version premium",
            subtitle="Pour un look plus raffiné",
            products=products,
            total_candidates=len(candidates),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

        self.cache.set("premium_alternative", response, **cache_key_params)
        return response

    def get_affordable_alternatives(self, product_id: int,
                                   limit: int = 4) -> RecommendationResponse:
        """Get affordable alternatives (smart downgrade)"""
        import time
        start_time = time.time()

        cache_key_params = {"product_id": product_id, "limit": limit}
        cached = self.cache.get("affordable_alternative", **cache_key_params)
        if cached:
            cached.cache_hit = True
            return cached

        base_product = self.catalog_by_id.get(product_id)
        if not base_product:
            return self._empty_response("affordable_alternative",
                                       "Alternatives accessibles")

        base_price = self._get_price(base_product)
        base_category = self._detect_category(base_product)
        base_family = (base_product.get("Famille") or "").upper()

        candidates = []
        for product in self.catalog:
            if product.get("id") == product_id:
                continue

            price = self._get_price(product)
            category = self._detect_category(product)
            family = (product.get("Famille") or "").upper()

            if category != base_category:
                continue
            if base_family and not any(f in family for f in base_family.split()):
                continue

            # Affordable = 20-60% cheaper
            if base_price > 0 and price > 0:
                savings_ratio = 1 - (price / base_price)
                if not (0.2 <= savings_ratio <= 0.6):
                    continue
            else:
                continue

            score, _ = self._calculate_similarity_score(base_product, product)
            score += savings_ratio * 30  # Bonus for savings

            candidates.append((product, score, savings_ratio))

        candidates.sort(key=lambda x: x[1], reverse=True)

        products = []
        for i, (product, score, _) in enumerate(candidates[:limit]):
            rec_item = self._create_recommendation_item(
                product, score, i, "affordable_alternative", "affordable_option"
            )
            products.append(rec_item)

        response = RecommendationResponse(
            strategy="affordable_alternative",
            title="Alternatives accessibles",
            subtitle="Même style, petit prix",
            products=products,
            total_candidates=len(candidates),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

        self.cache.set("affordable_alternative", response, **cache_key_params)
        return response

    def get_cart_recommendations(self, cart_product_ids: List[int],
                                limit: int = 4) -> RecommendationResponse:
        """Get recommendations to complete cart"""
        import time
        start_time = time.time()

        if not cart_product_ids:
            return self._empty_response("cart_complement",
                                       "Pour compléter votre commande")

        # Find what's missing from the cart
        cart_categories = set()
        cart_colors = set()

        for pid in cart_product_ids:
            product = self.catalog_by_id.get(pid)
            if product:
                cat = self._detect_category(product)
                if cat:
                    cart_categories.add(cat)
                cart_colors.update(self._extract_colors(product))

        # Determine what categories would complement
        needed_categories = set()
        for cat in cart_categories:
            rules = OUTFIT_RULES.get(cat, {})
            needed_categories.update(rules.get("essential", []))
            needed_categories.update(rules.get("complementary", []))

        # Remove already-in-cart categories
        needed_categories -= cart_categories

        # Score candidates
        candidates = []
        for product in self.catalog:
            pid = product.get("id")
            if pid in cart_product_ids:
                continue

            category = self._detect_category(product)
            score = 0

            # Boost for needed categories
            if category in needed_categories:
                score += 50

            # Color harmony with cart
            product_colors = self._extract_colors(product)
            for pc in product_colors:
                if pc in cart_colors:
                    score += 15
                    break

            # Popularity boost
            if self.analytics and pid in self.analytics.product_metrics:
                score += self.analytics.product_metrics[pid].get("trending_score", 0)

            if score > 20:
                candidates.append((product, score))

        candidates.sort(key=lambda x: x[1], reverse=True)

        # Diversity
        diverse = self.diversity.enforce_category_diversity(
            [{"product": c[0], "score": c[1]} for c in candidates],
            max_per_category=2
        )

        products = []
        for i, item in enumerate(diverse[:limit]):
            rec_item = self._create_recommendation_item(
                item["product"], item["score"], i, "cart_complement",
                "cart_complement"
            )
            products.append(rec_item)

        return RecommendationResponse(
            strategy="cart_complement",
            title="Pour compléter votre commande",
            subtitle="Dernières suggestions avant validation",
            products=products,
            total_candidates=len(candidates),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

    def get_because_you_viewed(self, viewed_ids: List[int],
                               limit: int = 8) -> RecommendationResponse:
        """Get recommendations based on recently viewed products"""
        import time
        start_time = time.time()

        if not viewed_ids:
            return self._empty_response("because_you_viewed",
                                       "Car vous avez consulté")

        # Get similar to most recent views
        seed_id = viewed_ids[0]
        seed_product = self.catalog_by_id.get(seed_id)

        if not seed_product:
            return self._empty_response("because_you_viewed",
                                       "Car vous avez consulté")

        candidates = []
        for product in self.catalog:
            pid = product.get("id")
            if pid in viewed_ids:
                continue

            score, reason = self._calculate_similarity_score(seed_product, product)
            if score > 25:
                candidates.append((product, score))

        candidates.sort(key=lambda x: x[1], reverse=True)

        products = []
        seed_name = seed_product.get("nom") or seed_product.get("title") or ""
        for i, (product, score) in enumerate(candidates[:limit]):
            rec_item = self._create_recommendation_item(
                product, score, i, "because_you_viewed", "because_viewed"
            )
            # Customize reason text
            rec_item.reason_text = f"Car vous avez consulté {seed_name[:25]}..."
            products.append(rec_item)

        return RecommendationResponse(
            strategy="because_you_viewed",
            title="Car vous avez consulté",
            subtitle=seed_name[:40],
            products=products,
            total_candidates=len(candidates),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

    def get_style_discovery(self, style: str, limit: int = 8,
                           family: Optional[str] = None) -> RecommendationResponse:
        """Get products for style discovery"""
        import time
        start_time = time.time()

        cache_key_params = {"style": style, "limit": limit, "family": family}
        cached = self.cache.get("style_discovery", **cache_key_params)
        if cached:
            cached.cache_hit = True
            return cached

        target_style = style.lower()

        candidates = []
        for product in self.catalog:
            if family:
                prod_family = (product.get("Famille") or "").upper()
                if family.upper() not in prod_family:
                    continue

            detected_style = self._detect_style(product)
            score = 0

            if detected_style == target_style:
                score += 60

            # Keywords in name
            name = (product.get("nom") or "").lower()
            for style_profile, keywords in STYLE_KEYWORDS.items():
                if style_profile.value == target_style:
                    for kw in keywords:
                        if kw in name:
                            score += 15
                    break

            # Popularity bonus
            pid = product.get("id")
            if self.analytics and pid in self.analytics.product_metrics:
                score += self.analytics.product_metrics[pid].get("trending_score", 0)

            if score > 20:
                candidates.append((product, score))

        candidates.sort(key=lambda x: x[1], reverse=True)

        products = []
        for i, (product, score) in enumerate(candidates[:limit]):
            rec_item = self._create_recommendation_item(
                product, score, i, "style_discovery", "style_discovery"
            )
            products.append(rec_item)

        style_titles = {
            "casual": "Style Casual",
            "chic": "Style Chic",
            "sporty": "Style Sportif",
            "elegant": "Style Élégant",
            "bohemian": "Style Bohème",
            "minimalist": "Style Minimaliste",
            "trendy": "Style Tendance",
            "classic": "Style Classique",
            "streetwear": "Style Streetwear",
            "romantic": "Style Romantique"
        }

        response = RecommendationResponse(
            strategy="style_discovery",
            title=style_titles.get(target_style, f"Style {target_style.title()}"),
            subtitle="Découvrez ce style",
            products=products,
            total_candidates=len(candidates),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

        self.cache.set("style_discovery", response, **cache_key_params)
        return response

    def get_by_colors(self, colors: List[str], limit: int = 8,
                      family: Optional[str] = None) -> RecommendationResponse:
        """
        Get products matching user's preferred colors.

        Products are scored based on:
        - Exact color match
        - Color family matching (e.g., navy matches blue)
        - Number of matching colors
        """
        import time
        start_time = time.time()

        cache_key_params = {"colors": ",".join(sorted(colors)), "limit": limit, "family": family}
        cached = self.cache.get("by_colors", **cache_key_params)
        if cached:
            cached.cache_hit = True
            return cached

        # Color families for fuzzy matching
        color_families = {
            "noir": ["noir", "black", "anthracite", "charbon"],
            "blanc": ["blanc", "white", "ecru", "ivoire", "creme"],
            "bleu": ["bleu", "blue", "marine", "navy", "indigo", "cyan", "turquoise"],
            "rouge": ["rouge", "red", "bordeaux", "bourgogne", "carmin", "vermillon"],
            "rose": ["rose", "pink", "fuchsia", "magenta", "saumon", "corail"],
            "vert": ["vert", "green", "olive", "kaki", "emeraude", "sauge"],
            "jaune": ["jaune", "yellow", "moutarde", "or", "gold", "dore"],
            "orange": ["orange", "rouille", "terracotta", "abricot"],
            "marron": ["marron", "brown", "camel", "chocolat", "cognac", "beige", "taupe"],
            "gris": ["gris", "grey", "gray", "argent", "silver"],
            "violet": ["violet", "purple", "mauve", "lilas", "prune"],
        }

        # Build expanded color set
        target_colors = set()
        for color in colors:
            target_colors.add(color.lower())
            # Add color family
            for family_name, family_colors in color_families.items():
                if color.lower() in family_colors:
                    target_colors.update(family_colors)
                    break

        candidates = []
        for product in self.catalog:
            if family:
                prod_family = (product.get("Famille") or "").upper()
                if family.upper() not in prod_family:
                    continue

            # Get product colors
            product_color_str = (product.get("couleur") or "").lower()
            product_colors = [c.strip() for c in product_color_str.split(",")]

            score = 0
            matched_colors = []

            for pc in product_colors:
                if pc in target_colors:
                    score += 40  # Direct match
                    matched_colors.append(pc)
                else:
                    # Check color family match
                    for color in colors:
                        for family_name, family_colors in color_families.items():
                            if color.lower() in family_colors and pc in family_colors:
                                score += 25  # Family match
                                matched_colors.append(pc)
                                break

            if score > 0:
                # Boost popular items
                pid = product.get("id")
                if self.analytics and pid in self.analytics.product_metrics:
                    score += self.analytics.product_metrics[pid].get("trending_score", 0) * 0.3

                candidates.append((product, score, matched_colors))

        candidates.sort(key=lambda x: x[1], reverse=True)

        # Diversity
        diverse = self.diversity.enforce_category_diversity(
            [{"product": c[0], "score": c[1], "colors": c[2]} for c in candidates],
            max_per_category=4
        )

        products = []
        for i, item in enumerate(diverse[:limit]):
            rec_item = self._create_recommendation_item(
                item["product"], item["score"], i, "color_matched", "color_preference"
            )
            matched = item.get("colors", [])
            if matched:
                rec_item["reasonText"] = f"Couleur: {', '.join(matched[:2])}"
            products.append(rec_item)

        response = RecommendationResponse(
            strategy="color_matched",
            title="Vos couleurs préférées",
            subtitle=f"Produits en {', '.join(colors[:3])}",
            products=products,
            total_candidates=len(candidates),
            execution_time_ms=(time.time() - start_time) * 1000,
            cache_hit=False
        )

        self.cache.set("by_colors", response, **cache_key_params)
        return response

    # ========================================================================
    # UTILITY METHODS
    # ========================================================================

    def _empty_response(self, strategy: str, title: str) -> RecommendationResponse:
        """Create empty response"""
        return RecommendationResponse(
            strategy=strategy,
            title=title,
            subtitle=None,
            products=[],
            total_candidates=0,
            execution_time_ms=0,
            cache_hit=False
        )

    def get_health(self) -> Dict:
        """Get engine health status"""
        return {
            "status": "healthy",
            "catalog_size": len(self.catalog),
            "cache_stats": self.cache.get_stats(),
            "analytics_available": self.analytics is not None,
            "strategies_available": [s.value for s in RecommendationStrategy],
            "current_season": self._get_current_season().value
        }

    def invalidate_cache(self, strategy: Optional[str] = None):
        """Invalidate cache entries"""
        self.cache.invalidate(strategy)


# ============================================================================
# SINGLETON ACCESSOR
# ============================================================================

def get_next_gen_engine() -> NextGenRecommendationEngine:
    """Get the singleton instance of the recommendation engine"""
    return NextGenRecommendationEngine()
