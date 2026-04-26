"""
User Models
User accounts, roles, and addresses
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    """User role enumeration"""
    CUSTOMER = "customer"
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    CATALOG_MANAGER = "catalog_manager"
    ORDER_MANAGER = "order_manager"
    MARKETING_MANAGER = "marketing_manager"
    SUPPORT_AGENT = "support_agent"


class User(Base):
    """User model for customers and staff"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=True)

    # Profile
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    gender = Column(String(10), nullable=True)  # homme, femme
    birth_date = Column(DateTime, nullable=True)
    avatar_url = Column(String(500), nullable=True)

    # Role and status
    role = Column(Enum(UserRole), default=UserRole.CUSTOMER, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)

    # Preferences
    newsletter_subscribed = Column(Boolean, default=False)
    preferred_language = Column(String(5), default="fr")
    selected_gender = Column(String(10), nullable=True)  # For product filtering

    # Analytics
    last_login = Column(DateTime, nullable=True)
    login_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete

    # Admin notes (for support)
    admin_notes = Column(Text, nullable=True)

    # Relationships
    addresses = relationship("Address", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user")
    wishlist_items = relationship("WishlistItem", back_populates="user", cascade="all, delete-orphan")
    wishlist_collections = relationship("WishlistCollection", back_populates="user", cascade="all, delete-orphan")
    cart_items = relationship("CartItem", back_populates="user", cascade="all, delete-orphan")
    coupon_usages = relationship("CouponUsage", back_populates="user")
    return_requests = relationship("ReturnRequest", back_populates="user", foreign_keys="[ReturnRequest.user_id]")

    @property
    def full_name(self) -> str:
        return f"{self.first_name or ''} {self.last_name or ''}".strip() or "Client"

    @property
    def is_staff(self) -> bool:
        return self.role != UserRole.CUSTOMER

    def to_dict(self, include_sensitive=False):
        data = {
            "id": self.id,
            "email": self.email,
            "phone": self.phone,
            "firstName": self.first_name,
            "lastName": self.last_name,
            "fullName": self.full_name,
            "gender": self.gender,
            "role": self.role.value,
            "isActive": self.is_active,
            "isVerified": self.is_verified,
            "newsletterSubscribed": self.newsletter_subscribed,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "lastLogin": self.last_login.isoformat() if self.last_login else None
        }
        if include_sensitive and self.role != UserRole.CUSTOMER:
            data["adminNotes"] = self.admin_notes
        return data


class Address(Base):
    """User address model"""
    __tablename__ = "addresses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Address details
    label = Column(String(100), nullable=True)  # Home, Work, etc.
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    street = Column(String(255), nullable=False)
    street2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=True)  # Governorate
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), default="Tunisie")

    # Flags
    is_default = Column(Boolean, default=False)
    is_billing = Column(Boolean, default=False)
    is_shipping = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="addresses")

    def to_dict(self):
        return {
            "id": self.id,
            "label": self.label,
            "firstName": self.first_name,
            "lastName": self.last_name,
            "phone": self.phone,
            "street": self.street,
            "street2": self.street2,
            "city": self.city,
            "state": self.state,
            "postalCode": self.postal_code,
            "country": self.country,
            "isDefault": self.is_default,
            "isBilling": self.is_billing,
            "isShipping": self.is_shipping
        }
