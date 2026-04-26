"""
Loyalty Points System Models
Comprehensive loyalty program with tiers, points, transactions, and redemptions
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import enum

from app.core.database import Base


class LoyaltyTier(str, enum.Enum):
    """
    Loyalty tier enumeration
    Each tier provides different benefits and multipliers
    """
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"

    @classmethod
    def get_tier_config(cls, tier: "LoyaltyTier") -> dict:
        """Get configuration for a specific tier"""
        configs = {
            cls.BRONZE: {
                "name": "Bronze",
                "minimum_points": 0,
                "points_multiplier": 1.0,
                "free_shipping_threshold": 200.0,  # TND
                "color": "#CD7F32",
                "icon": "award"
            },
            cls.SILVER: {
                "name": "Argent",
                "minimum_points": 500,
                "points_multiplier": 1.25,
                "free_shipping_threshold": 150.0,  # TND
                "color": "#C0C0C0",
                "icon": "award"
            },
            cls.GOLD: {
                "name": "Or",
                "minimum_points": 2000,
                "points_multiplier": 1.5,
                "free_shipping_threshold": 100.0,  # TND
                "color": "#FFD700",
                "icon": "crown"
            },
            cls.PLATINUM: {
                "name": "Platine",
                "minimum_points": 5000,
                "points_multiplier": 2.0,
                "free_shipping_threshold": 0.0,  # Always free
                "color": "#E5E4E2",
                "icon": "gem"
            }
        }
        return configs.get(tier, configs[cls.BRONZE])

    @classmethod
    def get_tier_for_points(cls, total_points: int) -> "LoyaltyTier":
        """Determine the tier based on total points earned"""
        if total_points >= 5000:
            return cls.PLATINUM
        elif total_points >= 2000:
            return cls.GOLD
        elif total_points >= 500:
            return cls.SILVER
        return cls.BRONZE

    @classmethod
    def get_next_tier(cls, current_tier: "LoyaltyTier") -> tuple:
        """Get the next tier and points needed"""
        tier_order = [cls.BRONZE, cls.SILVER, cls.GOLD, cls.PLATINUM]
        current_idx = tier_order.index(current_tier)

        if current_idx >= len(tier_order) - 1:
            return None, 0  # Already at max tier

        next_tier = tier_order[current_idx + 1]
        next_config = cls.get_tier_config(next_tier)
        return next_tier, next_config["minimum_points"]


class TransactionType(str, enum.Enum):
    """Types of points transactions"""
    PURCHASE_EARN = "purchase_earn"      # Points earned from purchase
    REVIEW_BONUS = "review_bonus"        # Bonus for leaving a review
    REFERRAL_BONUS = "referral_bonus"    # Bonus for referring a friend
    BIRTHDAY_BONUS = "birthday_bonus"    # Birthday bonus points
    WELCOME_BONUS = "welcome_bonus"      # Welcome bonus for new members
    REDEMPTION = "redemption"            # Points spent on discount
    EXPIRY = "expiry"                    # Points expired
    ADJUSTMENT = "adjustment"            # Manual adjustment by admin
    REFUND_REVERSAL = "refund_reversal"  # Points reversed due to order refund


class LoyaltyAccount(Base):
    """
    Loyalty account for each user
    Tracks points balance, tier status, and lifetime statistics
    """
    __tablename__ = "loyalty_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Points tracking
    total_points_earned = Column(Integer, default=0, nullable=False)  # Lifetime points earned
    available_points = Column(Integer, default=0, nullable=False)     # Current spendable points
    pending_points = Column(Integer, default=0, nullable=False)       # Points pending confirmation

    # Tier status
    current_tier = Column(Enum(LoyaltyTier), default=LoyaltyTier.BRONZE, nullable=False)
    tier_updated_at = Column(DateTime, nullable=True)

    # Statistics
    total_points_redeemed = Column(Integer, default=0, nullable=False)
    total_discount_value = Column(Float, default=0.0, nullable=False)  # Total TND saved through redemption
    orders_count = Column(Integer, default=0, nullable=False)

    # Referral tracking
    referral_code = Column(String(20), unique=True, nullable=True, index=True)
    referred_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    referral_count = Column(Integer, default=0, nullable=False)

    # Birthday bonus tracking
    last_birthday_bonus_year = Column(Integer, nullable=True)

    # Status
    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="loyalty_account")
    transactions = relationship("PointsTransaction", back_populates="loyalty_account", cascade="all, delete-orphan")
    redemptions = relationship("PointsRedemption", back_populates="loyalty_account", cascade="all, delete-orphan")

    def get_tier_config(self) -> dict:
        """Get current tier configuration"""
        return LoyaltyTier.get_tier_config(self.current_tier)

    def get_progress_to_next_tier(self) -> dict:
        """Calculate progress to next tier"""
        next_tier, points_needed = LoyaltyTier.get_next_tier(self.current_tier)

        if not next_tier:
            return {
                "has_next_tier": False,
                "next_tier": None,
                "points_needed": 0,
                "points_remaining": 0,
                "progress_percentage": 100
            }

        current_config = LoyaltyTier.get_tier_config(self.current_tier)
        current_minimum = current_config["minimum_points"]

        points_in_tier = self.total_points_earned - current_minimum
        points_to_next = points_needed - current_minimum
        progress = min((points_in_tier / points_to_next) * 100, 100) if points_to_next > 0 else 0

        return {
            "has_next_tier": True,
            "next_tier": next_tier.value,
            "next_tier_name": LoyaltyTier.get_tier_config(next_tier)["name"],
            "points_needed": points_needed,
            "points_remaining": max(0, points_needed - self.total_points_earned),
            "progress_percentage": round(progress, 1)
        }

    def update_tier(self) -> bool:
        """Update tier based on total points earned. Returns True if tier changed."""
        new_tier = LoyaltyTier.get_tier_for_points(self.total_points_earned)
        if new_tier != self.current_tier:
            self.current_tier = new_tier
            self.tier_updated_at = datetime.utcnow()
            return True
        return False

    def to_dict(self, include_progress=True) -> dict:
        """Convert to dictionary for API response"""
        tier_config = self.get_tier_config()

        data = {
            "id": self.id,
            "userId": self.user_id,
            "availablePoints": self.available_points,
            "pendingPoints": self.pending_points,
            "totalPointsEarned": self.total_points_earned,
            "totalPointsRedeemed": self.total_points_redeemed,
            "totalDiscountValue": round(self.total_discount_value, 2),
            "currentTier": self.current_tier.value,
            "tierName": tier_config["name"],
            "tierColor": tier_config["color"],
            "tierIcon": tier_config["icon"],
            "pointsMultiplier": tier_config["points_multiplier"],
            "freeShippingThreshold": tier_config["free_shipping_threshold"],
            "ordersCount": self.orders_count,
            "referralCode": self.referral_code,
            "referralCount": self.referral_count,
            "isActive": self.is_active,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }

        if include_progress:
            data["tierProgress"] = self.get_progress_to_next_tier()

        return data


class PointsTransaction(Base):
    """
    Record of all points transactions
    Tracks earning, spending, expiration, and adjustments
    """
    __tablename__ = "points_transactions"

    id = Column(Integer, primary_key=True, index=True)
    loyalty_account_id = Column(Integer, ForeignKey("loyalty_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Transaction details
    points = Column(Integer, nullable=False)  # Positive for earned, negative for spent/expired
    transaction_type = Column(Enum(TransactionType), nullable=False, index=True)

    # Related order (for purchase earnings and redemptions)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True)
    order_reference = Column(String(50), nullable=True)

    # Description and notes
    description = Column(String(255), nullable=False)
    admin_notes = Column(Text, nullable=True)  # For manual adjustments

    # Adjusted by admin (for adjustments)
    adjusted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Balance after transaction
    balance_after = Column(Integer, nullable=False)

    # Expiration tracking (for earned points)
    expires_at = Column(DateTime, nullable=True, index=True)
    expired = Column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    loyalty_account = relationship("LoyaltyAccount", back_populates="transactions")

    @staticmethod
    def calculate_expiry_date() -> datetime:
        """Calculate expiry date (1 year from now)"""
        return datetime.utcnow() + timedelta(days=365)

    def to_dict(self) -> dict:
        """Convert to dictionary for API response"""
        return {
            "id": self.id,
            "points": self.points,
            "transactionType": self.transaction_type.value,
            "description": self.description,
            "orderReference": self.order_reference,
            "balanceAfter": self.balance_after,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None,
            "expired": self.expired,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }


class PointsRedemption(Base):
    """
    Record of points redemptions for discounts
    100 points = 1 TND discount
    """
    __tablename__ = "points_redemptions"

    id = Column(Integer, primary_key=True, index=True)
    loyalty_account_id = Column(Integer, ForeignKey("loyalty_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Redemption details
    points_redeemed = Column(Integer, nullable=False)
    discount_value = Column(Float, nullable=False)  # TND value (points / 100)

    # Related order
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True)
    order_reference = Column(String(50), nullable=True)

    # Status
    is_applied = Column(Boolean, default=False, nullable=False)  # True when order is confirmed
    is_reversed = Column(Boolean, default=False, nullable=False)  # True if order was cancelled

    # Related transaction
    transaction_id = Column(Integer, ForeignKey("points_transactions.id", ondelete="SET NULL"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    applied_at = Column(DateTime, nullable=True)
    reversed_at = Column(DateTime, nullable=True)

    # Relationships
    loyalty_account = relationship("LoyaltyAccount", back_populates="redemptions")

    @staticmethod
    def calculate_discount_value(points: int) -> float:
        """Calculate TND discount value from points (100 points = 1 TND)"""
        return round(points / 100.0, 2)

    @staticmethod
    def calculate_points_needed(discount_tnd: float) -> int:
        """Calculate points needed for a specific TND discount"""
        return int(discount_tnd * 100)

    def to_dict(self) -> dict:
        """Convert to dictionary for API response"""
        return {
            "id": self.id,
            "pointsRedeemed": self.points_redeemed,
            "discountValue": round(self.discount_value, 2),
            "orderReference": self.order_reference,
            "isApplied": self.is_applied,
            "isReversed": self.is_reversed,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "appliedAt": self.applied_at.isoformat() if self.applied_at else None
        }


# Points configuration constants
POINTS_CONFIG = {
    "POINTS_PER_TND": 1,           # 1 point per 1 TND spent
    "TND_PER_100_POINTS": 1.0,     # 100 points = 1 TND discount
    "POINTS_EXPIRY_DAYS": 365,     # Points expire after 1 year
    "MIN_REDEMPTION_POINTS": 100,  # Minimum points to redeem
    "MAX_DISCOUNT_PERCENTAGE": 50, # Maximum discount percentage per order

    # Bonus points
    "REVIEW_BONUS": 50,            # Points for leaving a review
    "REFERRAL_BONUS": 100,         # Points for successful referral
    "BIRTHDAY_BONUS": 100,         # Birthday bonus points
    "WELCOME_BONUS": 50,           # Welcome bonus for new members
}
