"""
Referral Program Router
API endpoints for the referral system
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta

from app.core.database import get_db
from app.routers.auth import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.order import Order, OrderStatus
from app.models.referral import (
    ReferralCode, Referral, ReferralReward,
    ReferralStatus, RewardType, REFERRAL_CONFIG
)

# Try to import loyalty models for points integration
try:
    from app.models.loyalty import LoyaltyAccount, PointsTransaction, TransactionType
    LOYALTY_ENABLED = True
except ImportError:
    LOYALTY_ENABLED = False

# ========================
# Router
# ========================

router = APIRouter(prefix="/api/referrals", tags=["Referral Program"])


# ========================
# Schemas
# ========================

class ReferralCodeResponse(BaseModel):
    """Response schema for referral code"""
    id: int
    code: str
    isActive: bool
    shareUrl: str
    createdAt: str


class ReferralStatsResponse(BaseModel):
    """Response schema for referral statistics"""
    totalReferred: int
    pendingReferrals: int
    completedReferrals: int
    totalPointsEarned: int
    totalRewardsEarned: float
    pendingRewards: int


class ReferralHistoryItem(BaseModel):
    """Response schema for a referral history item"""
    id: int
    refereeFirstName: str
    refereeEmail: str
    status: str
    rewardEarned: Optional[float]
    createdAt: str
    completedAt: Optional[str]


class ReferralHistoryResponse(BaseModel):
    """Response schema for referral history"""
    items: List[ReferralHistoryItem]
    total: int
    page: int
    pages: int


class RewardResponse(BaseModel):
    """Response schema for a reward"""
    id: int
    rewardType: str
    rewardValue: float
    rewardDescription: Optional[str]
    discountCode: Optional[str]
    isClaimed: bool
    claimedAt: Optional[str]
    expiresAt: Optional[str]
    isExpired: bool
    createdAt: str


class ApplyReferralRequest(BaseModel):
    """Request schema for applying a referral code"""
    code: str = Field(..., min_length=8, max_length=8)


class ApplyReferralResponse(BaseModel):
    """Response schema for applying a referral code"""
    success: bool
    message: str
    discountCode: Optional[str] = None
    discountValue: Optional[float] = None


# ========================
# Helper Functions
# ========================

def get_or_create_referral_code(db: Session, user: User) -> ReferralCode:
    """Get existing or create new referral code for user"""
    referral_code = db.query(ReferralCode).filter(ReferralCode.user_id == user.id).first()

    if not referral_code:
        # Generate unique code
        code = ReferralCode.generate_code()
        while db.query(ReferralCode).filter(ReferralCode.code == code).first():
            code = ReferralCode.generate_code()

        referral_code = ReferralCode(
            user_id=user.id,
            code=code,
            is_active=True
        )
        db.add(referral_code)
        db.commit()
        db.refresh(referral_code)

    return referral_code


def generate_discount_code() -> str:
    """Generate a unique discount code for referee"""
    import secrets
    import string
    chars = string.ascii_uppercase + string.digits
    return "WELCOME" + ''.join(secrets.choice(chars) for _ in range(6))


def award_referrer_points(db: Session, referrer_id: int, referral_id: int) -> Optional[int]:
    """Award loyalty points to referrer. Returns points awarded or None if loyalty not available."""
    if not LOYALTY_ENABLED:
        return None

    # Get referrer's loyalty account
    loyalty_account = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == referrer_id).first()

    if not loyalty_account:
        return None

    points = int(REFERRAL_CONFIG["REFERRER_REWARD_VALUE"])

    # Update account
    loyalty_account.available_points += points
    loyalty_account.total_points_earned += points

    # Create transaction
    transaction = PointsTransaction(
        loyalty_account_id=loyalty_account.id,
        user_id=referrer_id,
        points=points,
        transaction_type=TransactionType.REFERRAL_BONUS,
        description=REFERRAL_CONFIG["REFERRER_REWARD_DESCRIPTION"],
        balance_after=loyalty_account.available_points,
        expires_at=datetime.utcnow() + timedelta(days=365)
    )
    db.add(transaction)

    return points


# ========================
# Endpoints
# ========================

@router.get("/my-code", response_model=ReferralCodeResponse)
async def get_my_referral_code(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the current user's referral code.
    Creates one if it doesn't exist.
    """
    referral_code = get_or_create_referral_code(db, current_user)

    return ReferralCodeResponse(
        id=referral_code.id,
        code=referral_code.code,
        isActive=referral_code.is_active,
        shareUrl=f"https://barsha.tn/signup?ref={referral_code.code}",
        createdAt=referral_code.created_at.isoformat()
    )


@router.get("/stats", response_model=ReferralStatsResponse)
async def get_referral_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get referral statistics for the current user.
    """
    # Get referral code
    referral_code = get_or_create_referral_code(db, current_user)

    # Count referrals by status
    total_referred = db.query(Referral).filter(
        Referral.referrer_id == current_user.id
    ).count()

    pending_referrals = db.query(Referral).filter(
        Referral.referrer_id == current_user.id,
        Referral.status == ReferralStatus.PENDING
    ).count()

    completed_referrals = db.query(Referral).filter(
        Referral.referrer_id == current_user.id,
        Referral.status.in_([ReferralStatus.COMPLETED, ReferralStatus.REWARDED])
    ).count()

    # Calculate total rewards earned
    rewards = db.query(ReferralReward).filter(
        ReferralReward.user_id == current_user.id,
        ReferralReward.is_claimed == True
    ).all()

    total_points_earned = sum(
        int(r.reward_value) for r in rewards
        if r.reward_type == RewardType.LOYALTY_POINTS
    )

    total_rewards_earned = sum(r.reward_value for r in rewards)

    # Count pending rewards
    pending_rewards = db.query(ReferralReward).filter(
        ReferralReward.user_id == current_user.id,
        ReferralReward.is_claimed == False
    ).count()

    return ReferralStatsResponse(
        totalReferred=total_referred,
        pendingReferrals=pending_referrals,
        completedReferrals=completed_referrals,
        totalPointsEarned=total_points_earned,
        totalRewardsEarned=total_rewards_earned,
        pendingRewards=pending_rewards
    )


@router.get("/history")
async def get_referral_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get referral history for the current user.
    """
    query = db.query(Referral).filter(
        Referral.referrer_id == current_user.id
    )

    # Get total count
    total = query.count()
    pages = (total + per_page - 1) // per_page

    # Get paginated results
    referrals = query.order_by(
        Referral.created_at.desc()
    ).offset((page - 1) * per_page).limit(per_page).all()

    items = []
    for referral in referrals:
        # Get reward for this referral (if any)
        reward = db.query(ReferralReward).filter(
            ReferralReward.referral_id == referral.id,
            ReferralReward.user_id == current_user.id
        ).first()

        # Mask email for privacy
        referee_email = "***"
        if referral.referee:
            email = referral.referee.email
            if '@' in email:
                referee_email = email[:3] + "***" + email[email.index('@'):]

        items.append({
            "id": referral.id,
            "refereeFirstName": referral.referee.first_name if referral.referee else "Utilisateur",
            "refereeEmail": referee_email,
            "status": referral.status.value,
            "rewardEarned": reward.reward_value if reward and reward.is_claimed else None,
            "createdAt": referral.created_at.isoformat() if referral.created_at else None,
            "completedAt": referral.completed_at.isoformat() if referral.completed_at else None
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": pages,
        "hasMore": page < pages
    }


@router.get("/rewards")
async def get_my_rewards(
    include_claimed: bool = Query(False, description="Include already claimed rewards"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get pending rewards for the current user.
    """
    query = db.query(ReferralReward).filter(
        ReferralReward.user_id == current_user.id
    )

    if not include_claimed:
        query = query.filter(ReferralReward.is_claimed == False)

    rewards = query.order_by(ReferralReward.created_at.desc()).all()

    return {
        "rewards": [r.to_dict() for r in rewards],
        "total": len(rewards)
    }


@router.post("/claim-reward/{reward_id}")
async def claim_reward(
    reward_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Claim a pending reward.
    """
    reward = db.query(ReferralReward).filter(
        ReferralReward.id == reward_id,
        ReferralReward.user_id == current_user.id
    ).first()

    if not reward:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recompense non trouvee"
        )

    if reward.is_claimed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette recompense a deja ete reclamee"
        )

    # Check expiration
    if reward.expires_at and datetime.utcnow() > reward.expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette recompense a expire"
        )

    # Process reward based on type
    if reward.reward_type == RewardType.LOYALTY_POINTS:
        # Award loyalty points
        points_awarded = award_referrer_points(db, current_user.id, reward.referral_id)
        if points_awarded is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Impossible d'attribuer les points. Veuillez reessayer."
            )

    # Mark as claimed
    reward.is_claimed = True
    reward.claimed_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "message": f"Felicitations! Votre recompense a ete reclamee avec succes.",
        "reward": reward.to_dict()
    }


@router.post("/apply/{code}", response_model=ApplyReferralResponse)
async def apply_referral_code(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Apply a referral code during signup.
    Gives the referee a 10% discount on their first order.
    """
    # Normalize code to uppercase
    code = code.upper().strip()

    # Find the referral code
    referral_code = db.query(ReferralCode).filter(
        ReferralCode.code == code,
        ReferralCode.is_active == True
    ).first()

    if not referral_code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Code de parrainage invalide ou inactif"
        )

    # Cannot use own code
    if referral_code.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas utiliser votre propre code de parrainage"
        )

    # Check if user has already been referred
    existing_referral = db.query(Referral).filter(
        Referral.referee_id == current_user.id
    ).first()

    if existing_referral:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous avez deja utilise un code de parrainage"
        )

    # Create the referral
    referral = Referral(
        referrer_id=referral_code.user_id,
        referee_id=current_user.id,
        referral_code_id=referral_code.id,
        status=ReferralStatus.PENDING
    )
    db.add(referral)
    db.flush()  # Get the referral ID

    # Generate discount code for referee
    discount_code = generate_discount_code()
    while db.query(ReferralReward).filter(ReferralReward.discount_code == discount_code).first():
        discount_code = generate_discount_code()

    # Create referee reward (10% discount)
    referee_reward = ReferralReward(
        referral_id=referral.id,
        user_id=current_user.id,
        reward_type=RewardType.DISCOUNT_CODE,
        reward_value=REFERRAL_CONFIG["REFEREE_REWARD_VALUE"],
        reward_description=REFERRAL_CONFIG["REFEREE_REWARD_DESCRIPTION"],
        discount_code=discount_code,
        expires_at=datetime.utcnow() + timedelta(days=REFERRAL_CONFIG["REFEREE_DISCOUNT_EXPIRY_DAYS"]),
        is_claimed=True,  # Auto-claim for referee
        claimed_at=datetime.utcnow()
    )
    db.add(referee_reward)

    # Create pending reward for referrer (will be claimed when referee completes order)
    referrer_reward = ReferralReward(
        referral_id=referral.id,
        user_id=referral_code.user_id,
        reward_type=RewardType.LOYALTY_POINTS,
        reward_value=REFERRAL_CONFIG["REFERRER_REWARD_VALUE"],
        reward_description=REFERRAL_CONFIG["REFERRER_REWARD_DESCRIPTION"],
        is_claimed=False  # Will be claimable after referee's first order
    )
    db.add(referrer_reward)

    db.commit()

    return ApplyReferralResponse(
        success=True,
        message=f"Code de parrainage applique! Utilisez le code {discount_code} pour obtenir 10% de reduction sur votre premiere commande.",
        discountCode=discount_code,
        discountValue=REFERRAL_CONFIG["REFEREE_REWARD_VALUE"]
    )


@router.post("/complete/{order_id}", include_in_schema=False)
async def complete_referral_on_order(
    order_id: int,
    db: Session = Depends(get_db)
):
    """
    Internal endpoint to complete a referral when an order is placed.
    Called by the order system.
    """
    # Get the order
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return {"success": False, "message": "Order not found"}

    # Check minimum order amount
    if order.total_amount < REFERRAL_CONFIG["MIN_ORDER_AMOUNT"]:
        return {"success": False, "message": "Order amount below minimum"}

    # Find pending referral for this user
    referral = db.query(Referral).filter(
        Referral.referee_id == order.user_id,
        Referral.status == ReferralStatus.PENDING
    ).first()

    if not referral:
        return {"success": False, "message": "No pending referral found"}

    # Update referral status
    referral.status = ReferralStatus.COMPLETED
    referral.order_id = order_id
    referral.completed_at = datetime.utcnow()

    # Make referrer's reward claimable
    referrer_reward = db.query(ReferralReward).filter(
        ReferralReward.referral_id == referral.id,
        ReferralReward.user_id == referral.referrer_id,
        ReferralReward.is_claimed == False
    ).first()

    # Auto-claim loyalty points for referrer if enabled
    if referrer_reward and referrer_reward.reward_type == RewardType.LOYALTY_POINTS:
        points = award_referrer_points(db, referral.referrer_id, referral.id)
        if points:
            referrer_reward.is_claimed = True
            referrer_reward.claimed_at = datetime.utcnow()
            referral.status = ReferralStatus.REWARDED

    db.commit()

    return {
        "success": True,
        "message": "Referral completed successfully",
        "referralId": referral.id
    }


@router.get("/validate/{code}")
async def validate_referral_code(
    code: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Validate a referral code without applying it.
    Can be used during signup to check if code is valid.
    """
    code = code.upper().strip()

    referral_code = db.query(ReferralCode).filter(
        ReferralCode.code == code,
        ReferralCode.is_active == True
    ).first()

    if not referral_code:
        return {
            "valid": False,
            "message": "Code de parrainage invalide"
        }

    # Cannot use own code
    if current_user and referral_code.user_id == current_user.id:
        return {
            "valid": False,
            "message": "Vous ne pouvez pas utiliser votre propre code"
        }

    # Check if user already referred
    if current_user:
        existing = db.query(Referral).filter(
            Referral.referee_id == current_user.id
        ).first()
        if existing:
            return {
                "valid": False,
                "message": "Vous avez deja utilise un code de parrainage"
            }

    # Get referrer name (first letter only for privacy)
    referrer = db.query(User).filter(User.id == referral_code.user_id).first()
    referrer_name = referrer.first_name[0] + "***" if referrer and referrer.first_name else "Un ami"

    return {
        "valid": True,
        "message": f"Code valide! {referrer_name} vous parraine.",
        "benefit": f"{int(REFERRAL_CONFIG['REFEREE_REWARD_VALUE'])}% de reduction sur votre premiere commande"
    }
