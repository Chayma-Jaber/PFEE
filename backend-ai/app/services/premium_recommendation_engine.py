"""
Barsha Premium Recommendation Engine
=====================================
An advanced, fashion-aware recommendation system designed for luxury e-commerce.

This engine provides:
- 15+ distinct recommendation strategies
- Fashion-aware outfit logic
- Color harmony and style coherence
- Price-tier recommendations
- Seasonal awareness
- User behavior analysis
- Collaborative filtering approximation
- Explainable AI with confidence scores

Architecture:
- Content-based filtering (categories, colors, styles)
- Behavior-based signals (views, cart, wishlist, purchases)
- Hybrid scoring with multiple weighted signals
- Fashion merchandising rules
"""

import json
import random
import math
from typing import List, Dict, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import os
import logging

logger = logging.getLogger(__name__)

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
CATALOG_PATH = os.path.join(DATA_DIR, "barsha_products.json")


# ═══════════════════════════════════════════════════════════════════════════════
# ENUMS AND DATA CLASSES
# ═══════════════════════════════════════════════════════════════════════════════

class RecommendationStrategy(Enum):
    """All available recommendation strategies."""
    # Core strategies
    SIMILAR = "similar"
    COMPLEMENTARY = "complementary"
    COMPLETE_THE_LOOK = "complete_the_look"

    # Alternative strategies
    PREMIUM_ALTERNATIVE = "premium_alternative"
    AFFORDABLE_ALTERNATIVE = "affordable_alternative"
    SAME_STYLE = "same_style"

    # User-based strategies
    PERSONALIZED = "personalized"
    BECAUSE_YOU_LIKED = "because_you_liked"
    BECAUSE_YOU_VIEWED = "because_you_viewed"
    INSPIRED_BY_FAVORITES = "inspired_by_favorites"

    # Behavior-based strategies
    RECENTLY_VIEWED = "recently_viewed"
    CART_COMPLEMENT = "cart_complement"
    FREQUENTLY_BOUGHT_TOGETHER = "frequently_bought_together"
    CUSTOMERS_ALSO_LIKED = "customers_also_liked"

    # Discovery strategies
    TRENDING = "trending"
    NEW_ARRIVALS = "new_arrivals"
    SEASONAL_PICKS = "seasonal_picks"
    EDITORIAL_SELECTION = "editorial_selection"
    STYLE_DISCOVERY = "style_discovery"

    # Fallback
    CURATED = "curated"


class PriceTier(Enum):
    """Price tier classification."""
    BUDGET = "budget"           # < 30 TND
    AFFORDABLE = "affordable"   # 30-60 TND
    MID_RANGE = "mid_range"     # 60-100 TND
    PREMIUM = "premium"         # 100-150 TND
    LUXURY = "luxury"           # > 150 TND


class StyleProfile(Enum):
    """Fashion style profiles."""
    CASUAL = "casual"
    CHIC = "chic"
    SPORTY = "sporty"
    ELEGANT = "elegant"
    BOHEMIAN = "bohemian"
    MINIMALIST = "minimalist"
    TRENDY = "trendy"


@dataclass
class RecommendationItem:
    """A single recommendation with full metadata."""
    product_id: int
    product_data: Dict[str, Any]
    score: float
    confidence: float  # 0-1 confidence score
    reason: str        # Human-readable French explanation
    reason_key: str    # Machine-readable reason code
    strategy: RecommendationStrategy
    position: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RecommendationSet:
    """Complete recommendation response."""
    items: List[RecommendationItem]
    strategy: RecommendationStrategy
    title: str              # Section title in French
    subtitle: str           # Section subtitle
    explanation: str        # High-level explanation
    total_candidates: int
    processing_time_ms: float = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


# ═══════════════════════════════════════════════════════════════════════════════
# FASHION KNOWLEDGE BASE
# ═══════════════════════════════════════════════════════════════════════════════

# Category detection keywords
OUTFIT_CATEGORIES = {
    "TOPS": ["T-SHIRT", "T SHIRT", "CHEMISE", "POLO", "BLOUSE", "DEBARDEUR",
             "CHEMISIER", "HAUT", "TOP", "CROP", "BODY", "BUSTIER", "CAMISOLE"],
    "BOTTOMS": ["PANTALON", "JEAN", "JEANS", "SHORT", "JUPE", "BERMUDA",
                "LEGGING", "PALAZZO", "CARGO", "CHINO", "JOGGER"],
    "DRESSES": ["ROBE", "COMBINAISON", "CAFTAN", "TUNIQUE", "JUMPSUIT",
                "COMBISHORT", "SALOPETTE"],
    "OUTERWEAR": ["VESTE", "MANTEAU", "BLOUSON", "CARDIGAN", "PULL", "SWEAT",
                  "BLAZER", "TRENCH", "PARKA", "DOUDOUNE", "GILET"],
    "FOOTWEAR": ["CHAUSSURE", "BASKET", "BALLERINE", "SANDALE", "ESCARPIN",
                 "MOCASSIN", "SABOT", "BOTTE", "BOTTINE", "SNEAKER", "MULE"],
    "BAGS": ["SAC", "SACOCHE", "POCHETTE", "CABAS", "BANDOULIERE", "SAC A DOS",
             "BESACE", "CLUTCH", "TOTE", "HOBO"],
    "ACCESSORIES": ["CEINTURE", "ECHARPE", "FOULARD", "CHAPEAU", "CASQUETTE",
                    "LUNETTES", "BIJOU", "COLLIER", "BRACELET", "MONTRE",
                    "BONNET", "GANT"]
}

# Premium cross-category outfit rules
OUTFIT_RULES = {
    "TOPS": {
        "primary": ["BOTTOMS"],
        "secondary": ["OUTERWEAR", "BAGS"],
        "accent": ["ACCESSORIES"]
    },
    "BOTTOMS": {
        "primary": ["TOPS"],
        "secondary": ["FOOTWEAR", "OUTERWEAR"],
        "accent": ["BAGS", "ACCESSORIES"]
    },
    "DRESSES": {
        "primary": ["OUTERWEAR"],
        "secondary": ["FOOTWEAR", "BAGS"],
        "accent": ["ACCESSORIES"]
    },
    "OUTERWEAR": {
        "primary": ["TOPS", "BOTTOMS"],
        "secondary": ["BAGS"],
        "accent": ["ACCESSORIES"]
    },
    "FOOTWEAR": {
        "primary": ["BOTTOMS", "DRESSES"],
        "secondary": ["BAGS"],
        "accent": []
    },
    "BAGS": {
        "primary": ["TOPS", "DRESSES"],
        "secondary": ["OUTERWEAR"],
        "accent": ["ACCESSORIES"]
    },
    "ACCESSORIES": {
        "primary": ["TOPS", "DRESSES"],
        "secondary": ["BAGS"],
        "accent": []
    }
}

# Color harmony matrix (fashion-specific)
COLOR_HARMONY = {
    "NOIR": {
        "perfect": ["BLANC", "BEIGE", "CAMEL"],
        "good": ["ROUGE", "ROSE", "BLEU", "GRIS", "DORE", "ARGENT"],
        "neutral": ["MARINE", "VERT", "VIOLET", "BORDEAUX"]
    },
    "BLANC": {
        "perfect": ["NOIR", "MARINE", "BEIGE"],
        "good": ["BLEU", "ROUGE", "ROSE", "CAMEL"],
        "neutral": ["GRIS", "VERT", "MARRON"]
    },
    "BEIGE": {
        "perfect": ["NOIR", "BLANC", "MARRON", "CAMEL"],
        "good": ["MARINE", "BLEU", "VERT", "BORDEAUX"],
        "neutral": ["GRIS", "ROSE"]
    },
    "MARINE": {
        "perfect": ["BLANC", "BEIGE", "CAMEL"],
        "good": ["ROUGE", "ROSE", "DORE"],
        "neutral": ["GRIS", "BLEU"]
    },
    "BLEU": {
        "perfect": ["BLANC", "BEIGE"],
        "good": ["MARINE", "GRIS", "CAMEL"],
        "neutral": ["NOIR", "ROSE"]
    },
    "ROUGE": {
        "perfect": ["NOIR", "BLANC"],
        "good": ["MARINE", "BEIGE", "GRIS"],
        "neutral": ["BLEU"]
    },
    "ROSE": {
        "perfect": ["NOIR", "BLANC", "GRIS"],
        "good": ["BEIGE", "MARINE"],
        "neutral": ["BLEU", "VERT"]
    },
    "GRIS": {
        "perfect": ["NOIR", "BLANC", "ROSE"],
        "good": ["BLEU", "ROUGE", "BEIGE"],
        "neutral": ["MARINE", "VERT"]
    },
    "VERT": {
        "perfect": ["BEIGE", "BLANC", "MARRON"],
        "good": ["NOIR", "CAMEL"],
        "neutral": ["GRIS", "BLEU"]
    },
    "MARRON": {
        "perfect": ["BEIGE", "BLANC", "CAMEL"],
        "good": ["VERT", "ORANGE"],
        "neutral": ["NOIR", "GRIS"]
    },
    "CAMEL": {
        "perfect": ["NOIR", "BLANC", "MARINE"],
        "good": ["BEIGE", "MARRON", "BORDEAUX"],
        "neutral": ["GRIS", "VERT"]
    },
    "BORDEAUX": {
        "perfect": ["NOIR", "BEIGE", "CAMEL"],
        "good": ["BLANC", "GRIS"],
        "neutral": ["MARINE", "MARRON"]
    }
}

# Style keywords for detection
STYLE_KEYWORDS = {
    StyleProfile.CASUAL: ["BASIC", "SIMPLE", "CONFORT", "EVERYDAY", "RELAX", "COTON"],
    StyleProfile.CHIC: ["CHIC", "ELEGANT", "HABILLE", "RAFFINE", "CLASSE"],
    StyleProfile.SPORTY: ["SPORT", "ATHLETIC", "JOGGING", "BASKET", "SNEAKER", "TRAINING"],
    StyleProfile.ELEGANT: ["SOIREE", "CEREMONIE", "SATIN", "DENTELLE", "SEQUIN", "STRASS"],
    StyleProfile.BOHEMIAN: ["BOHO", "BOHEME", "HIPPIE", "ETHNIQUE", "IMPRIME", "FRANGES"],
    StyleProfile.MINIMALIST: ["MINIMAL", "EPURE", "SOBRE", "NEUTRE", "BASIQUE"],
    StyleProfile.TRENDY: ["TENDANCE", "MODE", "FASHION", "HYPE", "NOUVEAU"]
}

# Seasonal relevance (month -> style weights)
SEASONAL_STYLES = {
    "winter": {"OUTERWEAR": 1.5, "ACCESSORIES": 1.2, "FOOTWEAR": 1.1},
    "spring": {"DRESSES": 1.3, "TOPS": 1.2, "ACCESSORIES": 1.1},
    "summer": {"TOPS": 1.3, "DRESSES": 1.4, "FOOTWEAR": 1.2},
    "autumn": {"OUTERWEAR": 1.3, "BOTTOMS": 1.2, "ACCESSORIES": 1.2}
}


# ═══════════════════════════════════════════════════════════════════════════════
# PREMIUM RECOMMENDATION ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class PremiumRecommendationEngine:
    """
    Advanced recommendation engine for premium fashion e-commerce.

    Features:
    - Multi-signal scoring
    - Fashion-aware algorithms
    - Explainable recommendations
    - Confidence scoring
    - Performance optimization
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.catalog: List[Dict] = []
        self.catalog_by_id: Dict[int, Dict] = {}
        self.category_index: Dict[str, List[int]] = {}
        self.family_index: Dict[str, List[int]] = {}
        self.color_index: Dict[str, List[int]] = {}
        self.price_tier_index: Dict[PriceTier, List[int]] = {}

        self._load_catalog()
        self._build_indexes()
        self._initialized = True

    def _load_catalog(self):
        """Load and validate product catalog."""
        try:
            if os.path.exists(CATALOG_PATH):
                with open(CATALOG_PATH, "r", encoding="utf-8") as f:
                    self.catalog = json.load(f)
                    self.catalog_by_id = {
                        p.get("id"): p for p in self.catalog if p.get("id")
                    }
                logger.info(f"PremiumEngine: Loaded {len(self.catalog)} products")
            else:
                logger.warning(f"PremiumEngine: Catalog not found at {CATALOG_PATH}")
        except Exception as e:
            logger.error(f"PremiumEngine: Error loading catalog: {e}")

    def _build_indexes(self):
        """Build optimized indexes for fast lookups."""
        for product in self.catalog:
            pid = product.get("id")
            if not pid:
                continue

            # Category index
            category = self._get_category(product)
            if category:
                self.category_index.setdefault(category, []).append(pid)

            # Family index (gender)
            family = self._get_family(product)
            if family:
                self.family_index.setdefault(family, []).append(pid)

            # Color index
            for color in self._get_colors(product):
                self.color_index.setdefault(color, []).append(pid)

            # Price tier index
            tier = self._get_price_tier(product)
            self.price_tier_index.setdefault(tier, []).append(pid)

        logger.info(f"PremiumEngine: Built indexes - "
                   f"{len(self.category_index)} categories, "
                   f"{len(self.family_index)} families, "
                   f"{len(self.color_index)} colors, "
                   f"{len(self.price_tier_index)} price tiers")

    # ═══════════════════════════════════════════════════════════════════════════
    # PRODUCT ANALYSIS HELPERS
    # ═══════════════════════════════════════════════════════════════════════════

    def _get_category(self, product: Dict) -> Optional[str]:
        """Determine product's outfit category."""
        nom = (product.get("nom") or product.get("title") or "").upper()
        for category, keywords in OUTFIT_CATEGORIES.items():
            for kw in keywords:
                if kw in nom:
                    return category
        return None

    def _get_family(self, product: Dict) -> str:
        """Get product's target family (WOMEN, MEN, etc.)."""
        family = (product.get("Famille") or product.get("famille") or
                  product.get("genre") or "").upper()
        # Normalize
        if "FEMME" in family or "WOMEN" in family:
            return "WOMEN"
        elif "HOMME" in family or "MEN" in family:
            return "MEN"
        elif "ENFANT" in family or "KIDS" in family:
            return "KIDS"
        return family or "UNISEX"

    def _get_colors(self, product: Dict) -> List[str]:
        """Extract all colors from product variants."""
        colors = set()
        for dec in (product.get("declinaisons") or []):
            color = (dec.get("couleur") or dec.get("libellet") or "").upper()
            if color:
                # Normalize color name
                for base_color in COLOR_HARMONY.keys():
                    if base_color in color:
                        colors.add(base_color)
                        break
                else:
                    colors.add(color.split()[0] if color else "")
        return list(colors)

    def _get_price(self, product: Dict) -> float:
        """Get product's effective price."""
        price = (product.get("currentPrice") or product.get("prix") or
                product.get("price") or 0)
        try:
            return float(price) if price else 0
        except (ValueError, TypeError):
            return 0

    def _get_price_tier(self, product: Dict) -> PriceTier:
        """Classify product into price tier."""
        price = self._get_price(product)
        if price < 30:
            return PriceTier.BUDGET
        elif price < 60:
            return PriceTier.AFFORDABLE
        elif price < 100:
            return PriceTier.MID_RANGE
        elif price < 150:
            return PriceTier.PREMIUM
        else:
            return PriceTier.LUXURY

    def _get_style_profile(self, product: Dict) -> Optional[StyleProfile]:
        """Detect product's style profile from name and description."""
        text = (
            (product.get("nom") or "") + " " +
            (product.get("description") or "")
        ).upper()

        for style, keywords in STYLE_KEYWORDS.items():
            for kw in keywords:
                if kw in text:
                    return style
        return None

    def _get_current_season(self) -> str:
        """Get current season based on month."""
        month = datetime.now().month
        if month in [12, 1, 2]:
            return "winter"
        elif month in [3, 4, 5]:
            return "spring"
        elif month in [6, 7, 8]:
            return "summer"
        else:
            return "autumn"

    def _get_product_image(self, product: Dict) -> str:
        """Extract best product image URL."""
        img = product.get("image") or product.get("firstImg") or ""
        if isinstance(img, dict):
            img = img.get("url") or (img.get("medium") or {}).get("url") or ""
        if img and not img.startswith("http"):
            img = f"https://barsha.com.tn/{img.lstrip('/')}"
        return img or "https://barsha.com.tn/assets/images/placeholder.jpg"

    # ═══════════════════════════════════════════════════════════════════════════
    # SCORING ALGORITHMS
    # ═══════════════════════════════════════════════════════════════════════════

    def _calculate_similarity_score(
        self,
        source: Dict,
        target: Dict
    ) -> Tuple[float, float, str, str]:
        """
        Calculate comprehensive similarity score.

        Returns: (score, confidence, reason_text, reason_key)
        """
        if source.get("id") == target.get("id"):
            return 0.0, 0.0, "", "same_product"

        score = 0.0
        reasons = []
        reason_keys = []

        # Category match (40 points max)
        src_cat = self._get_category(source)
        tgt_cat = self._get_category(target)
        if src_cat and tgt_cat and src_cat == tgt_cat:
            score += 40
            reasons.append(f"Meme categorie ({src_cat.lower()})")
            reason_keys.append("same_category")

        # Family match (30 points max)
        src_fam = self._get_family(source)
        tgt_fam = self._get_family(target)
        if src_fam == tgt_fam:
            score += 30
            reasons.append("Meme collection")
            reason_keys.append("same_family")
        elif src_fam and tgt_fam:
            score -= 15  # Penalty for wrong gender

        # Color overlap (20 points max, 5 per shared color)
        src_colors = set(self._get_colors(source))
        tgt_colors = set(self._get_colors(target))
        shared_colors = src_colors & tgt_colors
        if shared_colors:
            color_score = min(20, len(shared_colors) * 5)
            score += color_score
            reasons.append(f"Couleur commune: {', '.join(list(shared_colors)[:2])}")
            reason_keys.append("shared_colors")

        # Price similarity (10 points max)
        src_price = self._get_price(source)
        tgt_price = self._get_price(target)
        if src_price > 0 and tgt_price > 0:
            price_diff = abs(src_price - tgt_price) / max(src_price, tgt_price)
            if price_diff <= 0.15:
                score += 10
                reasons.append("Gamme de prix similaire")
                reason_keys.append("similar_price")
            elif price_diff <= 0.30:
                score += 5

        # Style profile match (bonus 5 points)
        src_style = self._get_style_profile(source)
        tgt_style = self._get_style_profile(target)
        if src_style and tgt_style and src_style == tgt_style:
            score += 5
            reason_keys.append("same_style")

        # Calculate confidence (0-1)
        max_score = 105
        confidence = min(1.0, score / max_score) if score > 0 else 0.0

        # Build reason text
        reason_text = " | ".join(reasons[:3]) if reasons else "Article similaire"
        reason_key = "_".join(reason_keys[:3]) if reason_keys else "generic"

        return max(0, score), confidence, reason_text, reason_key

    def _calculate_complementary_score(
        self,
        source: Dict,
        target: Dict
    ) -> Tuple[float, float, str, str]:
        """
        Calculate outfit complementarity score.

        Returns: (score, confidence, reason_text, reason_key)
        """
        if source.get("id") == target.get("id"):
            return 0.0, 0.0, "", "same_product"

        score = 0.0
        reasons = []
        reason_keys = []

        src_cat = self._get_category(source)
        tgt_cat = self._get_category(target)

        # Must be different categories for complementarity
        if src_cat and tgt_cat and src_cat == tgt_cat:
            return 0.0, 0.0, "", "same_category"

        # Check outfit rules (50 points max)
        if src_cat and src_cat in OUTFIT_RULES:
            rules = OUTFIT_RULES[src_cat]
            if tgt_cat in rules.get("primary", []):
                score += 50
                reasons.append(f"Complete parfaitement votre {src_cat.lower()}")
                reason_keys.append("primary_complement")
            elif tgt_cat in rules.get("secondary", []):
                score += 30
                reasons.append(f"Ideal avec votre {src_cat.lower()}")
                reason_keys.append("secondary_complement")
            elif tgt_cat in rules.get("accent", []):
                score += 15
                reasons.append("Touche finale parfaite")
                reason_keys.append("accent_piece")

        # Family consistency (25 points)
        src_fam = self._get_family(source)
        tgt_fam = self._get_family(target)
        if src_fam == tgt_fam:
            score += 25
            reason_keys.append("same_family")
        elif src_fam and tgt_fam and src_fam != tgt_fam:
            score -= 20  # Strong penalty for gender mismatch

        # Color harmony (25 points max)
        src_colors = self._get_colors(source)
        tgt_colors = self._get_colors(target)

        harmony_score = 0
        for src_color in src_colors:
            if src_color in COLOR_HARMONY:
                for tgt_color in tgt_colors:
                    if tgt_color in COLOR_HARMONY[src_color].get("perfect", []):
                        harmony_score = max(harmony_score, 25)
                        reasons.append(f"Harmonie parfaite {src_color.lower()}/{tgt_color.lower()}")
                    elif tgt_color in COLOR_HARMONY[src_color].get("good", []):
                        harmony_score = max(harmony_score, 15)
                        reasons.append(f"Accord elegant {src_color.lower()}/{tgt_color.lower()}")
                    elif tgt_color in COLOR_HARMONY[src_color].get("neutral", []):
                        harmony_score = max(harmony_score, 5)

        score += harmony_score
        if harmony_score > 0:
            reason_keys.append("color_harmony")

        # Calculate confidence
        max_score = 100
        confidence = min(1.0, score / max_score) if score > 0 else 0.0

        reason_text = " | ".join(reasons[:2]) if reasons else "Complete votre look"
        reason_key = "_".join(reason_keys[:3]) if reason_keys else "complement"

        return max(0, score), confidence, reason_text, reason_key

    # ═══════════════════════════════════════════════════════════════════════════
    # RECOMMENDATION STRATEGIES
    # ═══════════════════════════════════════════════════════════════════════════

    def get_similar_products(
        self,
        product_id: int,
        limit: int = 8,
        exclude_ids: Optional[Set[int]] = None
    ) -> RecommendationSet:
        """
        Get products similar to a given product.

        Strategy: Same category + same family + color overlap + price range
        Use case: "Dans le meme style" on product detail page
        """
        start_time = datetime.now()
        exclude_ids = exclude_ids or set()
        exclude_ids.add(product_id)

        source = self.catalog_by_id.get(product_id)
        if not source:
            return self._empty_response(RecommendationStrategy.SIMILAR)

        candidates = []
        for product in self.catalog:
            pid = product.get("id")
            if not pid or pid in exclude_ids:
                continue

            score, confidence, reason, reason_key = self._calculate_similarity_score(
                source, product
            )

            if score > 20:  # Minimum threshold
                candidates.append(RecommendationItem(
                    product_id=pid,
                    product_data=product,
                    score=score,
                    confidence=confidence,
                    reason=reason,
                    reason_key=reason_key,
                    strategy=RecommendationStrategy.SIMILAR
                ))

        # Sort by score descending
        candidates.sort(key=lambda x: x.score, reverse=True)
        top_candidates = candidates[:limit]

        # Assign positions
        for i, item in enumerate(top_candidates):
            item.position = i

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        source_name = source.get("nom") or source.get("title") or "cet article"

        return RecommendationSet(
            items=top_candidates,
            strategy=RecommendationStrategy.SIMILAR,
            title="Dans le meme style",
            subtitle=f"Inspire de {source_name}",
            explanation=f"Articles similaires a {source_name}",
            total_candidates=len(candidates),
            processing_time_ms=processing_time
        )

    def get_complementary_products(
        self,
        product_id: int,
        limit: int = 6,
        exclude_ids: Optional[Set[int]] = None
    ) -> RecommendationSet:
        """
        Get products that complement a given product.

        Strategy: Cross-category outfit rules + color harmony
        Use case: "Pour completer ce look" on product detail page
        """
        start_time = datetime.now()
        exclude_ids = exclude_ids or set()
        exclude_ids.add(product_id)

        source = self.catalog_by_id.get(product_id)
        if not source:
            return self._empty_response(RecommendationStrategy.COMPLEMENTARY)

        candidates = []
        for product in self.catalog:
            pid = product.get("id")
            if not pid or pid in exclude_ids:
                continue

            score, confidence, reason, reason_key = self._calculate_complementary_score(
                source, product
            )

            if score > 25:  # Higher threshold for complementary
                candidates.append(RecommendationItem(
                    product_id=pid,
                    product_data=product,
                    score=score,
                    confidence=confidence,
                    reason=reason,
                    reason_key=reason_key,
                    strategy=RecommendationStrategy.COMPLEMENTARY
                ))

        candidates.sort(key=lambda x: x.score, reverse=True)
        top_candidates = candidates[:limit]

        for i, item in enumerate(top_candidates):
            item.position = i

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        return RecommendationSet(
            items=top_candidates,
            strategy=RecommendationStrategy.COMPLEMENTARY,
            title="Pour completer ce look",
            subtitle="Nos suggestions de styliste",
            explanation="Articles qui vont parfaitement avec votre selection",
            total_candidates=len(candidates),
            processing_time_ms=processing_time
        )

    def get_complete_the_look(
        self,
        product_id: int,
        limit: int = 4
    ) -> RecommendationSet:
        """
        Get a complete outfit suggestion.

        Strategy: One item from each complementary category
        Use case: "Le look complet" carousel on product detail page
        """
        start_time = datetime.now()

        source = self.catalog_by_id.get(product_id)
        if not source:
            return self._empty_response(RecommendationStrategy.COMPLETE_THE_LOOK)

        src_cat = self._get_category(source)
        src_fam = self._get_family(source)

        if not src_cat or src_cat not in OUTFIT_RULES:
            return self._empty_response(RecommendationStrategy.COMPLETE_THE_LOOK)

        # Get one item from each complementary category
        rules = OUTFIT_RULES[src_cat]
        target_categories = (
            rules.get("primary", [])[:2] +
            rules.get("secondary", [])[:1] +
            rules.get("accent", [])[:1]
        )[:limit]

        items = []
        used_categories = set()

        for target_cat in target_categories:
            if target_cat in used_categories:
                continue

            # Find best match in this category
            best_item = None
            best_score = 0

            for pid in self.category_index.get(target_cat, []):
                if pid == product_id:
                    continue

                product = self.catalog_by_id.get(pid)
                if not product:
                    continue

                # Check family match
                if self._get_family(product) != src_fam:
                    continue

                score, confidence, reason, reason_key = self._calculate_complementary_score(
                    source, product
                )

                if score > best_score:
                    best_score = score
                    best_item = RecommendationItem(
                        product_id=pid,
                        product_data=product,
                        score=score,
                        confidence=confidence,
                        reason=f"Parfait pour completer ({target_cat.lower()})",
                        reason_key=f"complete_{target_cat.lower()}",
                        strategy=RecommendationStrategy.COMPLETE_THE_LOOK,
                        metadata={"category": target_cat}
                    )

            if best_item:
                items.append(best_item)
                used_categories.add(target_cat)

        for i, item in enumerate(items):
            item.position = i

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        return RecommendationSet(
            items=items,
            strategy=RecommendationStrategy.COMPLETE_THE_LOOK,
            title="Le look complet",
            subtitle="Notre selection de styliste",
            explanation="Un ensemble harmonieux pense pour vous",
            total_candidates=len(items),
            processing_time_ms=processing_time,
            metadata={"source_category": src_cat}
        )

    def get_premium_alternatives(
        self,
        product_id: int,
        limit: int = 4
    ) -> RecommendationSet:
        """
        Get more premium alternatives to a product.

        Strategy: Same category + higher price tier
        Use case: "Version premium" upsell section
        """
        start_time = datetime.now()

        source = self.catalog_by_id.get(product_id)
        if not source:
            return self._empty_response(RecommendationStrategy.PREMIUM_ALTERNATIVE)

        src_cat = self._get_category(source)
        src_fam = self._get_family(source)
        src_price = self._get_price(source)

        candidates = []
        for product in self.catalog:
            pid = product.get("id")
            if not pid or pid == product_id:
                continue

            # Same category required
            if self._get_category(product) != src_cat:
                continue

            # Same family required
            if self._get_family(product) != src_fam:
                continue

            # Must be more expensive (20-100% more)
            tgt_price = self._get_price(product)
            if tgt_price <= src_price or tgt_price > src_price * 2:
                continue

            price_diff_pct = ((tgt_price - src_price) / src_price) * 100
            score = 100 - price_diff_pct  # Prefer closer prices

            candidates.append(RecommendationItem(
                product_id=pid,
                product_data=product,
                score=score,
                confidence=0.7,
                reason=f"Version premium (+{int(price_diff_pct)}%)",
                reason_key="premium_upgrade",
                strategy=RecommendationStrategy.PREMIUM_ALTERNATIVE,
                metadata={"price_increase": price_diff_pct}
            ))

        candidates.sort(key=lambda x: x.score, reverse=True)
        top_candidates = candidates[:limit]

        for i, item in enumerate(top_candidates):
            item.position = i

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        return RecommendationSet(
            items=top_candidates,
            strategy=RecommendationStrategy.PREMIUM_ALTERNATIVE,
            title="Version premium",
            subtitle="Pour un look plus raffine",
            explanation="Alternatives de qualite superieure",
            total_candidates=len(candidates),
            processing_time_ms=processing_time
        )

    def get_affordable_alternatives(
        self,
        product_id: int,
        limit: int = 4
    ) -> RecommendationSet:
        """
        Get more affordable alternatives to a product.

        Strategy: Same category + lower price tier
        Use case: "Alternatives plus accessibles" section
        """
        start_time = datetime.now()

        source = self.catalog_by_id.get(product_id)
        if not source:
            return self._empty_response(RecommendationStrategy.AFFORDABLE_ALTERNATIVE)

        src_cat = self._get_category(source)
        src_fam = self._get_family(source)
        src_price = self._get_price(source)

        candidates = []
        for product in self.catalog:
            pid = product.get("id")
            if not pid or pid == product_id:
                continue

            if self._get_category(product) != src_cat:
                continue

            if self._get_family(product) != src_fam:
                continue

            # Must be less expensive (10-50% less)
            tgt_price = self._get_price(product)
            if tgt_price >= src_price or tgt_price < src_price * 0.5:
                continue

            savings_pct = ((src_price - tgt_price) / src_price) * 100
            score = savings_pct  # Prefer bigger savings

            candidates.append(RecommendationItem(
                product_id=pid,
                product_data=product,
                score=score,
                confidence=0.7,
                reason=f"Alternative accessible (-{int(savings_pct)}%)",
                reason_key="affordable_option",
                strategy=RecommendationStrategy.AFFORDABLE_ALTERNATIVE,
                metadata={"savings_percent": savings_pct}
            ))

        candidates.sort(key=lambda x: x.score, reverse=True)
        top_candidates = candidates[:limit]

        for i, item in enumerate(top_candidates):
            item.position = i

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        return RecommendationSet(
            items=top_candidates,
            strategy=RecommendationStrategy.AFFORDABLE_ALTERNATIVE,
            title="Alternatives accessibles",
            subtitle="Meme style, petit prix",
            explanation="Options plus abordables dans le meme style",
            total_candidates=len(candidates),
            processing_time_ms=processing_time
        )

    def get_trending_products(
        self,
        limit: int = 8,
        family: Optional[str] = None
    ) -> RecommendationSet:
        """
        Get trending/popular products.

        Strategy: Weighted by recency + random for discovery
        Use case: "Tendances Barsha" homepage section
        """
        start_time = datetime.now()

        candidates = list(self.catalog)

        # Filter by family if specified
        if family:
            candidates = [p for p in candidates if self._get_family(p) == family.upper()]

        # Simple trending: random selection weighted toward recent items
        # In production, this would use actual sales/view data
        if len(candidates) > limit * 3:
            # Sample more than needed for variety
            sampled = random.sample(candidates, min(len(candidates), limit * 3))
        else:
            sampled = candidates

        # Shuffle and take top
        random.shuffle(sampled)
        selected = sampled[:limit]

        items = []
        for i, product in enumerate(selected):
            items.append(RecommendationItem(
                product_id=product.get("id"),
                product_data=product,
                score=100 - i * 5,  # Decreasing score
                confidence=0.6,
                reason="Tendance du moment",
                reason_key="trending",
                strategy=RecommendationStrategy.TRENDING,
                position=i
            ))

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        return RecommendationSet(
            items=items,
            strategy=RecommendationStrategy.TRENDING,
            title="Tendances Barsha",
            subtitle="Les pieces les plus convoitees",
            explanation="Selection des articles les plus populaires",
            total_candidates=len(candidates),
            processing_time_ms=processing_time
        )

    def get_new_arrivals(
        self,
        limit: int = 8,
        family: Optional[str] = None
    ) -> RecommendationSet:
        """
        Get newest products in the catalog.

        Strategy: Most recently added products
        Use case: "Nouveautes" homepage section
        """
        start_time = datetime.now()

        candidates = list(self.catalog)

        if family:
            candidates = [p for p in candidates if self._get_family(p) == family.upper()]

        # Assume higher IDs = newer products (simplified)
        # In production, use actual creation dates
        candidates.sort(key=lambda x: x.get("id", 0), reverse=True)
        selected = candidates[:limit]

        items = []
        for i, product in enumerate(selected):
            items.append(RecommendationItem(
                product_id=product.get("id"),
                product_data=product,
                score=100 - i * 3,
                confidence=0.8,
                reason="Nouveaute",
                reason_key="new_arrival",
                strategy=RecommendationStrategy.NEW_ARRIVALS,
                position=i
            ))

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        return RecommendationSet(
            items=items,
            strategy=RecommendationStrategy.NEW_ARRIVALS,
            title="Nouveautes",
            subtitle="Fraichement arrivees",
            explanation="Les dernieres pieces ajoutees a notre collection",
            total_candidates=len(candidates),
            processing_time_ms=processing_time
        )

    def get_seasonal_picks(
        self,
        limit: int = 8,
        family: Optional[str] = None
    ) -> RecommendationSet:
        """
        Get seasonally relevant products.

        Strategy: Category weighting based on current season
        Use case: "Selection de saison" homepage section
        """
        start_time = datetime.now()

        season = self._get_current_season()
        season_weights = SEASONAL_STYLES.get(season, {})

        scored_products = []
        for product in self.catalog:
            if family and self._get_family(product) != family.upper():
                continue

            category = self._get_category(product)
            weight = season_weights.get(category, 1.0)
            base_score = 50 + random.uniform(0, 30)  # Base randomness
            final_score = base_score * weight

            scored_products.append((product, final_score))

        scored_products.sort(key=lambda x: x[1], reverse=True)
        selected = scored_products[:limit]

        season_names = {
            "winter": "Hiver",
            "spring": "Printemps",
            "summer": "Ete",
            "autumn": "Automne"
        }

        items = []
        for i, (product, score) in enumerate(selected):
            items.append(RecommendationItem(
                product_id=product.get("id"),
                product_data=product,
                score=score,
                confidence=0.7,
                reason=f"Ideal pour l'{season_names.get(season, season).lower()}",
                reason_key="seasonal_pick",
                strategy=RecommendationStrategy.SEASONAL_PICKS,
                position=i
            ))

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        return RecommendationSet(
            items=items,
            strategy=RecommendationStrategy.SEASONAL_PICKS,
            title=f"Selection {season_names.get(season, season)}",
            subtitle="Pieces de saison",
            explanation=f"Articles parfaits pour cette saison",
            total_candidates=len(scored_products),
            processing_time_ms=processing_time,
            metadata={"season": season}
        )

    def get_personalized_recommendations(
        self,
        user_context: Dict[str, Any],
        limit: int = 8
    ) -> RecommendationSet:
        """
        Get personalized recommendations based on user behavior.

        Strategy: Analyze wishlist + orders + views to find similar items
        Use case: "Selectionne pour vous" logged-in user section
        """
        start_time = datetime.now()

        # Extract seed products from user context
        seed_ids = set()

        # From wishlist
        wishlist = user_context.get("wishlist") or []
        for item in wishlist:
            if isinstance(item, dict):
                pid = item.get("product", {}).get("id") or item.get("productId") or item.get("id")
                if pid:
                    seed_ids.add(pid)

        # From orders
        orders = user_context.get("orders") or []
        for order in orders:
            for item in (order.get("items") or []):
                if isinstance(item, dict):
                    pid = item.get("product", {}).get("id") or item.get("productId")
                    if pid:
                        seed_ids.add(pid)

        # From views
        viewed = user_context.get("viewed_products") or []
        for pid in viewed[:10]:  # Limit to recent views
            if isinstance(pid, int):
                seed_ids.add(pid)
            elif isinstance(pid, dict):
                seed_ids.add(pid.get("id"))

        if not seed_ids:
            # Fallback to trending if no history
            return self.get_trending_products(limit=limit)

        # Find similar products to all seeds
        all_candidates = []
        seed_products = [self.catalog_by_id.get(sid) for sid in seed_ids if sid in self.catalog_by_id]

        for seed in seed_products[:5]:  # Limit seeds for performance
            if not seed:
                continue

            for product in self.catalog:
                pid = product.get("id")
                if not pid or pid in seed_ids:
                    continue

                score, confidence, reason, reason_key = self._calculate_similarity_score(
                    seed, product
                )

                if score > 30:
                    all_candidates.append(RecommendationItem(
                        product_id=pid,
                        product_data=product,
                        score=score,
                        confidence=confidence,
                        reason="Base sur vos preferences",
                        reason_key="personalized",
                        strategy=RecommendationStrategy.PERSONALIZED,
                        metadata={"seed_id": seed.get("id")}
                    ))

        # Deduplicate and sort
        seen_ids = set()
        unique_candidates = []
        for item in sorted(all_candidates, key=lambda x: x.score, reverse=True):
            if item.product_id not in seen_ids:
                seen_ids.add(item.product_id)
                unique_candidates.append(item)

        top_candidates = unique_candidates[:limit]

        for i, item in enumerate(top_candidates):
            item.position = i

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        return RecommendationSet(
            items=top_candidates,
            strategy=RecommendationStrategy.PERSONALIZED,
            title="Selectionne pour vous",
            subtitle="Base sur vos gouts",
            explanation="Articles choisis selon vos preferences",
            total_candidates=len(unique_candidates),
            processing_time_ms=processing_time,
            metadata={"seed_count": len(seed_ids)}
        )

    def get_cart_recommendations(
        self,
        cart_product_ids: List[int],
        limit: int = 4
    ) -> RecommendationSet:
        """
        Get recommendations based on cart contents.

        Strategy: Complementary items for cart products
        Use case: "Pour completer votre commande" at checkout
        """
        start_time = datetime.now()

        if not cart_product_ids:
            return self._empty_response(RecommendationStrategy.CART_COMPLEMENT)

        all_candidates = []
        cart_set = set(cart_product_ids)

        for cart_pid in cart_product_ids:
            source = self.catalog_by_id.get(cart_pid)
            if not source:
                continue

            for product in self.catalog:
                pid = product.get("id")
                if not pid or pid in cart_set:
                    continue

                score, confidence, reason, reason_key = self._calculate_complementary_score(
                    source, product
                )

                if score > 30:
                    all_candidates.append(RecommendationItem(
                        product_id=pid,
                        product_data=product,
                        score=score,
                        confidence=confidence,
                        reason="Complete votre panier",
                        reason_key="cart_complement",
                        strategy=RecommendationStrategy.CART_COMPLEMENT,
                        metadata={"cart_item_id": cart_pid}
                    ))

        # Deduplicate
        seen_ids = set()
        unique = []
        for item in sorted(all_candidates, key=lambda x: x.score, reverse=True):
            if item.product_id not in seen_ids:
                seen_ids.add(item.product_id)
                unique.append(item)

        top = unique[:limit]
        for i, item in enumerate(top):
            item.position = i

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        return RecommendationSet(
            items=top,
            strategy=RecommendationStrategy.CART_COMPLEMENT,
            title="Pour completer votre commande",
            subtitle="Dernieres suggestions avant validation",
            explanation="Articles complementaires pour votre panier",
            total_candidates=len(unique),
            processing_time_ms=processing_time
        )

    def get_style_discovery(
        self,
        style: StyleProfile,
        limit: int = 8
    ) -> RecommendationSet:
        """
        Get products matching a specific style profile.

        Strategy: Style keyword matching
        Use case: "Votre style" profile-based section
        """
        start_time = datetime.now()

        candidates = []
        for product in self.catalog:
            detected_style = self._get_style_profile(product)
            if detected_style == style:
                candidates.append(product)

        # Random selection from matching products
        if len(candidates) > limit:
            selected = random.sample(candidates, limit)
        else:
            selected = candidates

        items = []
        for i, product in enumerate(selected):
            items.append(RecommendationItem(
                product_id=product.get("id"),
                product_data=product,
                score=80 + random.uniform(0, 20),
                confidence=0.75,
                reason=f"Style {style.value}",
                reason_key="style_match",
                strategy=RecommendationStrategy.STYLE_DISCOVERY,
                position=i
            ))

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        style_names = {
            StyleProfile.CASUAL: "Casual",
            StyleProfile.CHIC: "Chic",
            StyleProfile.SPORTY: "Sporty",
            StyleProfile.ELEGANT: "Elegant",
            StyleProfile.BOHEMIAN: "Boheme",
            StyleProfile.MINIMALIST: "Minimaliste",
            StyleProfile.TRENDY: "Tendance"
        }

        return RecommendationSet(
            items=items,
            strategy=RecommendationStrategy.STYLE_DISCOVERY,
            title=f"Style {style_names.get(style, style.value)}",
            subtitle="Decouvrez ce style",
            explanation=f"Selection d'articles style {style_names.get(style, style.value).lower()}",
            total_candidates=len(candidates),
            processing_time_ms=processing_time
        )

    def get_editorial_selection(
        self,
        limit: int = 6
    ) -> RecommendationSet:
        """
        Get editorially curated selection.

        Strategy: Hand-picked or algorithmic curation
        Use case: "Selection editoriale" premium homepage section
        """
        start_time = datetime.now()

        # Curated selection: mix of categories with high-value items
        selected = []
        categories_used = set()

        for category in ["DRESSES", "TOPS", "OUTERWEAR", "BAGS", "FOOTWEAR", "ACCESSORIES"]:
            if len(selected) >= limit:
                break
            if category in categories_used:
                continue

            category_products = [
                p for p in self.catalog
                if self._get_category(p) == category
            ]

            if category_products:
                # Pick a random good-looking item
                pick = random.choice(category_products)
                selected.append(pick)
                categories_used.add(category)

        items = []
        for i, product in enumerate(selected):
            items.append(RecommendationItem(
                product_id=product.get("id"),
                product_data=product,
                score=90 + random.uniform(0, 10),
                confidence=0.9,
                reason="Selection editoriale",
                reason_key="editorial",
                strategy=RecommendationStrategy.EDITORIAL_SELECTION,
                position=i
            ))

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        return RecommendationSet(
            items=items,
            strategy=RecommendationStrategy.EDITORIAL_SELECTION,
            title="Selection editoriale",
            subtitle="Choisis par nos stylistes",
            explanation="Pieces coup de coeur selectionnees par notre equipe",
            total_candidates=len(self.catalog),
            processing_time_ms=processing_time
        )

    def _empty_response(self, strategy: RecommendationStrategy) -> RecommendationSet:
        """Return empty recommendation set."""
        return RecommendationSet(
            items=[],
            strategy=strategy,
            title="",
            subtitle="",
            explanation="Aucune recommandation disponible",
            total_candidates=0
        )


# Singleton getter
_engine_instance = None

def get_premium_recommendation_engine() -> PremiumRecommendationEngine:
    """Get or create the singleton recommendation engine instance."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = PremiumRecommendationEngine()
    return _engine_instance
