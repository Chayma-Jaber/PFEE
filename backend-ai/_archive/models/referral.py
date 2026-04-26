"""
Referral Program Models
Comprehensive referral system with codes, tracking, and rewards
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import secrets
import string

from app.core.database import Base


class ReferralStatus(str, enum.Enum):
    """Status of a referral"""
    PENDING = "pending"        # Referee signed up but hasn't completed order
    COMPLETED = "completed"    # Referee completed their first order
    REWARDED = "rewarded"      # Rewards have been distributed


class RewardType(str, enum.Enum):
    """Types of rewards for referrals"""
    LOYALTY_POINTS = "loyalty_points"
    DISCOUNT_CODE = "discount_code"
    CREDIT = "credit"


class ReferralCode(Base):
    """
    Unique referral code for each user
    Used to track referrals and attribute rewards
    """
    __tablename__ = "referral_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Unique 8-character code
    code = Column(String(8), unique=True, nullable=False, index=True)

    # Status
    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", backref="referral_code_obj")
    referrals = relationship("Referral", back_populates="referral_code", cascade="all, delete-orphan")

    @staticmethod
    def generate_code() -> str:
        """Generate a unique 8-character referral code"""
        chars = string.ascii_uppercase + string.digits
        # Exclude confusing characters (0, O, I, L, 1)
        chars = chars.replace('0', '').replace('O', '').replace('I', '').replace('L', '').replace('1', '')
        return ''.join(secrets.choice(chars) for _ in range(8))

    def to_dict(self) -> dict:
        """Convert to dictionary for API response"""
        return {
            "id": self.id,
            "userId": self.user_id,
            "code": self.code,
            "isActive": self.is_active,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "shareUrl": f"https://barsha.tn/signup?ref={self.code}"
        }


class Referral(Base):
    """
    Record of each referral relationship
    Tracks referrer, referee, and status
    """
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True)

    # Referrer (the one who shared the code)
    referrer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Referee (the new user who signed up)
    referee_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Referral code used
    referral_code_id = Column(Integer, ForeignKey("referral_codes.id", ondelete="SET NULL"), nullable=True, index=True)

    # Status tracking
    status = Column(Enum(ReferralStatus), default=ReferralStatus.PENDING, nullable=False, index=True)

    # Related order (when referee makes first purchase)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    referrer = relationship("User", foreign_keys=[referrer_id], backref="referrals_made")
    referee = relationship("User", foreign_keys=[referee_id], backref="referred_by_relation")
    referral_code = relationship("ReferralCode", back_populates="referrals")
    rewards = relationship("ReferralReward", back_populates="referral", cascade="all, delete-orphan")

    def to_dict(self, include_user_details: bool = False) -> dict:
        """Convert to dictionary for API response"""
        data = {
            "id": self.id,
            "referrerId": self.referrer_id,
            "refereeId": self.referee_id,
            "referralCodeId": self.referral_code_id,
            "status": self.status.value,
            "orderId": self.order_id,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None
        }

        if include_user_details and self.referee:
            data["referee"] = {
                "id": self.referee.id,
                "firstName": self.referee.first_name,
                "lastName": self.referee.last_name,
                "email": self.referee.email[:3] + "***" + self.referee.email[self.referee.email.index('@'):] if '@' in self.referee.email else "***"
            }

        return data


class ReferralReward(Base):
    """
    Rewards earned from referrals
    Both referrer and referee can earn rewards
    """
    __tablename__ = "referral_rewards"

    id = Column(Integer, primary_key=True, index=True)

    # Related referral
    referral_id = Column(Integer, ForeignKey("referrals.id", ondelete="CASCADE"), nullable=False, index=True)

    # User receiving the reward
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Reward details
    reward_type = Column(Enum(RewardType), nullable=False)
    reward_value = Column(Float, nullable=False)  # Points amount or discount percentage/amount
    reward_description = Column(String(255), nullable=True)

    # Discount code if applicable
    discount_code = Column(String(50), nullable=True, index=True)

    # Claim status
    is_claimed = Column(Boolean, default=False, nullable=False)
    claimed_at = Column(DateTime, nullable=True)

    # Expiration (optional)
    expires_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    referral = relationship("Referral", back_populates="rewards")
    user = relationship("User", backref="referral_rewards")

    def to_dict(self) -> dict:
        """Convert to dictionary for API response"""
        return {
            "id": self.id,
            "referralId": self.referral_id,
            "userId": self.user_id,
            "rewardType": self.reward_type.value,
            "rewardValue": self.reward_value,
            "rewardDescription": self.reward_description,
            "discountCode": self.discount_code,
            "isClaimed": self.is_claimed,
            "claimedAt": self.claimed_at.isoformat() if self.claimed_at else None,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "isExpired": self.expires_at and datetime.utcnow() > self.expires_at if self.expires_at else False
        }


# Referral Program Configuration
REFERRAL_CONFIG = {
    # Referrer rewards (100 loyalty points per successful referral)
    "REFERRER_REWARD_TYPE": RewardType.LOYALTY_POINTS,
    "REFERRER_REWARD_VALUE": 100,  # 100 loyalty points
    "REFERRER_REWARD_DESCRIPTION": "Bonus de parrainage - 100 points de fidelite",

    # Referee rewards (10% off first order)
    "REFEREE_REWARD_TYPE": RewardType.DISCOUNT_CODE,
    "REFEREE_REWARD_VALUE": 10,  # 10% discount
    "REFEREE_REWARD_DESCRIPTION": "Bienvenue! 10% de reduction sur votre premiere commande",

    # Reward expiration (in days)
    "REFEREE_DISCOUNT_EXPIRY_DAYS": 30,

    # Maximum referrals per user (0 = unlimited)
    "MAX_REFERRALS_PER_USER": 0,

    # Minimum order amount for referral to be validated
    "MIN_ORDER_AMOUNT": 50.0  # TND
}
