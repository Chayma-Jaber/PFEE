"""
Promotions Models
Flash Sales and Promo Codes
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum, ForeignKey, Text, Table
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


# Many-to-many relationship table for flash sale products
flash_sale_products = Table(
    'flash_sale_products',
    Base.metadata,
    Column('flash_sale_id', Integer, ForeignKey('flash_sales.id', ondelete='CASCADE'), primary_key=True),
    Column('product_id', Integer, ForeignKey('products.id', ondelete='CASCADE'), primary_key=True)
)


class DiscountType(str, enum.Enum):
    """Discount type enumeration for promo codes"""
    PERCENTAGE = "percentage"
    FIXED = "fixed"


class FlashSale(Base):
    """Flash Sale model for time-limited promotions"""
    __tablename__ = "flash_sales"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Discount
    discount_percentage = Column(Float, nullable=False)  # Percentage off (e.g., 30 for 30%)

    # Timing
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)

    # Status
    is_active = Column(Boolean, default=True)

    # Media
    banner_image = Column(String(500), nullable=True)
    banner_mobile_image = Column(String(500), nullable=True)
    background_color = Column(String(20), default="#FF4444")
    text_color = Column(String(20), default="#FFFFFF")

    # Display settings
    show_on_homepage = Column(Boolean, default=True)
    priority = Column(Integer, default=0)  # Higher = more prominent

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    products = relationship("Product", secondary=flash_sale_products, backref="flash_sales")

    @property
    def is_currently_active(self) -> bool:
        """Check if flash sale is currently active based on time"""
        now = datetime.utcnow()
        return self.is_active and self.start_time <= now <= self.end_time

    @property
    def is_upcoming(self) -> bool:
        """Check if flash sale is upcoming"""
        now = datetime.utcnow()
        return self.is_active and now < self.start_time

    @property
    def is_ended(self) -> bool:
        """Check if flash sale has ended"""
        now = datetime.utcnow()
        return now > self.end_time

    @property
    def time_remaining_seconds(self) -> int:
        """Get remaining time in seconds"""
        if self.is_ended:
            return 0
        now = datetime.utcnow()
        if now < self.start_time:
            return int((self.start_time - now).total_seconds())
        return int((self.end_time - now).total_seconds())

    def to_dict(self, include_products: bool = False):
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "discountPercentage": self.discount_percentage,
            "startTime": self.start_time.isoformat() if self.start_time else None,
            "endTime": self.end_time.isoformat() if self.end_time else None,
            "isActive": self.is_active,
            "isCurrentlyActive": self.is_currently_active,
            "isUpcoming": self.is_upcoming,
            "isEnded": self.is_ended,
            "timeRemainingSeconds": self.time_remaining_seconds,
            "bannerImage": self.banner_image,
            "bannerMobileImage": self.banner_mobile_image,
            "backgroundColor": self.background_color,
            "textColor": self.text_color,
            "showOnHomepage": self.show_on_homepage,
            "priority": self.priority,
            "productCount": len(self.products) if self.products else 0,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
        if include_products:
            data["products"] = [self._product_with_sale_price(p) for p in self.products]
        return data

    def _product_with_sale_price(self, product):
        """Get product dict with flash sale price applied"""
        prod_dict = product.to_dict(include_variants=True)
        # Calculate flash sale price
        original_price = product.price
        sale_price = round(original_price * (1 - self.discount_percentage / 100), 3)
        prod_dict["flashSalePrice"] = sale_price
        prod_dict["flashSaleDiscount"] = self.discount_percentage
        prod_dict["flashSaleEndTime"] = self.end_time.isoformat() if self.end_time else None
        return prod_dict


class PromoCode(Base):
    """Promo Code model for discount codes"""
    __tablename__ = "promo_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)

    # Discount configuration
    discount_type = Column(Enum(DiscountType), nullable=False)
    discount_value = Column(Float, nullable=False)  # Percentage or fixed amount

    # Limits
    min_purchase = Column(Float, nullable=True)  # Minimum order amount
    max_discount = Column(Float, nullable=True)  # Maximum discount (for percentage type)
    max_uses = Column(Integer, nullable=True)  # Total uses allowed (null = unlimited)
    current_uses = Column(Integer, default=0)
    max_uses_per_user = Column(Integer, default=1)

    # Validity
    expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

    # Restrictions
    first_order_only = Column(Boolean, default=False)
    applicable_category_ids = Column(Text, nullable=True)  # JSON array
    applicable_product_ids = Column(Text, nullable=True)  # JSON array

    # Description for display
    description = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def is_valid(self) -> bool:
        """Check if promo code is currently valid"""
        now = datetime.utcnow()
        if not self.is_active:
            return False
        if self.expires_at and now > self.expires_at:
            return False
        if self.max_uses and self.current_uses >= self.max_uses:
            return False
        return True

    @property
    def remaining_uses(self) -> int | None:
        """Get remaining uses (None if unlimited)"""
        if self.max_uses is None:
            return None
        return max(0, self.max_uses - self.current_uses)

    def calculate_discount(self, order_total: float) -> float:
        """Calculate discount amount for a given order total"""
        if self.min_purchase and order_total < self.min_purchase:
            return 0

        if self.discount_type == DiscountType.PERCENTAGE:
            discount = order_total * (self.discount_value / 100)
            if self.max_discount:
                discount = min(discount, self.max_discount)
        else:  # FIXED
            discount = self.discount_value

        return min(discount, order_total)  # Can't discount more than total

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "discountType": self.discount_type.value,
            "discountValue": self.discount_value,
            "minPurchase": self.min_purchase,
            "maxDiscount": self.max_discount,
            "maxUses": self.max_uses,
            "currentUses": self.current_uses,
            "remainingUses": self.remaining_uses,
            "maxUsesPerUser": self.max_uses_per_user,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None,
            "isActive": self.is_active,
            "isValid": self.is_valid,
            "firstOrderOnly": self.first_order_only,
            "description": self.description,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }


class PromoCodeUsage(Base):
    """Track promo code usage by users"""
    __tablename__ = "promo_code_usages"

    id = Column(Integer, primary_key=True, index=True)
    promo_code_id = Column(Integer, ForeignKey("promo_codes.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)

    discount_amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    promo_code = relationship("PromoCode", backref="usages")

    def to_dict(self):
        return {
            "id": self.id,
            "promoCodeId": self.promo_code_id,
            "userId": self.user_id,
            "orderId": self.order_id,
            "discountAmount": self.discount_amount,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
