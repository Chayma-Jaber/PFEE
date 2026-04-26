"""
Barsha Analytics Service
=========================
Service for tracking user behavior and retrieving analytics data.

This service provides:
- Event tracking (product views, clicks, purchases, etc.)
- User behavior history retrieval
- Trending product calculation
- AI module performance metrics
- Recommendation effectiveness measurement
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

# Import models
try:
    from app.models.analytics import (
        UserEvent, RecommendationPerformance, AIModuleUsage,
        ProductPopularity, SearchTrend, EventType, RecommendationType
    )
    from app.core.database import SessionLocal
    ANALYTICS_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Analytics models not available: {e}")
    ANALYTICS_AVAILABLE = False


class AnalyticsService:
    """
    Main analytics service for event tracking and data retrieval.
    """

    def __init__(self, db: Session = None):
        self.db = db

    # ─────────────────────────────────────────────────────────────
    # EVENT TRACKING
    # ─────────────────────────────────────────────────────────────

    def track_event(
        self,
        session_id: str,
        event_type: str,
        user_id: Optional[int] = None,
        product_id: Optional[int] = None,
        category_id: Optional[int] = None,
        search_query: Optional[str] = None,
        recommendation_type: Optional[str] = None,
        recommendation_position: Optional[int] = None,
        recommendation_source: Optional[str] = None,
        event_data: Optional[Dict] = None,
        page_url: Optional[str] = None,
        device_type: Optional[str] = None
    ) -> bool:
        """
        Track a user event.

        Returns True if event was successfully tracked.
        """
        if not ANALYTICS_AVAILABLE or not self.db:
            logger.debug(f"Event tracking skipped: {event_type}")
            return False

        try:
            event = UserEvent(
                session_id=session_id,
                user_id=user_id,
                event_type=event_type,
                timestamp=datetime.utcnow(),
                product_id=product_id,
                category_id=category_id,
                search_query=search_query,
                recommendation_type=recommendation_type,
                recommendation_position=recommendation_position,
                recommendation_source=recommendation_source,
                event_data=event_data,
                page_url=page_url,
                device_type=device_type
            )
            self.db.add(event)
            self.db.commit()
            logger.debug(f"Tracked event: {event_type} for session {session_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to track event: {e}")
            self.db.rollback()
            return False

    def track_product_view(
        self,
        session_id: str,
        product_id: int,
        user_id: Optional[int] = None,
        page_url: Optional[str] = None
    ) -> bool:
        """Track a product page view."""
        return self.track_event(
            session_id=session_id,
            event_type=EventType.PRODUCT_VIEW.value,
            user_id=user_id,
            product_id=product_id,
            page_url=page_url
        )

    def track_recommendation_click(
        self,
        session_id: str,
        product_id: int,
        recommendation_type: str,
        position: int,
        source: str = "unknown",
        user_id: Optional[int] = None
    ) -> bool:
        """Track when a user clicks on a recommended product."""
        return self.track_event(
            session_id=session_id,
            event_type=EventType.RECOMMENDATION_CLICK.value,
            user_id=user_id,
            product_id=product_id,
            recommendation_type=recommendation_type,
            recommendation_position=position,
            recommendation_source=source
        )

    def track_recommendation_impression(
        self,
        session_id: str,
        product_ids: List[int],
        recommendation_type: str,
        source: str = "unknown",
        user_id: Optional[int] = None
    ) -> bool:
        """Track recommendation impressions (products shown)."""
        return self.track_event(
            session_id=session_id,
            event_type=EventType.RECOMMENDATION_IMPRESSION.value,
            user_id=user_id,
            recommendation_type=recommendation_type,
            recommendation_source=source,
            event_data={"product_ids": product_ids, "count": len(product_ids)}
        )

    def track_assistant_interaction(
        self,
        session_id: str,
        interaction_type: str,  # 'open', 'message', 'product_click', 'add_to_cart'
        user_id: Optional[int] = None,
        product_id: Optional[int] = None,
        message: Optional[str] = None
    ) -> bool:
        """Track AI assistant interactions."""
        event_map = {
            'open': EventType.ASSISTANT_OPEN.value,
            'message': EventType.ASSISTANT_MESSAGE.value,
            'product_click': EventType.ASSISTANT_PRODUCT_CLICK.value,
            'add_to_cart': EventType.ASSISTANT_ADD_TO_CART.value
        }
        event_type = event_map.get(interaction_type, EventType.ASSISTANT_MESSAGE.value)

        return self.track_event(
            session_id=session_id,
            event_type=event_type,
            user_id=user_id,
            product_id=product_id,
            event_data={"message_preview": message[:100] if message else None}
        )

    def track_visual_search(
        self,
        session_id: str,
        interaction_type: str,  # 'upload', 'result_click', 'add_to_cart'
        user_id: Optional[int] = None,
        product_id: Optional[int] = None,
        confidence: Optional[float] = None,
        results_count: Optional[int] = None
    ) -> bool:
        """Track visual search interactions."""
        event_map = {
            'upload': EventType.VISUAL_SEARCH_UPLOAD.value,
            'result_click': EventType.VISUAL_SEARCH_RESULT_CLICK.value,
            'add_to_cart': EventType.VISUAL_SEARCH_ADD_TO_CART.value
        }
        event_type = event_map.get(interaction_type, EventType.VISUAL_SEARCH_UPLOAD.value)

        return self.track_event(
            session_id=session_id,
            event_type=event_type,
            user_id=user_id,
            product_id=product_id,
            event_data={"confidence": confidence, "results_count": results_count}
        )

    def track_search(
        self,
        session_id: str,
        query: str,
        results_count: int,
        user_id: Optional[int] = None
    ) -> bool:
        """Track a search query."""
        return self.track_event(
            session_id=session_id,
            event_type=EventType.SEARCH_QUERY.value,
            user_id=user_id,
            search_query=query,
            event_data={"results_count": results_count}
        )

    def track_add_to_cart(
        self,
        session_id: str,
        product_id: int,
        user_id: Optional[int] = None,
        from_recommendation: Optional[str] = None,
        quantity: int = 1
    ) -> bool:
        """Track add to cart event."""
        return self.track_event(
            session_id=session_id,
            event_type=EventType.ADD_TO_CART.value,
            user_id=user_id,
            product_id=product_id,
            recommendation_type=from_recommendation,
            event_data={"quantity": quantity}
        )

    # ─────────────────────────────────────────────────────────────
    # BEHAVIOR DATA RETRIEVAL
    # ─────────────────────────────────────────────────────────────

    def get_recently_viewed(
        self,
        session_id: str,
        user_id: Optional[int] = None,
        limit: int = 10
    ) -> List[int]:
        """
        Get recently viewed product IDs for a session/user.
        """
        if not ANALYTICS_AVAILABLE or not self.db:
            return []

        try:
            query = self.db.query(UserEvent.product_id).filter(
                UserEvent.event_type == EventType.PRODUCT_VIEW.value,
                UserEvent.product_id.isnot(None)
            )

            # Prefer user_id if available, fall back to session_id
            if user_id:
                query = query.filter(UserEvent.user_id == user_id)
            else:
                query = query.filter(UserEvent.session_id == session_id)

            # Recent first, unique products
            results = query.order_by(desc(UserEvent.timestamp)).limit(limit * 2).all()

            # Deduplicate while preserving order
            seen = set()
            product_ids = []
            for (pid,) in results:
                if pid not in seen:
                    seen.add(pid)
                    product_ids.append(pid)
                    if len(product_ids) >= limit:
                        break

            return product_ids
        except Exception as e:
            logger.error(f"Error getting recently viewed: {e}")
            return []

    def get_user_interests(
        self,
        user_id: int,
        days: int = 30,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        Analyze user interests based on behavior history.

        Returns:
        - frequently_viewed_categories
        - preferred_price_range
        - color_preferences
        - viewed_products
        - searched_terms
        """
        if not ANALYTICS_AVAILABLE or not self.db:
            return {}

        try:
            since = datetime.utcnow() - timedelta(days=days)

            # Get all events for user
            events = self.db.query(UserEvent).filter(
                UserEvent.user_id == user_id,
                UserEvent.timestamp >= since
            ).all()

            interests = {
                "viewed_product_ids": [],
                "search_queries": [],
                "categories_viewed": [],
                "products_added_to_cart": [],
                "total_interactions": len(events)
            }

            for event in events:
                if event.event_type == EventType.PRODUCT_VIEW.value and event.product_id:
                    interests["viewed_product_ids"].append(event.product_id)
                elif event.event_type == EventType.SEARCH_QUERY.value and event.search_query:
                    interests["search_queries"].append(event.search_query)
                elif event.event_type == EventType.CATEGORY_VIEW.value and event.category_id:
                    interests["categories_viewed"].append(event.category_id)
                elif event.event_type == EventType.ADD_TO_CART.value and event.product_id:
                    interests["products_added_to_cart"].append(event.product_id)

            # Deduplicate and limit
            interests["viewed_product_ids"] = list(set(interests["viewed_product_ids"]))[:limit]
            interests["search_queries"] = list(set(interests["search_queries"]))[:10]

            return interests
        except Exception as e:
            logger.error(f"Error getting user interests: {e}")
            return {}

    def get_session_context(
        self,
        session_id: str,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        Get current session context for personalization.

        Returns recent activity in the current session.
        """
        if not ANALYTICS_AVAILABLE or not self.db:
            return {}

        try:
            # Last 30 minutes of activity
            since = datetime.utcnow() - timedelta(minutes=30)

            events = self.db.query(UserEvent).filter(
                UserEvent.session_id == session_id,
                UserEvent.timestamp >= since
            ).order_by(desc(UserEvent.timestamp)).limit(limit).all()

            context = {
                "viewed_products": [],
                "searched_queries": [],
                "clicked_recommendations": [],
                "current_cart_products": [],
                "session_start": None,
                "event_count": len(events)
            }

            for event in events:
                if context["session_start"] is None or event.timestamp < context["session_start"]:
                    context["session_start"] = event.timestamp

                if event.event_type == EventType.PRODUCT_VIEW.value and event.product_id:
                    context["viewed_products"].append(event.product_id)
                elif event.event_type == EventType.SEARCH_QUERY.value:
                    context["searched_queries"].append(event.search_query)
                elif event.event_type == EventType.RECOMMENDATION_CLICK.value:
                    context["clicked_recommendations"].append({
                        "product_id": event.product_id,
                        "type": event.recommendation_type
                    })
                elif event.event_type == EventType.ADD_TO_CART.value:
                    context["current_cart_products"].append(event.product_id)

            return context
        except Exception as e:
            logger.error(f"Error getting session context: {e}")
            return {}

    # ─────────────────────────────────────────────────────────────
    # TRENDING AND POPULARITY
    # ─────────────────────────────────────────────────────────────

    def get_trending_products(
        self,
        days: int = 7,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get trending products based on recent activity.

        Scoring: views + clicks*2 + add_to_cart*5 + purchases*10
        """
        if not ANALYTICS_AVAILABLE or not self.db:
            return []

        try:
            since = datetime.utcnow() - timedelta(days=days)

            # Get all relevant events
            events = self.db.query(
                UserEvent.product_id,
                UserEvent.event_type,
                func.count(UserEvent.id).label('count')
            ).filter(
                UserEvent.timestamp >= since,
                UserEvent.product_id.isnot(None),
                UserEvent.event_type.in_([
                    EventType.PRODUCT_VIEW.value,
                    EventType.RECOMMENDATION_CLICK.value,
                    EventType.ADD_TO_CART.value,
                    EventType.PURCHASE_COMPLETE.value
                ])
            ).group_by(
                UserEvent.product_id,
                UserEvent.event_type
            ).all()

            # Calculate scores
            scores = defaultdict(float)
            weights = {
                EventType.PRODUCT_VIEW.value: 1,
                EventType.RECOMMENDATION_CLICK.value: 2,
                EventType.ADD_TO_CART.value: 5,
                EventType.PURCHASE_COMPLETE.value: 10
            }

            for product_id, event_type, count in events:
                weight = weights.get(event_type, 1)
                scores[product_id] += count * weight

            # Sort by score
            trending = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:limit]

            return [{"product_id": pid, "score": score} for pid, score in trending]
        except Exception as e:
            logger.error(f"Error getting trending products: {e}")
            return []

    def get_frequently_bought_together(
        self,
        product_id: int,
        days: int = 90,
        limit: int = 5
    ) -> List[int]:
        """
        Get products frequently purchased together with the given product.
        """
        if not ANALYTICS_AVAILABLE or not self.db:
            return []

        try:
            since = datetime.utcnow() - timedelta(days=days)

            # Get sessions where this product was purchased
            sessions_with_product = self.db.query(UserEvent.session_id).filter(
                UserEvent.event_type == EventType.PURCHASE_COMPLETE.value,
                UserEvent.product_id == product_id,
                UserEvent.timestamp >= since
            ).subquery()

            # Get other products purchased in those sessions
            co_purchased = self.db.query(
                UserEvent.product_id,
                func.count(UserEvent.id).label('count')
            ).filter(
                UserEvent.session_id.in_(sessions_with_product),
                UserEvent.event_type == EventType.PURCHASE_COMPLETE.value,
                UserEvent.product_id != product_id,
                UserEvent.product_id.isnot(None)
            ).group_by(
                UserEvent.product_id
            ).order_by(
                desc('count')
            ).limit(limit).all()

            return [pid for pid, _ in co_purchased]
        except Exception as e:
            logger.error(f"Error getting frequently bought together: {e}")
            return []

    # ─────────────────────────────────────────────────────────────
    # AI MODULE ANALYTICS
    # ─────────────────────────────────────────────────────────────

    def get_ai_module_stats(
        self,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get aggregated AI module usage statistics.
        """
        if not ANALYTICS_AVAILABLE or not self.db:
            return self._get_mock_ai_stats()

        try:
            since = datetime.utcnow() - timedelta(days=days)

            # Count events by type
            event_counts = self.db.query(
                UserEvent.event_type,
                func.count(UserEvent.id).label('count'),
                func.count(func.distinct(UserEvent.session_id)).label('unique_sessions')
            ).filter(
                UserEvent.timestamp >= since
            ).group_by(
                UserEvent.event_type
            ).all()

            stats = {
                "period_days": days,
                "assistant": {
                    "sessions": 0,
                    "messages": 0,
                    "product_clicks": 0,
                    "add_to_carts": 0,
                    "click_rate": 0.0
                },
                "visual_search": {
                    "uploads": 0,
                    "result_clicks": 0,
                    "add_to_carts": 0,
                    "click_rate": 0.0
                },
                "recommendations": {
                    "impressions": 0,
                    "clicks": 0,
                    "add_to_carts": 0,
                    "click_rate": 0.0,
                    "cart_rate": 0.0
                },
                "total_events": 0
            }

            for event_type, count, unique_sessions in event_counts:
                stats["total_events"] += count

                if event_type == EventType.ASSISTANT_OPEN.value:
                    stats["assistant"]["sessions"] = unique_sessions
                elif event_type == EventType.ASSISTANT_MESSAGE.value:
                    stats["assistant"]["messages"] = count
                elif event_type == EventType.ASSISTANT_PRODUCT_CLICK.value:
                    stats["assistant"]["product_clicks"] = count
                elif event_type == EventType.ASSISTANT_ADD_TO_CART.value:
                    stats["assistant"]["add_to_carts"] = count
                elif event_type == EventType.VISUAL_SEARCH_UPLOAD.value:
                    stats["visual_search"]["uploads"] = count
                elif event_type == EventType.VISUAL_SEARCH_RESULT_CLICK.value:
                    stats["visual_search"]["result_clicks"] = count
                elif event_type == EventType.VISUAL_SEARCH_ADD_TO_CART.value:
                    stats["visual_search"]["add_to_carts"] = count
                elif event_type == EventType.RECOMMENDATION_IMPRESSION.value:
                    stats["recommendations"]["impressions"] = count
                elif event_type == EventType.RECOMMENDATION_CLICK.value:
                    stats["recommendations"]["clicks"] = count
                elif event_type == EventType.RECOMMENDATION_ADD_TO_CART.value:
                    stats["recommendations"]["add_to_carts"] = count

            # Calculate rates
            if stats["assistant"]["messages"] > 0:
                stats["assistant"]["click_rate"] = round(
                    stats["assistant"]["product_clicks"] / stats["assistant"]["messages"] * 100, 2
                )

            if stats["visual_search"]["uploads"] > 0:
                stats["visual_search"]["click_rate"] = round(
                    stats["visual_search"]["result_clicks"] / stats["visual_search"]["uploads"] * 100, 2
                )

            if stats["recommendations"]["impressions"] > 0:
                stats["recommendations"]["click_rate"] = round(
                    stats["recommendations"]["clicks"] / stats["recommendations"]["impressions"] * 100, 2
                )
                stats["recommendations"]["cart_rate"] = round(
                    stats["recommendations"]["add_to_carts"] / stats["recommendations"]["impressions"] * 100, 2
                )

            return stats
        except Exception as e:
            logger.error(f"Error getting AI module stats: {e}")
            return self._get_mock_ai_stats()

    def _get_mock_ai_stats(self) -> Dict[str, Any]:
        """Return mock stats when database is not available."""
        return {
            "period_days": 30,
            "assistant": {
                "sessions": 0,
                "messages": 0,
                "product_clicks": 0,
                "add_to_carts": 0,
                "click_rate": 0.0
            },
            "visual_search": {
                "uploads": 0,
                "result_clicks": 0,
                "add_to_carts": 0,
                "click_rate": 0.0
            },
            "recommendations": {
                "impressions": 0,
                "clicks": 0,
                "add_to_carts": 0,
                "click_rate": 0.0,
                "cart_rate": 0.0
            },
            "total_events": 0,
            "note": "Analytics database not configured"
        }

    def get_recommendation_performance_by_type(
        self,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get recommendation performance broken down by type.
        """
        if not ANALYTICS_AVAILABLE or not self.db:
            return []

        try:
            since = datetime.utcnow() - timedelta(days=days)

            # Get impressions and clicks by recommendation type
            results = self.db.query(
                UserEvent.recommendation_type,
                UserEvent.event_type,
                func.count(UserEvent.id).label('count')
            ).filter(
                UserEvent.timestamp >= since,
                UserEvent.recommendation_type.isnot(None),
                UserEvent.event_type.in_([
                    EventType.RECOMMENDATION_IMPRESSION.value,
                    EventType.RECOMMENDATION_CLICK.value,
                    EventType.RECOMMENDATION_ADD_TO_CART.value
                ])
            ).group_by(
                UserEvent.recommendation_type,
                UserEvent.event_type
            ).all()

            # Aggregate by type
            perf = defaultdict(lambda: {"impressions": 0, "clicks": 0, "add_to_carts": 0})

            for rec_type, event_type, count in results:
                if event_type == EventType.RECOMMENDATION_IMPRESSION.value:
                    perf[rec_type]["impressions"] = count
                elif event_type == EventType.RECOMMENDATION_CLICK.value:
                    perf[rec_type]["clicks"] = count
                elif event_type == EventType.RECOMMENDATION_ADD_TO_CART.value:
                    perf[rec_type]["add_to_carts"] = count

            # Calculate rates and format
            performance = []
            for rec_type, metrics in perf.items():
                click_rate = 0.0
                cart_rate = 0.0
                if metrics["impressions"] > 0:
                    click_rate = round(metrics["clicks"] / metrics["impressions"] * 100, 2)
                    cart_rate = round(metrics["add_to_carts"] / metrics["impressions"] * 100, 2)

                performance.append({
                    "type": rec_type,
                    "impressions": metrics["impressions"],
                    "clicks": metrics["clicks"],
                    "add_to_carts": metrics["add_to_carts"],
                    "click_rate": click_rate,
                    "cart_rate": cart_rate
                })

            return sorted(performance, key=lambda x: x["impressions"], reverse=True)
        except Exception as e:
            logger.error(f"Error getting recommendation performance: {e}")
            return []


# Singleton instance
_analytics_instance: Optional[AnalyticsService] = None


def get_analytics_service(db: Session = None) -> AnalyticsService:
    """Get analytics service instance."""
    global _analytics_instance
    if db:
        return AnalyticsService(db)
    if _analytics_instance is None:
        _analytics_instance = AnalyticsService()
    return _analytics_instance
