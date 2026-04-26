"""
Wishlist Share Model
Shareable wishlist links for users to share their favorites
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class WishlistShare(Base):
    """Shared wishlist model for creating shareable links"""
    __tablename__ = "wishlist_shares"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Unique token for public access
    share_token = Column(String(36), unique=True, nullable=False, index=True, default=lambda: str(uuid.uuid4()))

    # Share metadata
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)

    # Visibility settings
    is_public = Column(Boolean, default=True, nullable=False)

    # Analytics
    view_count = Column(Integer, default=0, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # Optional expiration
    last_viewed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", backref="wishlist_shares")

    @staticmethod
    def generate_token() -> str:
        """Generate a unique share token"""
        return str(uuid.uuid4())

    @property
    def is_expired(self) -> bool:
        """Check if the share link has expired"""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def is_accessible(self) -> bool:
        """Check if the share is publicly accessible"""
        return self.is_public and not self.is_expired

    def increment_view_count(self):
        """Increment the view count and update last viewed timestamp"""
        self.view_count += 1
        self.last_viewed_at = datetime.utcnow()

    def to_dict(self, include_user=False, include_wishlist=False):
        """Convert to dictionary for API response"""
        data = {
            "id": self.id,
            "shareToken": self.share_token,
            "title": self.title,
            "description": self.description,
            "isPublic": self.is_public,
            "viewCount": self.view_count,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None,
            "lastViewedAt": self.last_viewed_at.isoformat() if self.last_viewed_at else None,
            "isExpired": self.is_expired,
            "isAccessible": self.is_accessible
        }

        if include_user and self.user:
            data["user"] = {
                "id": self.user.id,
                "firstName": self.user.first_name,
                "lastName": self.user.last_name,
                "fullName": self.user.full_name
            }

        if include_wishlist and self.user:
            data["wishlistItems"] = [
                item.to_dict() for item in self.user.wishlist_items
            ]

        return data

    def to_public_dict(self):
        """Convert to dictionary for public viewing (limited info)"""
        return {
            "shareToken": self.share_token,
            "title": self.title or "Ma liste de favoris",
            "description": self.description,
            "viewCount": self.view_count,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "ownerName": self.user.first_name if self.user else "Anonyme",
            "wishlistItems": [
                item.to_dict() for item in self.user.wishlist_items
            ] if self.user else []
        }
