"""
Gift Card Models
Gift cards, transactions, and store credit management
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import enum
import secrets
import string

from app.core.database import Base


class GiftCardStatus(str, enum.Enum):
    """Gift card status enumeration"""
    ACTIVE = "active"           # Available for use
    REDEEMED = "redeemed"       # Fully redeemed (zero balance)
    EXPIRED = "expired"         # Past expiration date
    CANCELLED = "cancelled"     # Cancelled by admin


class GiftCardTransactionType(str, enum.Enum):
    """Transaction type enumeration"""
    PURCHASE = "purchase"       # Initial purchase/load
    REDEMPTION = "redemption"   # Used for order payment
    REFUND = "refund"           # Refund back to card
    ADJUSTMENT = "adjustment"   # Manual admin adjustment


def generate_gift_card_code() -> str:
    """
    Generate a unique gift card code.
    Format: BRSH-XXXX-XXXX-XXXX (16 chars, alphanumeric, uppercase)
    """
    chars = string.ascii_uppercase + string.digits
    # Remove ambiguous characters (0, O, I, L)
    chars = chars.replace('0', '').replace('O', '').replace('I', '').replace('L', '')
    code = 'BRSH-' + '-'.join([''.join(secrets.choice(chars) for _ in range(4)) for _ in range(3)])
    return code


class GiftCard(Base):
    """Gift card model"""
    __tablename__ = "gift_cards"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False, index=True)

    # Value
    initial_value = Column(Float, nullable=False)
    current_balance = Column(Float, nullable=False)

    # Purchaser (nullable for admin-created cards)
    purchaser_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Recipient info (optional - for gifting)
    recipient_email = Column(String(255), nullable=True)
    recipient_name = Column(String(200), nullable=True)
    personal_message = Column(Text, nullable=True)

    # Status
    status = Column(Enum(GiftCardStatus), default=GiftCardStatus.ACTIVE, nullable=False)

    # Timestamps
    purchased_at = Column(DateTime, default=datetime.utcnow)
    activated_at = Column(DateTime, nullable=True)  # When first used
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Admin fields
    created_by_admin = Column(Integer, ForeignKey("users.id"), nullable=True)
    admin_notes = Column(Text, nullable=True)
    is_promotional = Column(Boolean, default=False)  # True for admin-created promo cards

    # Relationships
    purchaser = relationship("User", foreign_keys=[purchaser_id], backref="purchased_gift_cards")
    transactions = relationship("GiftCardTransaction", back_populates="gift_card", cascade="all, delete-orphan")

    @staticmethod
    def get_default_expiry() -> datetime:
        """Get default expiry date (1 year from now)"""
        return datetime.utcnow() + timedelta(days=365)

    @property
    def is_valid(self) -> bool:
        """Check if gift card is valid for use"""
        if self.status != GiftCardStatus.ACTIVE:
            return False
        if self.current_balance <= 0:
            return False
        if datetime.utcnow() > self.expires_at:
            return False
        return True

    @property
    def is_expired(self) -> bool:
        """Check if gift card has expired"""
        return datetime.utcnow() > self.expires_at

    def redeem(self, amount: float) -> float:
        """
        Redeem an amount from the gift card.
        Returns the actual amount redeemed (may be less if balance is lower).
        """
        if not self.is_valid:
            return 0

        actual_amount = min(amount, self.current_balance)
        self.current_balance -= actual_amount

        # Activate on first use
        if not self.activated_at:
            self.activated_at = datetime.utcnow()

        # Mark as redeemed if balance is zero
        if self.current_balance <= 0:
            self.status = GiftCardStatus.REDEEMED

        return actual_amount

    def refund(self, amount: float) -> None:
        """Refund an amount back to the gift card"""
        self.current_balance += amount
        if self.status == GiftCardStatus.REDEEMED and self.current_balance > 0:
            self.status = GiftCardStatus.ACTIVE

    def to_dict(self, include_transactions: bool = False) -> dict:
        """Convert to dictionary"""
        data = {
            "id": self.id,
            "code": self.code,
            "initialValue": self.initial_value,
            "currentBalance": self.current_balance,
            "purchaserId": self.purchaser_id,
            "recipientEmail": self.recipient_email,
            "recipientName": self.recipient_name,
            "personalMessage": self.personal_message,
            "status": self.status.value,
            "isValid": self.is_valid,
            "isExpired": self.is_expired,
            "isPromotional": self.is_promotional,
            "purchasedAt": self.purchased_at.isoformat() if self.purchased_at else None,
            "activatedAt": self.activated_at.isoformat() if self.activated_at else None,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }

        if include_transactions:
            data["transactions"] = [t.to_dict() for t in self.transactions]

        return data

    def to_public_dict(self) -> dict:
        """Convert to public dictionary (limited info for balance check)"""
        return {
            "code": self.code,
            "currentBalance": self.current_balance,
            "status": self.status.value,
            "isValid": self.is_valid,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None
        }


class GiftCardTransaction(Base):
    """Gift card transaction history"""
    __tablename__ = "gift_card_transactions"

    id = Column(Integer, primary_key=True, index=True)
    gift_card_id = Column(Integer, ForeignKey("gift_cards.id", ondelete="CASCADE"), nullable=False)

    # Transaction details
    amount = Column(Float, nullable=False)  # Positive for load/refund, negative for redemption
    transaction_type = Column(Enum(GiftCardTransactionType), nullable=False)
    balance_after = Column(Float, nullable=False)  # Balance after this transaction

    # Related order (for redemptions)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)

    # User who performed the transaction
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Description
    description = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    gift_card = relationship("GiftCard", back_populates="transactions")

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "giftCardId": self.gift_card_id,
            "amount": self.amount,
            "transactionType": self.transaction_type.value,
            "balanceAfter": self.balance_after,
            "orderId": self.order_id,
            "userId": self.user_id,
            "description": self.description,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }


class UserStoreCredit(Base):
    """User store credit from redeemed gift cards"""
    __tablename__ = "user_store_credits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)

    # Balance
    balance = Column(Float, default=0, nullable=False)

    # Total redeemed (lifetime)
    total_redeemed = Column(Float, default=0, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="store_credit")
    transactions = relationship("StoreCreditTransaction", back_populates="store_credit", cascade="all, delete-orphan")

    def add_credit(self, amount: float) -> None:
        """Add credit to balance"""
        self.balance += amount
        self.total_redeemed += amount

    def use_credit(self, amount: float) -> float:
        """Use credit from balance. Returns actual amount used."""
        actual_amount = min(amount, self.balance)
        self.balance -= actual_amount
        return actual_amount

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "userId": self.user_id,
            "balance": self.balance,
            "totalRedeemed": self.total_redeemed,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }


class StoreCreditTransaction(Base):
    """Store credit transaction history"""
    __tablename__ = "store_credit_transactions"

    id = Column(Integer, primary_key=True, index=True)
    store_credit_id = Column(Integer, ForeignKey("user_store_credits.id", ondelete="CASCADE"), nullable=False)

    # Transaction details
    amount = Column(Float, nullable=False)  # Positive for add, negative for use
    balance_after = Column(Float, nullable=False)
    transaction_type = Column(String(50), nullable=False)  # gift_card_redemption, order_payment, refund, adjustment

    # Related entities
    gift_card_id = Column(Integer, ForeignKey("gift_cards.id"), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)

    # Description
    description = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    store_credit = relationship("UserStoreCredit", back_populates="transactions")

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "storeCreditId": self.store_credit_id,
            "amount": self.amount,
            "balanceAfter": self.balance_after,
            "transactionType": self.transaction_type,
            "giftCardId": self.gift_card_id,
            "orderId": self.order_id,
            "description": self.description,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
