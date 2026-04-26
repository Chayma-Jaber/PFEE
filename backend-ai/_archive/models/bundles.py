"""
Product Bundles Models
Bundle deals for grouped products with discounts
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class ProductBundle(Base):
    """Product bundle model for grouped deals"""
    __tablename__ = "product_bundles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    discount_percentage = Column(Float, default=0.0)  # e.g., 15.0 for 15% off
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    image_url = Column(String(500), nullable=True)

    # Optional: Start and end dates for limited-time bundles
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)

    # Display order
    position = Column(Integer, default=0)

    # Analytics
    view_count = Column(Integer, default=0)
    purchase_count = Column(Integer, default=0)

    # Relationships
    items = relationship("BundleItem", back_populates="bundle", cascade="all, delete-orphan")

    def to_dict(self, include_items=True):
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "discountPercentage": self.discount_percentage,
            "isActive": self.is_active,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "imageUrl": self.image_url,
            "startDate": self.start_date.isoformat() if self.start_date else None,
            "endDate": self.end_date.isoformat() if self.end_date else None,
            "position": self.position,
            "viewCount": self.view_count,
            "purchaseCount": self.purchase_count
        }
        if include_items:
            data["items"] = [item.to_dict() for item in self.items]
        return data


class BundleItem(Base):
    """Bundle item model linking products to bundles"""
    __tablename__ = "bundle_items"

    id = Column(Integer, primary_key=True, index=True)
    bundle_id = Column(Integer, ForeignKey("product_bundles.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(50), nullable=False)  # References external product ID
    quantity = Column(Integer, default=1)
    position = Column(Integer, default=0)  # Order within the bundle

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    bundle = relationship("ProductBundle", back_populates="items")

    def to_dict(self):
        return {
            "id": self.id,
            "bundleId": self.bundle_id,
            "productId": self.product_id,
            "quantity": self.quantity,
            "position": self.position
        }
