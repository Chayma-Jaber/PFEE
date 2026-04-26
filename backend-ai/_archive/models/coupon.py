"""
Coupon Models
Promotions and discount codes
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class DiscountType(str, enum.Enum):
    """Discount type enumeration"""
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"
    FREE_SHIPPING = "free_shipping"


class Coupon(Base):
    """Coupon/promotion model"""
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # Discount
    discount_type = Column(Enum(DiscountType), nullable=False)
    discount_value = Column(Float, nullable=False)  # Percentage or amount

    # Limits
    minimum_order_amount = Column(Float, nullable=True)
    maximum_discount_amount = Column(Float, nullable=True)  # Cap for percentage discounts
    usage_limit = Column(Integer, nullable=True)  # Total uses allowed
    usage_limit_per_user = Column(Integer, default=1)

    # Usage tracking
    usage_count = Column(Integer, default=0)

    # Validity
    starts_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

    # Restrictions
    first_order_only = Column(Boolean, default=False)
    new_customers_only = Column(Boolean, default=False)

    # Category/Product restrictions (JSON arrays)
    applicable_category_ids = Column(Text, nullable=True)  # JSON array of category IDs
    applicable_product_ids = Column(Text, nullable=True)  # JSON array of product IDs
    excluded_product_ids = Column(Text, nullable=True)  # JSON array

    # External reference
    external_id = Column(Integer, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    orders = relationship("Order", back_populates="coupon")
    usages = relationship("CouponUsage", back_populates="coupon")

    @property
    def is_valid(self) -> bool:
        """Check if coupon is currently valid"""
        now = datetime.utcnow()
        if not self.is_active:
            return False
        if self.starts_at and now < self.starts_at:
            return False
        if self.expires_at and now > self.expires_at:
            return False
        if self.usage_limit and self.usage_count >= self.usage_limit:
            return False
        return True

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "discountType": self.discount_type.value,
            "discountValue": self.discount_value,
            "minimumOrderAmount": self.minimum_order_amount,
            "maximumDiscountAmount": self.maximum_discount_amount,
            "usageLimit": self.usage_limit,
            "usageLimitPerUser": self.usage_limit_per_user,
            "usageCount": self.usage_count,
            "startsAt": self.starts_at.isoformat() if self.starts_at else None,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None,
            "isActive": self.is_active,
            "isValid": self.is_valid,
            "firstOrderOnly": self.first_order_only,
            "newCustomersOnly": self.new_customers_only,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }


class CouponUsage(Base):
    """Coupon usage tracking"""
    __tablename__ = "coupon_usages"

    id = Column(Integer, primary_key=True, index=True)
    coupon_id = Column(Integer, ForeignKey("coupons.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)

    discount_amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    coupon = relationship("Coupon", back_populates="usages")
    user = relationship("User", back_populates="coupon_usages")

    def to_dict(self):
        return {
            "id": self.id,
            "couponId": self.coupon_id,
            "userId": self.user_id,
            "orderId": self.order_id,
            "discountAmount": self.discount_amount,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
