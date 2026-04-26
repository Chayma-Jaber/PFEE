"""
Outfit Models
Shop the Look / Outfit Builder feature for curated outfits
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class OutfitFamily(str, enum.Enum):
    """Gender/family for outfit targeting"""
    MEN = "MEN"
    WOMEN = "WOMEN"
    KIDS = "KIDS"
    UNISEX = "UNISEX"


class OutfitOccasion(str, enum.Enum):
    """Occasion types for outfits"""
    CASUAL = "casual"
    FORMAL = "formal"
    BUSINESS = "business"
    SPORT = "sport"
    PARTY = "party"
    BEACH = "beach"
    WEDDING = "wedding"
    DATE = "date"
    TRAVEL = "travel"
    EVERYDAY = "everyday"


class OutfitSeason(str, enum.Enum):
    """Season for outfit recommendations"""
    SPRING = "spring"
    SUMMER = "summer"
    FALL = "fall"
    WINTER = "winter"
    ALL_SEASON = "all_season"


class Outfit(Base):
    """
    Curated outfit/look model
    Represents a complete styled look with multiple products
    """
    __tablename__ = "outfits"

    id = Column(Integer, primary_key=True, index=True)

    # Basic info
    title = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Classification
    style_tags = Column(String(500), nullable=True)  # Comma-separated: "minimalist,chic,elegant"
    occasion = Column(Enum(OutfitOccasion), default=OutfitOccasion.EVERYDAY, nullable=False)
    season = Column(Enum(OutfitSeason), default=OutfitSeason.ALL_SEASON, nullable=False)
    family = Column(Enum(OutfitFamily), default=OutfitFamily.UNISEX, nullable=False)

    # Media
    cover_image = Column(String(500), nullable=True)

    # Flags
    is_featured = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    # Analytics
    view_count = Column(Integer, default=0)
    add_to_cart_count = Column(Integer, default=0)

    # Audit
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items = relationship("OutfitItem", back_populates="outfit", cascade="all, delete-orphan", order_by="OutfitItem.position")
    creator = relationship("User", foreign_keys=[created_by])

    @property
    def style_tags_list(self) -> list:
        """Return style tags as a list"""
        if not self.style_tags:
            return []
        return [tag.strip() for tag in self.style_tags.split(",") if tag.strip()]

    @property
    def total_price(self) -> float:
        """Calculate total price of all items in the outfit"""
        total = 0.0
        for item in self.items:
            if item.product:
                total += item.product.current_price or item.product.price or 0
        return total

    @property
    def product_count(self) -> int:
        """Number of products in this outfit"""
        return len(self.items)

    def to_dict(self, include_items=True):
        data = {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "description": self.description,
            "styleTags": self.style_tags_list,
            "occasion": self.occasion.value if self.occasion else None,
            "season": self.season.value if self.season else None,
            "family": self.family.value if self.family else None,
            "coverImage": self.cover_image,
            "isFeatured": self.is_featured,
            "isActive": self.is_active,
            "viewCount": self.view_count,
            "addToCartCount": self.add_to_cart_count,
            "totalPrice": self.total_price,
            "productCount": self.product_count,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }
        if include_items:
            data["items"] = [item.to_dict() for item in self.items]
        return data


class OutfitItem(Base):
    """
    Individual item within an outfit
    Links a product to an outfit with positioning and styling notes
    """
    __tablename__ = "outfit_items"

    id = Column(Integer, primary_key=True, index=True)
    outfit_id = Column(Integer, ForeignKey("outfits.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)

    # Display
    position = Column(Integer, default=0)  # Order in the outfit display
    styling_note = Column(String(500), nullable=True)  # e.g., "Tuck into high-waist pants"

    # Optional: recommended variant
    recommended_color = Column(String(50), nullable=True)
    recommended_size = Column(String(20), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    outfit = relationship("Outfit", back_populates="items")
    product = relationship("Product")

    def to_dict(self):
        product_data = None
        if self.product:
            product_data = {
                "id": self.product.id,
                "sku": self.product.sku,
                "title": self.product.title,
                "price": self.product.price,
                "currentPrice": self.product.current_price,
                "discount": self.product.discount,
                "discountValue": self.product.discount_value,
                "firstImageUrl": self.product.first_image_url,
                "famille": self.product.famille,
                "isAvailable": self.product.is_available,
                "totalStock": self.product.total_stock
            }

        return {
            "id": self.id,
            "outfitId": self.outfit_id,
            "productId": self.product_id,
            "position": self.position,
            "stylingNote": self.styling_note,
            "recommendedColor": self.recommended_color,
            "recommendedSize": self.recommended_size,
            "product": product_data,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
