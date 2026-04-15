"""
Barsha AI Recommendation Engine
================================
A professional, explainable recommendation system with explicit strategies.

This module provides:
- Similar product recommendations (style, category, aesthetic)
- Complementary product recommendations (outfit logic, cross-sell)
- Personalized recommendations (user behavior, preferences)
- Trending/fallback recommendations

Each strategy is documented and returns explanations for why items are recommended.
"""

import json
import random
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import os

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
CATALOG_PATH = os.path.join(DATA_DIR, "barsha_products.json")


class RecommendationType(Enum):
    SIMILAR = "similar"
    COMPLEMENTARY = "complementary"
    PERSONALIZED = "personalized"
    TRENDING = "trending"
    FALLBACK = "fallback"
    # Behavior-based types
    RECENTLY_VIEWED = "recently_viewed"
    BECAUSE_YOU_VIEWED = "because_you_viewed"
    CART_BASED = "cart_based"
    FREQUENTLY_BOUGHT = "frequently_bought"
    SESSION_BASED = "session_based"


@dataclass
class RecommendationResult:
    """A single recommendation with explanation."""
    product_id: int
    product_data: Dict[str, Any]
    score: float
    reason: str  # Human-readable explanation
    strategy: RecommendationType


@dataclass
class RecommendationResponse:
    """Complete recommendation response."""
    recommendations: List[RecommendationResult]
    strategy_used: RecommendationType
    total_candidates: int
    explanation: str  # High-level explanation for the frontend


# Fashion semantic groupings for coherent recommendations
OUTFIT_CATEGORIES = {
    "TOPS": ["T-SHIRT", "T SHIRT", "CHEMISE", "POLO", "BLOUSE", "DEBARDEUR", "CHEMISIER", "HAUT", "TOP"],
    "BOTTOMS": ["PANTALON", "JEAN", "JEANS", "SHORT", "JUPE", "BERMUDA", "LEGGING"],
    "DRESSES": ["ROBE", "COMBINAISON", "CAFTAN", "TUNIQUE"],
    "OUTERWEAR": ["VESTE", "MANTEAU", "BLOUSON", "CARDIGAN", "PULL", "SWEAT", "BLAZER"],
    "FOOTWEAR": ["CHAUSSURE", "BASKET", "BALLERINE", "SANDALE", "ESCARPIN", "MOCASSIN", "SABOT", "BOTTE", "BOTTINE"],
    "BAGS": ["SAC", "SACOCHE", "POCHETTE", "CABAS", "BANDOULIERE", "SAC A DOS"],
    "ACCESSORIES": ["CEINTURE", "ECHARPE", "FOULARD", "CHAPEAU", "CASQUETTE", "LUNETTES"]
}

# Cross-category outfit logic: what goes with what
COMPLEMENTARY_RULES = {
    "TOPS": ["BOTTOMS", "OUTERWEAR", "BAGS", "ACCESSORIES"],
    "BOTTOMS": ["TOPS", "OUTERWEAR", "FOOTWEAR", "BAGS"],
    "DRESSES": ["OUTERWEAR", "FOOTWEAR", "BAGS", "ACCESSORIES"],
    "OUTERWEAR": ["TOPS", "BOTTOMS", "BAGS"],
    "FOOTWEAR": ["BOTTOMS", "DRESSES", "BAGS"],
    "BAGS": ["TOPS", "DRESSES", "ACCESSORIES"],
    "ACCESSORIES": ["TOPS", "DRESSES", "BAGS"]
}

# Color harmony rules for fashion coherence
COLOR_HARMONY = {
    "NOIR": ["BLANC", "ROUGE", "BEIGE", "GRIS", "ROSE", "DORE"],
    "BLANC": ["NOIR", "BLEU", "ROUGE", "BEIGE", "MARINE"],
    "BLEU": ["BLANC", "BEIGE", "MARINE", "GRIS"],
    "MARINE": ["BLANC", "BEIGE", "CAMEL", "ROUGE"],
    "BEIGE": ["NOIR", "BLANC", "MARRON", "MARINE", "BLEU"],
    "ROUGE": ["NOIR", "BLANC", "MARINE", "BEIGE"],
    "ROSE": ["NOIR", "BLANC", "GRIS", "BEIGE"],
    "GRIS": ["NOIR", "BLANC", "ROSE", "ROUGE", "BLEU"],
    "MARRON": ["BEIGE", "BLANC", "CAMEL", "VERT"],
    "VERT": ["BLANC", "BEIGE", "MARRON", "NOIR"]
}


class RecommendationEngine:
    """
    Main recommendation engine with multiple strategies.
    """

    def __init__(self):
        self.catalog: List[Dict] = []
        self.catalog_by_id: Dict[int, Dict] = {}
        self._load_catalog()

    def _load_catalog(self):
        """Load product catalog from JSON file."""
        try:
            if os.path.exists(CATALOG_PATH):
                with open(CATALOG_PATH, "r", encoding="utf-8") as f:
                    self.catalog = json.load(f)
                    self.catalog_by_id = {p.get("id"): p for p in self.catalog if p.get("id")}
                print(f"RecommendationEngine: Loaded {len(self.catalog)} products")
            else:
                print(f"RecommendationEngine: Catalog not found at {CATALOG_PATH}")
        except Exception as e:
            print(f"RecommendationEngine: Error loading catalog: {e}")

    def _get_product_category(self, product: Dict) -> Optional[str]:
        """Determine which outfit category a product belongs to."""
        nom = (product.get("nom") or product.get("title") or "").upper()
        for category, keywords in OUTFIT_CATEGORIES.items():
            for kw in keywords:
                if kw in nom:
                    return category
        return None

    def _get_product_colors(self, product: Dict) -> List[str]:
        """Extract colors from product declinaisons."""
        colors = []
        for d in (product.get("declinaisons") or []):
            color = (d.get("couleur") or d.get("libellet") or "").upper()
            if color:
                colors.append(color)
        return colors

    def _get_product_famille(self, product: Dict) -> str:
        """Get product family (WOMEN, MEN, etc.)."""
        return (product.get("Famille") or product.get("famille") or "").upper()

    def _calculate_similarity_score(self, product1: Dict, product2: Dict) -> Tuple[float, str]:
        """
        Calculate similarity score between two products.
        Returns (score, reason).
        """
        if product1.get("id") == product2.get("id"):
            return 0.0, "Same product"

        score = 0.0
        reasons = []

        # Same category = high similarity
        cat1 = self._get_product_category(product1)
        cat2 = self._get_product_category(product2)
        if cat1 and cat2 and cat1 == cat2:
            score += 40
            reasons.append(f"même catégorie ({cat1.lower()})")

        # Same family (gender target) = important
        fam1 = self._get_product_famille(product1)
        fam2 = self._get_product_famille(product2)
        if fam1 and fam2 and fam1 == fam2:
            score += 30
            reasons.append("même collection")
        elif fam1 and fam2:
            # Different family = penalty
            score -= 20

        # Shared colors
        colors1 = set(self._get_product_colors(product1))
        colors2 = set(self._get_product_colors(product2))
        shared_colors = colors1 & colors2
        if shared_colors:
            score += 15 * len(shared_colors)
            reasons.append(f"couleur {'commune' if len(shared_colors) == 1 else 'communes'}: {', '.join(list(shared_colors)[:2])}")

        # Similar price range
        try:
            price1 = float(product1.get("currentPrice") or product1.get("prix") or 0)
            price2 = float(product2.get("currentPrice") or product2.get("prix") or 0)
            if price1 > 0 and price2 > 0:
                price_diff = abs(price1 - price2) / max(price1, price2)
                if price_diff < 0.2:
                    score += 10
                    reasons.append("gamme de prix similaire")
        except:
            pass

        reason = " • ".join(reasons) if reasons else "style similaire"
        return max(0, score), reason

    def _calculate_complementary_score(self, source_product: Dict, candidate: Dict) -> Tuple[float, str]:
        """
        Calculate complementary score - how well products go together in an outfit.
        Returns (score, reason).
        """
        if source_product.get("id") == candidate.get("id"):
            return 0.0, "Same product"

        score = 0.0
        reasons = []

        source_cat = self._get_product_category(source_product)
        candidate_cat = self._get_product_category(candidate)

        # Must be different category for complement
        if source_cat == candidate_cat:
            return 0.0, "Same category - not complementary"

        # Check if categories complement each other
        if source_cat and candidate_cat:
            complementary_cats = COMPLEMENTARY_RULES.get(source_cat, [])
            if candidate_cat in complementary_cats:
                score += 50
                reasons.append(f"complète votre {source_cat.lower()} avec un {candidate_cat.lower()}")

        # Same family (gender target)
        fam1 = self._get_product_famille(source_product)
        fam2 = self._get_product_famille(candidate)
        if fam1 and fam2 and fam1 == fam2:
            score += 25
        elif fam1 and fam2:
            score -= 30  # Wrong gender = strong penalty

        # Color harmony
        source_colors = self._get_product_colors(source_product)
        candidate_colors = self._get_product_colors(candidate)

        for src_color in source_colors:
            harmonious = COLOR_HARMONY.get(src_color, [])
            for cand_color in candidate_colors:
                if cand_color in harmonious:
                    score += 15
                    reasons.append(f"harmonie de couleurs ({src_color.lower()} + {cand_color.lower()})")
                    break

        reason = " • ".join(reasons) if reasons else "accord vestimentaire"
        return max(0, score), reason

    def get_similar_products(
        self,
        product_id: int,
        limit: int = 8,
        exclude_ids: List[int] = None
    ) -> RecommendationResponse:
        """
        Get products similar to a given product.
        Strategy: Same category, same family, similar style.
        """
        exclude_ids = exclude_ids or []
        exclude_ids.append(product_id)

        source_product = self.catalog_by_id.get(product_id)
        if not source_product:
            return self._get_fallback_recommendations(limit, "Produit source non trouvé")

        candidates = []
        for product in self.catalog:
            if product.get("id") in exclude_ids:
                continue
            score, reason = self._calculate_similarity_score(source_product, product)
            if score > 0:
                candidates.append((score, reason, product))

        # Sort by score descending
        candidates.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, reason, product in candidates[:limit]:
            results.append(RecommendationResult(
                product_id=product.get("id"),
                product_data=product,
                score=score,
                reason=reason,
                strategy=RecommendationType.SIMILAR
            ))

        source_name = source_product.get("nom", "cet article")
        return RecommendationResponse(
            recommendations=results,
            strategy_used=RecommendationType.SIMILAR,
            total_candidates=len(candidates),
            explanation=f"Articles avec le même style que {source_name}"
        )

    def get_complementary_products(
        self,
        product_id: int,
        limit: int = 6,
        exclude_ids: List[int] = None
    ) -> RecommendationResponse:
        """
        Get products that complement the given product (outfit logic).
        Strategy: Different category, same family, color harmony.
        """
        exclude_ids = exclude_ids or []
        exclude_ids.append(product_id)

        source_product = self.catalog_by_id.get(product_id)
        if not source_product:
            return self._get_fallback_recommendations(limit, "Produit source non trouvé")

        candidates = []
        for product in self.catalog:
            if product.get("id") in exclude_ids:
                continue
            score, reason = self._calculate_complementary_score(source_product, product)
            if score > 0:
                candidates.append((score, reason, product))

        candidates.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, reason, product in candidates[:limit]:
            results.append(RecommendationResult(
                product_id=product.get("id"),
                product_data=product,
                score=score,
                reason=reason,
                strategy=RecommendationType.COMPLEMENTARY
            ))

        return RecommendationResponse(
            recommendations=results,
            strategy_used=RecommendationType.COMPLEMENTARY,
            total_candidates=len(candidates),
            explanation="Pour compléter votre look avec style"
        )

    def get_personalized_recommendations(
        self,
        user_context: Dict[str, Any],
        limit: int = 8
    ) -> RecommendationResponse:
        """
        Get personalized recommendations based on user behavior.
        Strategy: Based on wishlist, orders, browsing patterns.
        """
        wishlist = user_context.get("wishlist", [])
        orders = user_context.get("orders", [])

        # Extract product IDs from wishlist and orders
        seed_ids = set()
        for w in wishlist:
            w_prod = w.get("product") or w.get("produit") or w
            if w_prod.get("id"):
                seed_ids.add(w_prod.get("id"))

        for o in orders:
            for item in (o.get("items") or o.get("lignes") or []):
                item_prod = item.get("product") or item
                if item_prod.get("id"):
                    seed_ids.add(item_prod.get("id"))

        if not seed_ids:
            return self._get_trending_recommendations(limit)

        # Find similar products to what user has liked/purchased
        all_candidates = []
        for seed_id in list(seed_ids)[:5]:  # Use top 5 seeds
            similar_resp = self.get_similar_products(seed_id, limit=10, exclude_ids=list(seed_ids))
            for rec in similar_resp.recommendations:
                all_candidates.append((rec.score, rec.reason, rec.product_data))

        # Deduplicate and sort
        seen_ids = set()
        unique_candidates = []
        for score, reason, product in all_candidates:
            pid = product.get("id")
            if pid not in seen_ids and pid not in seed_ids:
                seen_ids.add(pid)
                unique_candidates.append((score, reason, product))

        unique_candidates.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, reason, product in unique_candidates[:limit]:
            results.append(RecommendationResult(
                product_id=product.get("id"),
                product_data=product,
                score=score,
                reason=f"Basé sur vos goûts: {reason}",
                strategy=RecommendationType.PERSONALIZED
            ))

        return RecommendationResponse(
            recommendations=results,
            strategy_used=RecommendationType.PERSONALIZED,
            total_candidates=len(unique_candidates),
            explanation="Sélection personnalisée selon vos goûts"
        )

    def _get_trending_recommendations(self, limit: int = 8) -> RecommendationResponse:
        """Get trending/popular products as fallback."""
        # In a real system, this would be based on sales data
        # For now, we sample from the catalog with preference for newer items
        sample_size = min(limit * 3, len(self.catalog))
        candidates = random.sample(self.catalog, sample_size) if self.catalog else []

        results = []
        for product in candidates[:limit]:
            results.append(RecommendationResult(
                product_id=product.get("id"),
                product_data=product,
                score=50,
                reason="Tendance du moment",
                strategy=RecommendationType.TRENDING
            ))

        return RecommendationResponse(
            recommendations=results,
            strategy_used=RecommendationType.TRENDING,
            total_candidates=len(candidates),
            explanation="Nos articles tendance du moment"
        )

    def _get_fallback_recommendations(self, limit: int, reason: str) -> RecommendationResponse:
        """Fallback when other strategies fail."""
        return RecommendationResponse(
            recommendations=[],
            strategy_used=RecommendationType.FALLBACK,
            total_candidates=0,
            explanation=reason
        )

    # ─────────────────────────────────────────────────────────────
    # BEHAVIOR-BASED RECOMMENDATIONS
    # ─────────────────────────────────────────────────────────────

    def get_recently_viewed_recommendations(
        self,
        viewed_product_ids: List[int],
        limit: int = 8
    ) -> RecommendationResponse:
        """
        Get recommendations based on recently viewed products.
        Returns the viewed products themselves for display.
        """
        if not viewed_product_ids:
            return self._get_fallback_recommendations(limit, "Pas d'historique de navigation")

        results = []
        for pid in viewed_product_ids[:limit]:
            product = self.catalog_by_id.get(pid)
            if product:
                results.append(RecommendationResult(
                    product_id=pid,
                    product_data=product,
                    score=100,
                    reason="Consulté récemment",
                    strategy=RecommendationType.RECENTLY_VIEWED
                ))

        return RecommendationResponse(
            recommendations=results,
            strategy_used=RecommendationType.RECENTLY_VIEWED,
            total_candidates=len(viewed_product_ids),
            explanation="Vos articles consultés récemment"
        )

    def get_because_you_viewed_recommendations(
        self,
        viewed_product_ids: List[int],
        limit: int = 8,
        exclude_ids: List[int] = None
    ) -> RecommendationResponse:
        """
        Get recommendations based on recently viewed products.
        Returns SIMILAR products to what the user viewed.
        """
        exclude_ids = set(exclude_ids or [])
        exclude_ids.update(viewed_product_ids)

        if not viewed_product_ids:
            return self._get_trending_recommendations(limit)

        # Get similar products to recently viewed
        all_candidates = []
        for viewed_id in viewed_product_ids[:5]:  # Use top 5 recent views
            similar_resp = self.get_similar_products(
                viewed_id,
                limit=10,
                exclude_ids=list(exclude_ids)
            )
            for rec in similar_resp.recommendations:
                if rec.product_id not in exclude_ids:
                    all_candidates.append((rec.score, rec.reason, rec.product_data))
                    exclude_ids.add(rec.product_id)

        # Sort and deduplicate
        all_candidates.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, reason, product in all_candidates[:limit]:
            results.append(RecommendationResult(
                product_id=product.get("id"),
                product_data=product,
                score=score,
                reason=f"Car vous avez vu des articles similaires",
                strategy=RecommendationType.BECAUSE_YOU_VIEWED
            ))

        return RecommendationResponse(
            recommendations=results,
            strategy_used=RecommendationType.BECAUSE_YOU_VIEWED,
            total_candidates=len(all_candidates),
            explanation="Parce que vous avez consulté des articles similaires"
        )

    def get_cart_based_recommendations(
        self,
        cart_product_ids: List[int],
        limit: int = 6
    ) -> RecommendationResponse:
        """
        Get recommendations based on cart contents.
        Returns complementary products to complete the cart.
        """
        if not cart_product_ids:
            return self._get_trending_recommendations(limit)

        all_candidates = []
        exclude_ids = set(cart_product_ids)

        # Get complementary products for each cart item
        for cart_id in cart_product_ids:
            comp_resp = self.get_complementary_products(
                cart_id,
                limit=8,
                exclude_ids=list(exclude_ids)
            )
            for rec in comp_resp.recommendations:
                if rec.product_id not in exclude_ids:
                    all_candidates.append((rec.score, rec.reason, rec.product_data))
                    exclude_ids.add(rec.product_id)

        # Sort by score
        all_candidates.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, reason, product in all_candidates[:limit]:
            results.append(RecommendationResult(
                product_id=product.get("id"),
                product_data=product,
                score=score,
                reason="Complète votre panier",
                strategy=RecommendationType.CART_BASED
            ))

        return RecommendationResponse(
            recommendations=results,
            strategy_used=RecommendationType.CART_BASED,
            total_candidates=len(all_candidates),
            explanation="Pour compléter votre panier"
        )

    def get_session_based_recommendations(
        self,
        session_context: Dict[str, Any],
        limit: int = 8
    ) -> RecommendationResponse:
        """
        Get recommendations based on current session behavior.
        Uses viewed products, searches, and cart to personalize.
        Works for anonymous users too.
        """
        viewed = session_context.get("viewed_products", [])
        cart = session_context.get("current_cart_products", [])
        searches = session_context.get("searched_queries", [])

        # Priority: cart > viewed > trending
        if cart:
            return self.get_cart_based_recommendations(cart, limit)
        elif viewed:
            return self.get_because_you_viewed_recommendations(viewed, limit)
        else:
            return self._get_trending_recommendations(limit)

    def get_frequently_bought_together(
        self,
        product_id: int,
        co_purchased_ids: List[int],
        limit: int = 4
    ) -> RecommendationResponse:
        """
        Get products frequently bought together.
        Requires co-purchase data from analytics service.
        """
        if not co_purchased_ids:
            # Fallback to complementary
            return self.get_complementary_products(product_id, limit)

        results = []
        for pid in co_purchased_ids[:limit]:
            product = self.catalog_by_id.get(pid)
            if product:
                results.append(RecommendationResult(
                    product_id=pid,
                    product_data=product,
                    score=90,
                    reason="Souvent achetés ensemble",
                    strategy=RecommendationType.FREQUENTLY_BOUGHT
                ))

        return RecommendationResponse(
            recommendations=results,
            strategy_used=RecommendationType.FREQUENTLY_BOUGHT,
            total_candidates=len(co_purchased_ids),
            explanation="Les clients achètent souvent ensemble"
        )

    def get_smart_recommendations(
        self,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None,
        current_product_id: Optional[int] = None,
        cart_product_ids: List[int] = None,
        viewed_product_ids: List[int] = None,
        wishlist_product_ids: List[int] = None,
        limit: int = 8
    ) -> RecommendationResponse:
        """
        Smart recommendation orchestrator.
        Chooses the best strategy based on available context.

        Priority:
        1. Current product context → Similar + Complementary
        2. Cart context → Cart-based
        3. View history → Because you viewed
        4. Wishlist → Personalized from wishlist
        5. Fallback → Trending
        """
        cart_product_ids = cart_product_ids or []
        viewed_product_ids = viewed_product_ids or []
        wishlist_product_ids = wishlist_product_ids or []

        # 1. If on a product page, prioritize related products
        if current_product_id:
            similar = self.get_similar_products(current_product_id, limit=4)
            comp = self.get_complementary_products(current_product_id, limit=4)

            # Merge similar and complementary
            all_recs = similar.recommendations + comp.recommendations
            return RecommendationResponse(
                recommendations=all_recs[:limit],
                strategy_used=RecommendationType.SIMILAR,
                total_candidates=similar.total_candidates + comp.total_candidates,
                explanation="Articles similaires et complémentaires"
            )

        # 2. If cart has items, suggest complementary
        if cart_product_ids:
            return self.get_cart_based_recommendations(cart_product_ids, limit)

        # 3. If view history exists, use it
        if viewed_product_ids:
            return self.get_because_you_viewed_recommendations(viewed_product_ids, limit)

        # 4. If wishlist exists, personalize from it
        if wishlist_product_ids:
            return self.get_personalized_recommendations(
                {"wishlist": [{"product": {"id": pid}} for pid in wishlist_product_ids]},
                limit
            )

        # 5. Fallback to trending
        return self._get_trending_recommendations(limit)


# Singleton instance
_engine_instance: Optional[RecommendationEngine] = None


def get_recommendation_engine() -> RecommendationEngine:
    """Get or create the recommendation engine singleton."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = RecommendationEngine()
    return _engine_instance
