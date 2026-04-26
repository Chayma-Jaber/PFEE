"""
Barsha Analytics Models
========================
SQLAlchemy models for tracking user behavior and AI performance.

Events tracked:
- Product views
- Category views
- Search queries
- Recommendation interactions
- Cart events
- Wishlist events
- Assistant interactions
- Visual search events
"""

from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, Text, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum
from app.core.database import Base


class EventType(str, Enum):
    """Types of trackable events."""
    # Browsing events
    PRODUCT_VIEW = "product_view"
    CATEGORY_VIEW = "category_view"
    SEARCH_QUERY = "search_query"

    # Recommendation events
    RECOMMENDATION_IMPRESSION = "recommendation_impression"
    RECOMMENDATION_CLICK = "recommendation_click"
    RECOMMENDATION_ADD_TO_CART = "recommendation_add_to_cart"

    # Cart events
    ADD_TO_CART = "add_to_cart"
    REMOVE_FROM_CART = "remove_from_cart"
    CART_VIEW = "cart_view"

    # Wishlist events
    WISHLIST_ADD = "wishlist_add"
    WISHLIST_REMOVE = "wishlist_remove"

    # Purchase events
    CHECKOUT_START = "checkout_start"
    PURCHASE_COMPLETE = "purchase_complete"

    # AI Assistant events
    ASSISTANT_OPEN = "assistant_open"
    ASSISTANT_MESSAGE = "assistant_message"
    ASSISTANT_PRODUCT_CLICK = "assistant_product_click"
    ASSISTANT_ADD_TO_CART = "assistant_add_to_cart"

    # Visual Search events
    VISUAL_SEARCH_UPLOAD = "visual_search_upload"
    VISUAL_SEARCH_RESULT_CLICK = "visual_search_result_click"
    VISUAL_SEARCH_ADD_TO_CART = "visual_search_add_to_cart"


class RecommendationType(str, Enum):
    """Types of recommendations for tracking."""
    SIMILAR = "similar"
    COMPLEMENTARY = "complementary"
    PERSONALIZED = "personalized"
    TRENDING = "trending"
    RECENTLY_VIEWED = "recently_viewed"
    BECAUSE_YOU_VIEWED = "because_you_viewed"
    CART_BASED = "cart_based"
    FREQUENTLY_BOUGHT = "frequently_bought"


class UserEvent(Base):
    """
    Tracks all user behavior events for analytics and personalization.
    """
    __tablename__ = "user_events"

    id = Column(Integer, primary_key=True, index=True)

    # User identification (can be anonymous via session_id)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    session_id = Column(String(64), nullable=False, index=True)

    # Event details
    event_type = Column(String(50), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Context
    product_id = Column(Integer, nullable=True, index=True)
    category_id = Column(Integer, nullable=True)
    search_query = Column(String(255), nullable=True)

    # Recommendation tracking
    recommendation_type = Column(String(50), nullable=True)
    recommendation_position = Column(Integer, nullable=True)
    recommendation_source = Column(String(100), nullable=True)

    # Additional data (note: 'metadata' is reserved in SQLAlchemy)
    event_data = Column(JSON, nullable=True)  # Flexible storage for extra data
    page_url = Column(String(500), nullable=True)
    referrer = Column(String(500), nullable=True)

    # Device/session info
    device_type = Column(String(20), nullable=True)  # mobile, desktop, tablet
    user_agent = Column(String(500), nullable=True)

    # Indexes for common queries
    __table_args__ = (
        Index('idx_user_events_user_date', 'user_id', 'timestamp'),
        Index('idx_user_events_session_date', 'session_id', 'timestamp'),
        Index('idx_user_events_product_type', 'product_id', 'event_type'),
    )


class RecommendationPerformance(Base):
    """
    Aggregated recommendation performance metrics.
    Updated periodically for dashboard display.
    """
    __tablename__ = "recommendation_performance"

    id = Column(Integer, primary_key=True, index=True)

    # Time period
    date = Column(DateTime, nullable=False, index=True)
    period = Column(String(20), default="daily")  # daily, weekly, monthly

    # Recommendation type
    recommendation_type = Column(String(50), nullable=False)
    placement = Column(String(50), nullable=True)  # homepage, pdp, cart, etc.

    # Metrics
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    add_to_carts = Column(Integer, default=0)
    purchases = Column(Integer, default=0)

    # Calculated rates (stored for quick access)
    click_rate = Column(Float, default=0.0)
    cart_rate = Column(Float, default=0.0)
    conversion_rate = Column(Float, default=0.0)

    # Revenue attribution
    attributed_revenue = Column(Float, default=0.0)

    __table_args__ = (
        Index('idx_rec_perf_date_type', 'date', 'recommendation_type'),
    )


class AIModuleUsage(Base):
    """
    Tracks usage of AI modules for analytics.
    """
    __tablename__ = "ai_module_usage"

    id = Column(Integer, primary_key=True, index=True)

    date = Column(DateTime, nullable=False, index=True)
    period = Column(String(20), default="daily")

    # Module metrics
    assistant_sessions = Column(Integer, default=0)
    assistant_messages = Column(Integer, default=0)
    assistant_product_clicks = Column(Integer, default=0)
    assistant_conversions = Column(Integer, default=0)

    visual_search_uploads = Column(Integer, default=0)
    visual_search_result_clicks = Column(Integer, default=0)
    visual_search_conversions = Column(Integer, default=0)

    recommendations_served = Column(Integer, default=0)
    recommendations_clicked = Column(Integer, default=0)
    recommendations_converted = Column(Integer, default=0)

    # Unique users
    unique_assistant_users = Column(Integer, default=0)
    unique_visual_search_users = Column(Integer, default=0)


class ProductPopularity(Base):
    """
    Tracks product popularity for trending and merchandising.
    """
    __tablename__ = "product_popularity"

    id = Column(Integer, primary_key=True, index=True)

    product_id = Column(Integer, nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)

    # Engagement metrics
    views = Column(Integer, default=0)
    clicks_from_recommendations = Column(Integer, default=0)
    add_to_carts = Column(Integer, default=0)
    purchases = Column(Integer, default=0)
    wishlist_adds = Column(Integer, default=0)

    # Score for trending calculation
    popularity_score = Column(Float, default=0.0)

    __table_args__ = (
        Index('idx_product_pop_date', 'date', 'popularity_score'),
    )


class SearchTrend(Base):
    """
    Tracks search queries for trend analysis.
    """
    __tablename__ = "search_trends"

    id = Column(Integer, primary_key=True, index=True)

    query = Column(String(255), nullable=False, index=True)
    normalized_query = Column(String(255), nullable=True)  # Lowercase, trimmed
    date = Column(DateTime, nullable=False, index=True)

    search_count = Column(Integer, default=0)
    results_count = Column(Integer, default=0)  # Average results returned
    click_through_rate = Column(Float, default=0.0)
    zero_results_count = Column(Integer, default=0)

    __table_args__ = (
        Index('idx_search_trends_date_count', 'date', 'search_count'),
    )


class UserStyleProfile(Base):
    """
    Persistent user style preferences for personalized recommendations.
    This is the source of truth for user fashion preferences.
    """
    __tablename__ = "user_style_profiles"

    id = Column(Integer, primary_key=True, index=True)

    # User identification - can be user_id (authenticated) or session_id (anonymous)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, unique=True, index=True)
    session_id = Column(String(64), nullable=True, index=True)

    # Style preferences (JSON arrays)
    preferred_styles = Column(JSON, default=list)  # ["casual", "chic", "sporty", "elegant"]
    preferred_colors = Column(JSON, default=list)  # ["noir", "blanc", "beige", "marine"]
    preferred_occasions = Column(JSON, default=list)  # ["work", "weekend", "evening", "sport"]
    preferred_categories = Column(JSON, default=list)  # ["robes", "pantalons", "tops"]

    # Size preferences
    size_top = Column(String(10), nullable=True)  # S, M, L, XL
    size_bottom = Column(String(10), nullable=True)  # 36, 38, 40, 42
    size_shoes = Column(String(10), nullable=True)  # 37, 38, 39, 40

    # Budget preferences
    price_sensitivity = Column(String(20), default="medium")  # low, medium, high, luxury
    min_price = Column(Float, nullable=True)
    max_price = Column(Float, nullable=True)

    # Computed preferences (updated by behavior analysis)
    inferred_styles = Column(JSON, default=list)  # Styles detected from behavior
    inferred_colors = Column(JSON, default=list)  # Colors detected from behavior
    category_affinity = Column(JSON, default=dict)  # {"robes": 0.8, "tops": 0.6}
    brand_affinity = Column(JSON, default=dict)  # Not used yet, for future

    # Profile completeness and quality
    completion_score = Column(Float, default=0.0)  # 0-100%
    last_behavior_update = Column(DateTime, nullable=True)  # When inferred prefs were updated

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_style_profile_user', 'user_id'),
        Index('idx_style_profile_session', 'session_id'),
    )

    def to_dict(self):
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "preferred_styles": self.preferred_styles or [],
            "preferred_colors": self.preferred_colors or [],
            "preferred_occasions": self.preferred_occasions or [],
            "preferred_categories": self.preferred_categories or [],
            "size_top": self.size_top,
            "size_bottom": self.size_bottom,
            "size_shoes": self.size_shoes,
            "price_sensitivity": self.price_sensitivity,
            "min_price": self.min_price,
            "max_price": self.max_price,
            "inferred_styles": self.inferred_styles or [],
            "inferred_colors": self.inferred_colors or [],
            "category_affinity": self.category_affinity or {},
            "completion_score": self.completion_score,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class RecommendationEvent(Base):
    """
    Dedicated table for recommendation tracking with full attribution.
    Separates recommendation events from general user events for performance.
    """
    __tablename__ = "recommendation_events"

    id = Column(Integer, primary_key=True, index=True)

    # Identification
    recommendation_id = Column(String(100), nullable=False, index=True)  # Unique tracking ID
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    session_id = Column(String(64), nullable=False, index=True)

    # Event details
    event_type = Column(String(30), nullable=False, index=True)  # impression, click, add_to_cart, purchase
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Recommendation context
    product_id = Column(Integer, nullable=False, index=True)
    strategy = Column(String(50), nullable=False, index=True)  # similar, trending, personalized, etc.
    position = Column(Integer, nullable=True)  # Position in carousel (1-indexed)
    placement = Column(String(50), nullable=True)  # homepage, pdp, cart, checkout, account

    # Attribution data
    source_product_id = Column(Integer, nullable=True)  # Product that triggered recommendation (for similar/complementary)
    experiment_variant = Column(String(50), nullable=True)  # A/B test variant

    # Revenue attribution (populated on purchase)
    attributed_revenue = Column(Float, default=0.0)

    # Additional context
    device_type = Column(String(20), nullable=True)
    event_data = Column(JSON, nullable=True)

    __table_args__ = (
        Index('idx_rec_events_strategy_date', 'strategy', 'timestamp'),
        Index('idx_rec_events_product_date', 'product_id', 'timestamp'),
        Index('idx_rec_events_user_date', 'user_id', 'timestamp'),
    )
