"""
Product Review Model
====================
Handles product reviews and ratings for social proof and user engagement.
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Float, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class ProductReview(Base):
    """
    Product review and rating from verified purchasers.
    """
    __tablename__ = "product_reviews"

    id = Column(Integer, primary_key=True, index=True)

    # Relations
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, nullable=False, index=True)  # External product ID from main DB
    order_id = Column(Integer, nullable=True)  # Optional: Link to order for verified purchase

    # Review content
    rating = Column(Integer, nullable=False)  # 1-5 stars
    title = Column(String(255), nullable=True)
    comment = Column(Text, nullable=True)

    # Media (optional photos)
    images = Column(Text, nullable=True)  # JSON array of image URLs

    # Metadata
    is_verified_purchase = Column(Boolean, default=False)
    is_recommended = Column(Boolean, default=True)  # "Would recommend this product"

    # Fit rating for clothing (optional)
    fit_rating = Column(String(20), nullable=True)  # 'small', 'true_to_size', 'large'

    # Moderation
    is_approved = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)
    moderation_note = Column(String(500), nullable=True)
    moderated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    moderated_at = Column(DateTime, nullable=True)

    # Engagement
    helpful_count = Column(Integer, default=0)
    not_helpful_count = Column(Integer, default=0)

    # Admin response
    admin_response = Column(Text, nullable=True)
    admin_response_at = Column(DateTime, nullable=True)
    admin_response_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Constraints
    __table_args__ = (
        CheckConstraint('rating >= 1 AND rating <= 5', name='check_rating_range'),
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    moderator = relationship("User", foreign_keys=[moderated_by])
    admin_responder = relationship("User", foreign_keys=[admin_response_by])
    votes = relationship("ReviewVote", back_populates="review", cascade="all, delete-orphan")

    def to_dict(self, include_user=True):
        data = {
            "id": self.id,
            "productId": self.product_id,
            "rating": self.rating,
            "title": self.title,
            "comment": self.comment,
            "images": self.images.split(",") if self.images else [],
            "isVerifiedPurchase": self.is_verified_purchase,
            "isRecommended": self.is_recommended,
            "fitRating": self.fit_rating,
            "helpfulCount": self.helpful_count,
            "notHelpfulCount": self.not_helpful_count,
            "isFeatured": self.is_featured,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "adminResponse": self.admin_response,
            "adminResponseAt": self.admin_response_at.isoformat() if self.admin_response_at else None
        }

        if include_user and self.user:
            # Only include safe user info
            data["user"] = {
                "id": self.user.id,
                "firstName": self.user.first_name,
                "lastInitial": self.user.last_name[0] if self.user.last_name else "",
            }

        return data

    def to_admin_dict(self):
        """Full details for admin view"""
        data = self.to_dict(include_user=True)
        data.update({
            "userId": self.user_id,
            "orderId": self.order_id,
            "isApproved": self.is_approved,
            "moderationNote": self.moderation_note,
            "moderatedBy": self.moderated_by,
            "moderatedAt": self.moderated_at.isoformat() if self.moderated_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        })
        if self.user:
            data["user"]["email"] = self.user.email
            data["user"]["lastName"] = self.user.last_name
        return data


class ReviewVote(Base):
    """
    Tracks helpful/not helpful votes on reviews.
    One vote per user per review.
    """
    __tablename__ = "review_votes"

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("product_reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_helpful = Column(Boolean, nullable=False)  # True = helpful, False = not helpful
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    review = relationship("ProductReview", back_populates="votes")
    user = relationship("User")


class ProductRatingStats(Base):
    """
    Cached rating statistics per product for fast retrieval.
    Updated when reviews are added/modified/deleted.
    """
    __tablename__ = "product_rating_stats"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, unique=True, nullable=False, index=True)

    # Aggregated stats
    average_rating = Column(Float, default=0.0)
    total_reviews = Column(Integer, default=0)

    # Rating distribution
    rating_1_count = Column(Integer, default=0)
    rating_2_count = Column(Integer, default=0)
    rating_3_count = Column(Integer, default=0)
    rating_4_count = Column(Integer, default=0)
    rating_5_count = Column(Integer, default=0)

    # Verified purchase stats
    verified_reviews = Column(Integer, default=0)
    recommendation_rate = Column(Float, default=0.0)  # Percentage who recommend

    # Fit distribution for clothing
    fit_small_count = Column(Integer, default=0)
    fit_true_count = Column(Integer, default=0)
    fit_large_count = Column(Integer, default=0)

    # Timestamps
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "productId": self.product_id,
            "averageRating": round(self.average_rating, 1),
            "totalReviews": self.total_reviews,
            "ratingDistribution": {
                "1": self.rating_1_count,
                "2": self.rating_2_count,
                "3": self.rating_3_count,
                "4": self.rating_4_count,
                "5": self.rating_5_count
            },
            "verifiedReviews": self.verified_reviews,
            "recommendationRate": round(self.recommendation_rate, 0),
            "fitDistribution": {
                "small": self.fit_small_count,
                "trueToSize": self.fit_true_count,
                "large": self.fit_large_count
            }
        }
