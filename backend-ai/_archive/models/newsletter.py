"""
Newsletter Subscription Models
Email newsletter subscriptions and preferences management
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from datetime import datetime
import secrets

from app.core.database import Base


class NewsletterSubscriber(Base):
    """Newsletter subscriber model for email marketing"""
    __tablename__ = "newsletter_subscribers"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    first_name = Column(String(100), nullable=True)

    # Subscription status
    is_active = Column(Boolean, default=True)
    is_confirmed = Column(Boolean, default=False)

    # Preferences - what types of emails to receive
    preferences = Column(JSON, default=lambda: {
        "promotions": True,
        "new_arrivals": True,
        "style_tips": True
    })

    # Confirmation token for double opt-in
    confirmation_token = Column(String(100), nullable=True)

    # Timestamps
    subscribed_at = Column(DateTime, default=datetime.utcnow)
    confirmed_at = Column(DateTime, nullable=True)
    unsubscribed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Source tracking
    source = Column(String(50), default="website")  # website, popup, footer, checkout

    @staticmethod
    def generate_token() -> str:
        """Generate a secure confirmation token"""
        return secrets.token_urlsafe(32)

    def to_dict(self, include_token: bool = False):
        """Convert to dictionary representation"""
        data = {
            "id": self.id,
            "email": self.email,
            "firstName": self.first_name,
            "isActive": self.is_active,
            "isConfirmed": self.is_confirmed,
            "preferences": self.preferences or {
                "promotions": True,
                "new_arrivals": True,
                "style_tips": True
            },
            "subscribedAt": self.subscribed_at.isoformat() if self.subscribed_at else None,
            "confirmedAt": self.confirmed_at.isoformat() if self.confirmed_at else None,
            "unsubscribedAt": self.unsubscribed_at.isoformat() if self.unsubscribed_at else None,
            "source": self.source
        }
        if include_token:
            data["confirmationToken"] = self.confirmation_token
        return data
