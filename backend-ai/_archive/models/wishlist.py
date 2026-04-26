"""
Wishlist Model
User product favorites with collection support
"""
from sqlalchemy import Column, Integer, DateTime, ForeignKey, String, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class WishlistCollection(Base):
    """Wishlist collection model for organizing favorites"""
    __tablename__ = "wishlist_collections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    is_public = Column(Boolean, default=False, nullable=False)
    share_token = Column(String(50), nullable=True, unique=True, index=True)
    cover_image = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="wishlist_collections")
    items = relationship("WishlistItem", back_populates="collection", cascade="all, delete-orphan")

    @staticmethod
    def generate_share_token() -> str:
        """Generate a unique share token"""
        return str(uuid.uuid4())[:12]

    def to_dict(self, include_items=False, include_preview=True):
        """Convert to dictionary for API response"""
        data = {
            "id": self.id,
            "userId": self.user_id,
            "name": self.name,
            "description": self.description,
            "isDefault": self.is_default,
            "isPublic": self.is_public,
            "shareToken": self.share_token,
            "coverImage": self.cover_image,
            "itemCount": len(self.items) if self.items else 0,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }

        if include_preview and self.items:
            # Get first 4 items for preview
            preview_items = self.items[:4]
            data["previewImages"] = [
                item.product.first_image_url if item.product and hasattr(item.product, 'first_image_url') else None
                for item in preview_items
            ]

        if include_items:
            data["items"] = [item.to_dict() for item in self.items]

        return data


class WishlistItem(Base):
    """Wishlist item model"""
    __tablename__ = "wishlist_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    collection_id = Column(Integer, ForeignKey("wishlist_collections.id", ondelete="SET NULL"), nullable=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    notes = Column(Text, nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="wishlist_items")
    collection = relationship("WishlistCollection", back_populates="items")
    product = relationship("Product")

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "collectionId": self.collection_id,
            "productId": self.product_id,
            "notes": self.notes,
            "addedAt": self.added_at.isoformat() if self.added_at else None,
            "product": self.product.to_dict(include_variants=False) if self.product else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
