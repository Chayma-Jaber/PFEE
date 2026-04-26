"""
Stock Alerts Model
Back in Stock notification system for out-of-stock products
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class StockAlert(Base):
    """
    Stock Alert model for back-in-stock notifications.
    Allows users (logged in or guests via email) to subscribe to notifications
    when an out-of-stock product becomes available again.
    """
    __tablename__ = "stock_alerts"

    id = Column(Integer, primary_key=True, index=True)

    # User reference (nullable for guest users)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    # Email for guest users (required if user_id is null)
    email = Column(String(255), nullable=True, index=True)

    # Product reference
    product_id = Column(String(50), nullable=False, index=True)

    # Specific variant details (optional)
    size = Column(String(20), nullable=True)
    color = Column(String(50), nullable=True)

    # Notification status
    is_notified = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    notified_at = Column(DateTime, nullable=True)

    # Additional metadata
    product_name = Column(String(255), nullable=True)
    product_image = Column(String(500), nullable=True)
    product_price = Column(String(50), nullable=True)

    # Relationships
    user = relationship("User", backref="stock_alerts", foreign_keys=[user_id])

    def to_dict(self):
        """Convert model to dictionary for API response"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "email": self.email,
            "product_id": self.product_id,
            "size": self.size,
            "color": self.color,
            "is_notified": self.is_notified,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "notified_at": self.notified_at.isoformat() if self.notified_at else None,
            "product_name": self.product_name,
            "product_image": self.product_image,
            "product_price": self.product_price
        }

    def to_dict_minimal(self):
        """Minimal representation for list views"""
        return {
            "id": self.id,
            "product_id": self.product_id,
            "size": self.size,
            "color": self.color,
            "is_notified": self.is_notified,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

    @classmethod
    def create_alert(
        cls,
        product_id: str,
        user_id: int = None,
        email: str = None,
        size: str = None,
        color: str = None,
        product_name: str = None,
        product_image: str = None,
        product_price: str = None
    ):
        """Factory method to create a stock alert"""
        return cls(
            user_id=user_id,
            email=email,
            product_id=product_id,
            size=size,
            color=color,
            product_name=product_name,
            product_image=product_image,
            product_price=product_price,
            is_notified=False,
            created_at=datetime.utcnow()
        )
