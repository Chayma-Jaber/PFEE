"""
Product Alert Models
Price drop and back-in-stock alerts for users
"""
from sqlalchemy import Column, Integer, Float, Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class AlertType(str, enum.Enum):
    """Alert types"""
    PRICE_DROP = "price_drop"          # Alert when price drops below target
    BACK_IN_STOCK = "back_in_stock"    # Alert when product is back in stock


class ProductAlert(Base):
    """Product alert model for price drop and back-in-stock notifications"""
    __tablename__ = "product_alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)

    # Alert type
    alert_type = Column(Enum(AlertType), nullable=False, index=True)

    # For price drop alerts - the target price to trigger alert
    target_price = Column(Float, nullable=True)

    # Original price when alert was created (for reference)
    original_price = Column(Float, nullable=True)

    # Optional: specific variant to track (for back in stock)
    variant_id = Column(Integer, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)

    # Status
    is_active = Column(Boolean, default=True, index=True)

    # Notification tracking
    notification_sent = Column(Boolean, default=False)
    notification_sent_at = Column(DateTime, nullable=True)

    # Triggered info
    triggered_at = Column(DateTime, nullable=True)
    triggered_price = Column(Float, nullable=True)  # Price when triggered (for price drop)

    # Optional note from user
    note = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # Optional expiration

    # Relationships
    user = relationship("User", backref="product_alerts")
    product = relationship("Product", backref="alerts")
    variant = relationship("ProductVariant", backref="alerts")

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": self.id,
            "userId": self.user_id,
            "productId": self.product_id,
            "alertType": self.alert_type.value,
            "targetPrice": self.target_price,
            "originalPrice": self.original_price,
            "variantId": self.variant_id,
            "isActive": self.is_active,
            "notificationSent": self.notification_sent,
            "notificationSentAt": self.notification_sent_at.isoformat() if self.notification_sent_at else None,
            "triggeredAt": self.triggered_at.isoformat() if self.triggered_at else None,
            "triggeredPrice": self.triggered_price,
            "note": self.note,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None,
            "product": self.product.to_dict(include_variants=False) if self.product else None,
            "variant": self.variant.to_dict() if self.variant else None
        }

    def to_dict_minimal(self):
        """Convert to minimal dictionary (without relationships)"""
        return {
            "id": self.id,
            "userId": self.user_id,
            "productId": self.product_id,
            "alertType": self.alert_type.value,
            "targetPrice": self.target_price,
            "originalPrice": self.original_price,
            "variantId": self.variant_id,
            "isActive": self.is_active,
            "notificationSent": self.notification_sent,
            "triggeredAt": self.triggered_at.isoformat() if self.triggered_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }

    @staticmethod
    def create_price_drop_alert(
        user_id: int,
        product_id: int,
        target_price: float,
        original_price: float = None,
        note: str = None,
        expires_at: datetime = None
    ) -> "ProductAlert":
        """Factory method for price drop alerts"""
        return ProductAlert(
            user_id=user_id,
            product_id=product_id,
            alert_type=AlertType.PRICE_DROP,
            target_price=target_price,
            original_price=original_price,
            note=note,
            expires_at=expires_at
        )

    @staticmethod
    def create_back_in_stock_alert(
        user_id: int,
        product_id: int,
        variant_id: int = None,
        note: str = None,
        expires_at: datetime = None
    ) -> "ProductAlert":
        """Factory method for back-in-stock alerts"""
        return ProductAlert(
            user_id=user_id,
            product_id=product_id,
            alert_type=AlertType.BACK_IN_STOCK,
            variant_id=variant_id,
            note=note,
            expires_at=expires_at
        )


class AlertHistory(Base):
    """History of triggered alerts for analytics"""
    __tablename__ = "alert_history"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("product_alerts.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)

    # Alert details (copied from alert for historical record)
    alert_type = Column(Enum(AlertType), nullable=False)
    target_price = Column(Float, nullable=True)
    triggered_price = Column(Float, nullable=True)

    # Notification details
    notification_channel = Column(String(50), nullable=True)  # email, push, sms
    notification_sent_at = Column(DateTime, default=datetime.utcnow)

    # User action
    clicked = Column(Boolean, default=False)
    clicked_at = Column(DateTime, nullable=True)
    converted = Column(Boolean, default=False)  # Did user purchase?
    conversion_order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "alertId": self.alert_id,
            "userId": self.user_id,
            "productId": self.product_id,
            "alertType": self.alert_type.value,
            "targetPrice": self.target_price,
            "triggeredPrice": self.triggered_price,
            "notificationChannel": self.notification_channel,
            "notificationSentAt": self.notification_sent_at.isoformat() if self.notification_sent_at else None,
            "clicked": self.clicked,
            "clickedAt": self.clicked_at.isoformat() if self.clicked_at else None,
            "converted": self.converted,
            "conversionOrderId": self.conversion_order_id,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
