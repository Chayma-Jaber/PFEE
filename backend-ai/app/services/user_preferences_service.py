"""
Barsha User Preferences Service
===============================
Manages user style profiles and preference persistence.

Features:
- Create/update user style preferences
- Merge explicit preferences with inferred behavior
- Calculate profile completeness
- Sync between authenticated users and sessions
"""

from typing import Optional, Dict, List, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import logging

from app.models.analytics import UserStyleProfile, UserEvent, EventType

logger = logging.getLogger(__name__)


class UserPreferencesService:
    """Service for managing user style profiles and preferences."""

    def __init__(self, db: Session):
        self.db = db

    def get_or_create_profile(
        self,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None
    ) -> UserStyleProfile:
        """
        Get existing profile or create new one.
        Prioritizes user_id over session_id.
        """
        if not user_id and not session_id:
            raise ValueError("Either user_id or session_id must be provided")

        profile = None

        # Try to find by user_id first
        if user_id:
            profile = self.db.query(UserStyleProfile).filter(
                UserStyleProfile.user_id == user_id
            ).first()

        # Try session_id if no user profile found
        if not profile and session_id:
            profile = self.db.query(UserStyleProfile).filter(
                UserStyleProfile.session_id == session_id,
                UserStyleProfile.user_id.is_(None)
            ).first()

        # Create new profile if not found
        if not profile:
            profile = UserStyleProfile(
                user_id=user_id,
                session_id=session_id,
                preferred_styles=[],
                preferred_colors=[],
                preferred_occasions=[],
                preferred_categories=[],
                inferred_styles=[],
                inferred_colors=[],
                category_affinity={},
                completion_score=0.0
            )
            self.db.add(profile)
            self.db.commit()
            self.db.refresh(profile)
            logger.info(f"Created new style profile for user_id={user_id}, session_id={session_id}")

        return profile

    def update_profile(
        self,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None,
        styles: Optional[List[str]] = None,
        colors: Optional[List[str]] = None,
        occasions: Optional[List[str]] = None,
        categories: Optional[List[str]] = None,
        size_top: Optional[str] = None,
        size_bottom: Optional[str] = None,
        size_shoes: Optional[str] = None,
        price_sensitivity: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None
    ) -> UserStyleProfile:
        """
        Update user style profile with explicit preferences.
        """
        profile = self.get_or_create_profile(user_id, session_id)

        # Update only provided fields
        if styles is not None:
            profile.preferred_styles = styles
        if colors is not None:
            profile.preferred_colors = colors
        if occasions is not None:
            profile.preferred_occasions = occasions
        if categories is not None:
            profile.preferred_categories = categories
        if size_top is not None:
            profile.size_top = size_top
        if size_bottom is not None:
            profile.size_bottom = size_bottom
        if size_shoes is not None:
            profile.size_shoes = size_shoes
        if price_sensitivity is not None:
            profile.price_sensitivity = price_sensitivity
        if min_price is not None:
            profile.min_price = min_price
        if max_price is not None:
            profile.max_price = max_price

        # Recalculate completion score
        profile.completion_score = self._calculate_completion(profile)
        profile.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(profile)

        logger.info(f"Updated style profile {profile.id} - completion: {profile.completion_score}%")
        return profile

    def merge_session_to_user(self, user_id: int, session_id: str) -> Optional[UserStyleProfile]:
        """
        Merge anonymous session profile into authenticated user profile.
        Called when user logs in.
        """
        # Get session profile
        session_profile = self.db.query(UserStyleProfile).filter(
            UserStyleProfile.session_id == session_id,
            UserStyleProfile.user_id.is_(None)
        ).first()

        if not session_profile:
            return self.get_or_create_profile(user_id=user_id)

        # Get or create user profile
        user_profile = self.db.query(UserStyleProfile).filter(
            UserStyleProfile.user_id == user_id
        ).first()

        if not user_profile:
            # Promote session profile to user profile
            session_profile.user_id = user_id
            self.db.commit()
            self.db.refresh(session_profile)
            logger.info(f"Promoted session profile to user_id={user_id}")
            return session_profile

        # Merge session preferences into user profile
        # User explicit preferences take precedence, but add session data if missing
        if not user_profile.preferred_styles and session_profile.preferred_styles:
            user_profile.preferred_styles = session_profile.preferred_styles
        if not user_profile.preferred_colors and session_profile.preferred_colors:
            user_profile.preferred_colors = session_profile.preferred_colors
        if not user_profile.preferred_occasions and session_profile.preferred_occasions:
            user_profile.preferred_occasions = session_profile.preferred_occasions

        # Merge inferred data
        user_profile.inferred_styles = list(set(
            (user_profile.inferred_styles or []) +
            (session_profile.inferred_styles or [])
        ))
        user_profile.inferred_colors = list(set(
            (user_profile.inferred_colors or []) +
            (session_profile.inferred_colors or [])
        ))

        # Merge category affinity
        session_affinity = session_profile.category_affinity or {}
        user_affinity = user_profile.category_affinity or {}
        for cat, score in session_affinity.items():
            if cat in user_affinity:
                user_affinity[cat] = (user_affinity[cat] + score) / 2
            else:
                user_affinity[cat] = score
        user_profile.category_affinity = user_affinity

        # Recalculate completion
        user_profile.completion_score = self._calculate_completion(user_profile)
        user_profile.updated_at = datetime.utcnow()

        # Delete session profile after merge
        self.db.delete(session_profile)
        self.db.commit()
        self.db.refresh(user_profile)

        logger.info(f"Merged session profile into user_id={user_id}")
        return user_profile

    def update_inferred_preferences(
        self,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None,
        lookback_days: int = 30
    ) -> UserStyleProfile:
        """
        Update inferred preferences based on user behavior.
        Analyzes recent events to detect preferences.
        """
        profile = self.get_or_create_profile(user_id, session_id)

        # Build query for user events
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=lookback_days)

        query = self.db.query(UserEvent).filter(
            UserEvent.timestamp >= cutoff
        )

        if user_id:
            query = query.filter(UserEvent.user_id == user_id)
        elif session_id:
            query = query.filter(UserEvent.session_id == session_id)

        events = query.filter(
            UserEvent.event_type.in_([
                EventType.PRODUCT_VIEW.value,
                EventType.ADD_TO_CART.value,
                EventType.WISHLIST_ADD.value,
                EventType.PURCHASE_COMPLETE.value
            ])
        ).all()

        if not events:
            logger.info(f"No behavior data for profile {profile.id}")
            return profile

        # Analyze events for category affinity
        category_counts: Dict[str, float] = {}
        color_counts: Dict[str, int] = {}
        style_counts: Dict[str, int] = {}

        # Weight by event type
        event_weights = {
            EventType.PRODUCT_VIEW.value: 1,
            EventType.ADD_TO_CART.value: 3,
            EventType.WISHLIST_ADD.value: 2,
            EventType.PURCHASE_COMPLETE.value: 5
        }

        for event in events:
            weight = event_weights.get(event.event_type, 1)
            event_data = event.event_data or {}

            # Extract category from event data
            category = event_data.get("category") or event_data.get("famille")
            if category:
                category_counts[category] = category_counts.get(category, 0) + weight

            # Extract colors
            colors = event_data.get("colors") or []
            if isinstance(colors, str):
                colors = [colors]
            for color in colors:
                color_counts[color.lower()] = color_counts.get(color.lower(), 0) + weight

            # Extract style if available
            style = event_data.get("style_profile")
            if style:
                style_counts[style] = style_counts.get(style, 0) + weight

        # Normalize and store affinity
        if category_counts:
            max_count = max(category_counts.values())
            profile.category_affinity = {
                cat: round(count / max_count, 2)
                for cat, count in sorted(category_counts.items(), key=lambda x: -x[1])[:10]
            }

        # Top inferred colors (top 5)
        if color_counts:
            profile.inferred_colors = [
                color for color, _ in sorted(color_counts.items(), key=lambda x: -x[1])[:5]
            ]

        # Top inferred styles (top 3)
        if style_counts:
            profile.inferred_styles = [
                style for style, _ in sorted(style_counts.items(), key=lambda x: -x[1])[:3]
            ]

        profile.last_behavior_update = datetime.utcnow()
        self.db.commit()
        self.db.refresh(profile)

        logger.info(f"Updated inferred preferences for profile {profile.id}")
        return profile

    def get_recommendation_context(
        self,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get user context optimized for recommendation engine.
        Combines explicit and inferred preferences.
        """
        profile = self.get_or_create_profile(user_id, session_id)

        # Merge explicit and inferred preferences
        effective_styles = list(set(
            (profile.preferred_styles or []) +
            (profile.inferred_styles or [])
        ))

        effective_colors = list(set(
            (profile.preferred_colors or []) +
            (profile.inferred_colors or [])
        ))

        return {
            "user_id": user_id,
            "session_id": session_id,
            "preferred_styles": effective_styles,
            "preferred_colors": effective_colors,
            "preferred_occasions": profile.preferred_occasions or [],
            "preferred_categories": list((profile.category_affinity or {}).keys()),
            "category_affinity": profile.category_affinity or {},
            "price_sensitivity": profile.price_sensitivity or "medium",
            "min_price": profile.min_price,
            "max_price": profile.max_price,
            "size_top": profile.size_top,
            "size_bottom": profile.size_bottom,
            "profile_completeness": profile.completion_score
        }

    def _calculate_completion(self, profile: UserStyleProfile) -> float:
        """Calculate profile completion percentage."""
        score = 0.0
        total_weight = 0.0

        # Explicit preferences (60% weight)
        if profile.preferred_styles and len(profile.preferred_styles) > 0:
            score += 15
        total_weight += 15

        if profile.preferred_colors and len(profile.preferred_colors) > 0:
            score += 15
        total_weight += 15

        if profile.preferred_occasions and len(profile.preferred_occasions) > 0:
            score += 15
        total_weight += 15

        if profile.size_top or profile.size_bottom:
            score += 10
        total_weight += 10

        if profile.price_sensitivity and profile.price_sensitivity != "medium":
            score += 5
        total_weight += 5

        # Inferred preferences (40% weight)
        if profile.inferred_styles and len(profile.inferred_styles) > 0:
            score += 15
        total_weight += 15

        if profile.inferred_colors and len(profile.inferred_colors) > 0:
            score += 10
        total_weight += 10

        if profile.category_affinity and len(profile.category_affinity) > 0:
            score += 15
        total_weight += 15

        return round((score / total_weight) * 100, 1) if total_weight > 0 else 0.0


# Singleton-like function for quick access
_service_instance: Optional[UserPreferencesService] = None


def get_preferences_service(db: Session) -> UserPreferencesService:
    """Get or create preferences service instance."""
    return UserPreferencesService(db)
