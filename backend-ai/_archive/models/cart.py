"""
Cart Model
Shopping cart for logged-in users
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class CartItem(Base):
    """Cart item model"""
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(Integer, ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=True)

    quantity = Column(Integer, default=1, nullable=False)

    # Selected options
    selected_color = Column(String(50), nullable=True)
    selected_size = Column(String(20), nullable=True)
    ean13 = Column(String(20), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="cart_items")
    product = relationship("Product")
    variant = relationship("ProductVariant")

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "productId": self.product_id,
            "variantId": self.variant_id,
            "quantity": self.quantity,
            "selectedColor": self.selected_color,
            "selectedSize": self.selected_size,
            "ean13": self.ean13,
            "product": self.product.to_dict(include_variants=False) if self.product else None,
            "variant": self.variant.to_dict() if self.variant else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
