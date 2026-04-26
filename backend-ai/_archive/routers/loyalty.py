"""
Loyalty Points System Router
Comprehensive API for loyalty program management
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
import secrets
import string

from app.core.database import get_db
from app.routers.auth import get_current_user, get_current_user_optional, get_current_admin
from app.models.user import User, UserRole
from app.models.order import Order, OrderStatus
from app.models.loyalty import (
    LoyaltyAccount, PointsTransaction, PointsRedemption,
    LoyaltyTier, TransactionType, POINTS_CONFIG
)

# ========================
# Routers
# ========================

router = APIRouter(prefix="/api/loyalty", tags=["Loyalty Program"])
admin_router = APIRouter(prefix="/api/admin/loyalty", tags=["Admin Loyalty"])


# ========================
# Schemas
# ========================

class LoyaltyAccountResponse(BaseModel):
    """Response schema for loyalty account"""
    id: int
    userId: int
    availablePoints: int
    pendingPoints: int
    totalPointsEarned: int
    totalPointsRedeemed: int
    totalDiscountValue: float
    currentTier: str
    tierName: str
    tierColor: str
    pointsMultiplier: float
    freeShippingThreshold: float
    ordersCount: int
    referralCode: Optional[str]
    referralCount: int
    tierProgress: dict


class TierInfoResponse(BaseModel):
    """Response schema for tier information"""
    tier: str
    name: str
    minimumPoints: int
    pointsMultiplier: float
    freeShippingThreshold: float
    color: str
    icon: str


class TransactionResponse(BaseModel):
    """Response schema for points transaction"""
    id: int
    points: int
    transactionType: str
    description: str
    orderReference: Optional[str]
    balanceAfter: int
    expiresAt: Optional[str]
    expired: bool
    createdAt: str


class TransactionHistoryResponse(BaseModel):
    """Response schema for transaction history with pagination"""
    items: List[TransactionResponse]
    total: int
    page: int
    pages: int
    hasMore: bool


class RedeemPointsRequest(BaseModel):
    """Request schema for redeeming points"""
    points: int = Field(..., ge=100, description="Points to redeem (minimum 100)")
    order_id: Optional[int] = Field(None, description="Order ID to apply discount to")


class RedeemPointsResponse(BaseModel):
    """Response schema for points redemption"""
    success: bool
    pointsRedeemed: int
    discountValue: float
    remainingPoints: int
    redemptionId: int
    message: str


class EarnPointsRequest(BaseModel):
    """Request schema for awarding purchase points (internal)"""
    user_id: int
    order_id: int
    order_amount: float
    order_reference: str


class BonusPointsRequest(BaseModel):
    """Request schema for awarding bonus points"""
    user_id: int
    bonus_type: str = Field(..., description="Type: review, referral, birthday, welcome, custom")
    points: Optional[int] = Field(None, description="Custom points amount (for custom type)")
    description: Optional[str] = Field(None, description="Custom description")
    order_id: Optional[int] = None


class AdminAdjustPointsRequest(BaseModel):
    """Request schema for admin point adjustment"""
    points: int = Field(..., description="Points to add (positive) or remove (negative)")
    reason: str = Field(..., min_length=10, description="Reason for adjustment")


class AdminAccountsFilterRequest(BaseModel):
    """Filter parameters for admin accounts list"""
    tier: Optional[str] = None
    min_points: Optional[int] = None
    max_points: Optional[int] = None
    search: Optional[str] = None
    sort_by: str = "created_at"
    sort_order: str = "desc"


# ========================
# Helper Functions
# ========================

def get_or_create_loyalty_account(db: Session, user: User) -> LoyaltyAccount:
    """Get existing or create new loyalty account for user"""
    account = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user.id).first()

    if not account:
        # Generate unique referral code
        referral_code = generate_referral_code()
        while db.query(LoyaltyAccount).filter(LoyaltyAccount.referral_code == referral_code).first():
            referral_code = generate_referral_code()

        account = LoyaltyAccount(
            user_id=user.id,
            referral_code=referral_code,
            current_tier=LoyaltyTier.BRONZE,
            total_points_earned=0,
            available_points=0,
            pending_points=0
        )
        db.add(account)
        db.commit()
        db.refresh(account)

        # Award welcome bonus
        award_bonus_points(
            db=db,
            account=account,
            transaction_type=TransactionType.WELCOME_BONUS,
            points=POINTS_CONFIG["WELCOME_BONUS"],
            description="Bienvenue dans le programme de fidelite Barsha!"
        )

    return account


def generate_referral_code() -> str:
    """Generate a unique referral code"""
    chars = string.ascii_uppercase + string.digits
    return "BARSHA" + ''.join(secrets.choice(chars) for _ in range(6))


def award_bonus_points(
    db: Session,
    account: LoyaltyAccount,
    transaction_type: TransactionType,
    points: int,
    description: str,
    order_id: Optional[int] = None,
    order_reference: Optional[str] = None
) -> PointsTransaction:
    """Award bonus points to a loyalty account"""
    # Update account
    account.total_points_earned += points
    account.available_points += points

    # Check tier upgrade
    account.update_tier()

    # Create transaction
    transaction = PointsTransaction(
        loyalty_account_id=account.id,
        user_id=account.user_id,
        points=points,
        transaction_type=transaction_type,
        order_id=order_id,
        order_reference=order_reference,
        description=description,
        balance_after=account.available_points,
        expires_at=PointsTransaction.calculate_expiry_date()
    )
    db.add(transaction)

    account.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(transaction)

    return transaction


def process_expired_points(db: Session, account: LoyaltyAccount) -> int:
    """Process and expire old points. Returns number of points expired."""
    now = datetime.utcnow()

    # Find unexpired transactions that have passed their expiry date
    expired_transactions = db.query(PointsTransaction).filter(
        PointsTransaction.loyalty_account_id == account.id,
        PointsTransaction.points > 0,
        PointsTransaction.expired == False,
        PointsTransaction.expires_at <= now,
        PointsTransaction.transaction_type.in_([
            TransactionType.PURCHASE_EARN,
            TransactionType.REVIEW_BONUS,
            TransactionType.REFERRAL_BONUS,
            TransactionType.BIRTHDAY_BONUS,
            TransactionType.WELCOME_BONUS,
            TransactionType.ADJUSTMENT
        ])
    ).all()

    total_expired = 0
    for txn in expired_transactions:
        txn.expired = True
        # Only expire points that haven't been spent
        points_to_expire = min(txn.points, account.available_points)
        if points_to_expire > 0:
            total_expired += points_to_expire

    if total_expired > 0:
        account.available_points -= total_expired

        # Create expiry transaction
        expiry_txn = PointsTransaction(
            loyalty_account_id=account.id,
            user_id=account.user_id,
            points=-total_expired,
            transaction_type=TransactionType.EXPIRY,
            description=f"{total_expired} points ont expire",
            balance_after=account.available_points,
            expires_at=None
        )
        db.add(expiry_txn)
        db.commit()

    return total_expired


# ========================
# Public User Endpoints
# ========================

@router.get("/account", response_model=LoyaltyAccountResponse)
async def get_loyalty_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the current user's loyalty account information.
    Creates account if it doesn't exist.
    """
    account = get_or_create_loyalty_account(db, current_user)

    # Process any expired points
    process_expired_points(db, account)

    return account.to_dict(include_progress=True)


@router.get("/history", response_model=TransactionHistoryResponse)
async def get_points_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    transaction_type: Optional[str] = Query(None, description="Filter by transaction type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get points transaction history for the current user.
    Supports pagination and filtering by transaction type.
    """
    account = get_or_create_loyalty_account(db, current_user)

    # Build query
    query = db.query(PointsTransaction).filter(
        PointsTransaction.loyalty_account_id == account.id
    )

    # Filter by type if specified
    if transaction_type:
        try:
            txn_type = TransactionType(transaction_type)
            query = query.filter(PointsTransaction.transaction_type == txn_type)
        except ValueError:
            pass  # Invalid type, ignore filter

    # Get total count
    total = query.count()
    pages = (total + per_page - 1) // per_page

    # Get paginated results
    transactions = query.order_by(
        PointsTransaction.created_at.desc()
    ).offset((page - 1) * per_page).limit(per_page).all()

    return TransactionHistoryResponse(
        items=[
            TransactionResponse(
                id=txn.id,
                points=txn.points,
                transactionType=txn.transaction_type.value,
                description=txn.description,
                orderReference=txn.order_reference,
                balanceAfter=txn.balance_after,
                expiresAt=txn.expires_at.isoformat() if txn.expires_at else None,
                expired=txn.expired,
                createdAt=txn.created_at.isoformat()
            )
            for txn in transactions
        ],
        total=total,
        page=page,
        pages=pages,
        hasMore=page < pages
    )


@router.post("/redeem", response_model=RedeemPointsResponse)
async def redeem_points(
    request: RedeemPointsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Redeem loyalty points for a discount.
    100 points = 1 TND discount.
    """
    account = get_or_create_loyalty_account(db, current_user)

    # Process any expired points first
    process_expired_points(db, account)

    # Validate points amount
    if request.points < POINTS_CONFIG["MIN_REDEMPTION_POINTS"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum {POINTS_CONFIG['MIN_REDEMPTION_POINTS']} points required for redemption"
        )

    if request.points > account.available_points:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient points. Available: {account.available_points}"
        )

    # Calculate discount value
    discount_value = PointsRedemption.calculate_discount_value(request.points)

    # If order_id provided, validate order
    order_reference = None
    if request.order_id:
        order = db.query(Order).filter(
            Order.id == request.order_id,
            Order.user_id == current_user.id
        ).first()

        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )

        # Check max discount percentage
        max_discount = order.subtotal * (POINTS_CONFIG["MAX_DISCOUNT_PERCENTAGE"] / 100)
        if discount_value > max_discount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum discount is {POINTS_CONFIG['MAX_DISCOUNT_PERCENTAGE']}% of order ({max_discount:.2f} TND)"
            )

        order_reference = order.reference

    # Deduct points
    account.available_points -= request.points
    account.total_points_redeemed += request.points
    account.total_discount_value += discount_value

    # Create redemption transaction
    transaction = PointsTransaction(
        loyalty_account_id=account.id,
        user_id=account.user_id,
        points=-request.points,
        transaction_type=TransactionType.REDEMPTION,
        order_id=request.order_id,
        order_reference=order_reference,
        description=f"Remise de {discount_value:.2f} TND appliquee",
        balance_after=account.available_points,
        expires_at=None
    )
    db.add(transaction)

    # Create redemption record
    redemption = PointsRedemption(
        loyalty_account_id=account.id,
        user_id=account.user_id,
        points_redeemed=request.points,
        discount_value=discount_value,
        order_id=request.order_id,
        order_reference=order_reference,
        is_applied=request.order_id is not None,
        applied_at=datetime.utcnow() if request.order_id else None,
        transaction_id=transaction.id
    )
    db.add(redemption)

    account.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(redemption)

    return RedeemPointsResponse(
        success=True,
        pointsRedeemed=request.points,
        discountValue=discount_value,
        remainingPoints=account.available_points,
        redemptionId=redemption.id,
        message=f"Felicitations! Vous avez obtenu {discount_value:.2f} TND de reduction."
    )


@router.get("/tiers", response_model=List[TierInfoResponse])
async def get_all_tiers(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get information about all loyalty tiers.
    Available to both authenticated and guest users.
    """
    tiers = []
    for tier in LoyaltyTier:
        config = LoyaltyTier.get_tier_config(tier)
        tiers.append(TierInfoResponse(
            tier=tier.value,
            name=config["name"],
            minimumPoints=config["minimum_points"],
            pointsMultiplier=config["points_multiplier"],
            freeShippingThreshold=config["free_shipping_threshold"],
            color=config["color"],
            icon=config["icon"]
        ))
    return tiers


@router.get("/expiring-points")
async def get_expiring_points(
    days: int = Query(30, ge=1, le=90, description="Days to check for expiring points"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get points that will expire within the specified number of days.
    """
    account = get_or_create_loyalty_account(db, current_user)

    cutoff_date = datetime.utcnow() + timedelta(days=days)

    expiring = db.query(
        func.sum(PointsTransaction.points).label("total_expiring")
    ).filter(
        PointsTransaction.loyalty_account_id == account.id,
        PointsTransaction.points > 0,
        PointsTransaction.expired == False,
        PointsTransaction.expires_at <= cutoff_date,
        PointsTransaction.expires_at > datetime.utcnow()
    ).scalar() or 0

    return {
        "expiringPoints": expiring,
        "withinDays": days,
        "availablePoints": account.available_points,
        "message": f"{expiring} points expireront dans les {days} prochains jours" if expiring > 0 else "Aucun point proche de l'expiration"
    }


@router.post("/referral/{referral_code}")
async def apply_referral_code(
    referral_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Apply a referral code to get bonus points.
    Both referrer and referee get bonus points.
    """
    # Get current user's account
    user_account = get_or_create_loyalty_account(db, current_user)

    # Check if user already has a referrer
    if user_account.referred_by:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous avez deja utilise un code de parrainage"
        )

    # Check if trying to use own code
    if user_account.referral_code == referral_code.upper():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas utiliser votre propre code"
        )

    # Find referrer account
    referrer_account = db.query(LoyaltyAccount).filter(
        LoyaltyAccount.referral_code == referral_code.upper()
    ).first()

    if not referrer_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Code de parrainage invalide"
        )

    # Award points to referee (current user)
    award_bonus_points(
        db=db,
        account=user_account,
        transaction_type=TransactionType.REFERRAL_BONUS,
        points=POINTS_CONFIG["REFERRAL_BONUS"],
        description=f"Bonus de parrainage - bienvenue chez Barsha!"
    )

    # Award points to referrer
    award_bonus_points(
        db=db,
        account=referrer_account,
        transaction_type=TransactionType.REFERRAL_BONUS,
        points=POINTS_CONFIG["REFERRAL_BONUS"],
        description=f"Bonus de parrainage - merci pour la recommandation!"
    )

    # Update referral tracking
    user_account.referred_by = referrer_account.user_id
    referrer_account.referral_count += 1

    db.commit()

    return {
        "success": True,
        "pointsEarned": POINTS_CONFIG["REFERRAL_BONUS"],
        "message": f"Felicitations! Vous avez gagne {POINTS_CONFIG['REFERRAL_BONUS']} points de parrainage!"
    }


# ========================
# Internal Endpoints (for order system integration)
# ========================

@router.post("/earn", include_in_schema=False)
async def earn_points_for_purchase(
    request: EarnPointsRequest,
    db: Session = Depends(get_db)
):
    """
    Award points for a purchase (called internally by order system).
    Points are calculated based on order amount and user's tier multiplier.
    """
    # Get user
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get or create loyalty account
    account = get_or_create_loyalty_account(db, user)

    # Calculate points with tier multiplier
    tier_config = account.get_tier_config()
    base_points = int(request.order_amount * POINTS_CONFIG["POINTS_PER_TND"])
    multiplied_points = int(base_points * tier_config["points_multiplier"])

    # Award points
    transaction = award_bonus_points(
        db=db,
        account=account,
        transaction_type=TransactionType.PURCHASE_EARN,
        points=multiplied_points,
        description=f"Points gagnes pour la commande {request.order_reference}",
        order_id=request.order_id,
        order_reference=request.order_reference
    )

    # Update orders count
    account.orders_count += 1
    db.commit()

    return {
        "success": True,
        "pointsEarned": multiplied_points,
        "basePoints": base_points,
        "multiplier": tier_config["points_multiplier"],
        "newBalance": account.available_points,
        "transactionId": transaction.id
    }


@router.post("/bonus", include_in_schema=False)
async def award_bonus(
    request: BonusPointsRequest,
    db: Session = Depends(get_db)
):
    """
    Award bonus points (called internally for reviews, referrals, birthdays, etc.).
    """
    # Get user
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get or create loyalty account
    account = get_or_create_loyalty_account(db, user)

    # Determine bonus type and points
    bonus_type = request.bonus_type.lower()

    if bonus_type == "review":
        points = POINTS_CONFIG["REVIEW_BONUS"]
        transaction_type = TransactionType.REVIEW_BONUS
        description = "Bonus pour votre avis produit - merci pour votre retour!"
    elif bonus_type == "referral":
        points = POINTS_CONFIG["REFERRAL_BONUS"]
        transaction_type = TransactionType.REFERRAL_BONUS
        description = "Bonus de parrainage"
    elif bonus_type == "birthday":
        # Check if birthday bonus already awarded this year
        current_year = datetime.utcnow().year
        if account.last_birthday_bonus_year == current_year:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Birthday bonus already awarded this year"
            )
        points = POINTS_CONFIG["BIRTHDAY_BONUS"]
        transaction_type = TransactionType.BIRTHDAY_BONUS
        description = "Joyeux anniversaire! Voici votre cadeau Barsha!"
        account.last_birthday_bonus_year = current_year
    elif bonus_type == "welcome":
        points = POINTS_CONFIG["WELCOME_BONUS"]
        transaction_type = TransactionType.WELCOME_BONUS
        description = "Bienvenue dans le programme de fidelite Barsha!"
    elif bonus_type == "custom" and request.points:
        points = request.points
        transaction_type = TransactionType.ADJUSTMENT
        description = request.description or "Bonus points"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid bonus type"
        )

    # Award points
    transaction = award_bonus_points(
        db=db,
        account=account,
        transaction_type=transaction_type,
        points=points,
        description=description,
        order_id=request.order_id
    )

    return {
        "success": True,
        "pointsAwarded": points,
        "bonusType": bonus_type,
        "newBalance": account.available_points,
        "transactionId": transaction.id
    }


# ========================
# Admin Endpoints
# ========================

@admin_router.get("/accounts")
async def list_loyalty_accounts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    tier: Optional[str] = Query(None),
    min_points: Optional[int] = Query(None, ge=0),
    max_points: Optional[int] = Query(None, ge=0),
    search: Optional[str] = Query(None),
    sort_by: str = Query("created_at", enum=["created_at", "total_points_earned", "available_points", "orders_count"]),
    sort_order: str = Query("desc", enum=["asc", "desc"]),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    List all loyalty accounts with filtering and pagination.
    Admin only.
    """
    query = db.query(LoyaltyAccount).join(User)

    # Apply filters
    if tier:
        try:
            tier_enum = LoyaltyTier(tier.lower())
            query = query.filter(LoyaltyAccount.current_tier == tier_enum)
        except ValueError:
            pass

    if min_points is not None:
        query = query.filter(LoyaltyAccount.total_points_earned >= min_points)

    if max_points is not None:
        query = query.filter(LoyaltyAccount.total_points_earned <= max_points)

    if search:
        search_filter = or_(
            User.email.ilike(f"%{search}%"),
            User.first_name.ilike(f"%{search}%"),
            User.last_name.ilike(f"%{search}%"),
            LoyaltyAccount.referral_code.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)

    # Get total count
    total = query.count()
    pages = (total + per_page - 1) // per_page

    # Apply sorting
    sort_column = getattr(LoyaltyAccount, sort_by, LoyaltyAccount.created_at)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Paginate
    accounts = query.offset((page - 1) * per_page).limit(per_page).all()

    return {
        "items": [
            {
                **account.to_dict(include_progress=False),
                "user": {
                    "id": account.user.id,
                    "email": account.user.email,
                    "firstName": account.user.first_name,
                    "lastName": account.user.last_name,
                    "fullName": account.user.full_name
                }
            }
            for account in accounts
        ],
        "total": total,
        "page": page,
        "pages": pages,
        "hasMore": page < pages
    }


@admin_router.get("/accounts/{user_id}")
async def get_user_loyalty_details(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Get detailed loyalty information for a specific user.
    Admin only.
    """
    account = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user_id).first()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loyalty account not found for this user"
        )

    # Get user info
    user = db.query(User).filter(User.id == user_id).first()

    # Get recent transactions
    recent_transactions = db.query(PointsTransaction).filter(
        PointsTransaction.loyalty_account_id == account.id
    ).order_by(PointsTransaction.created_at.desc()).limit(20).all()

    # Get redemptions
    redemptions = db.query(PointsRedemption).filter(
        PointsRedemption.loyalty_account_id == account.id
    ).order_by(PointsRedemption.created_at.desc()).limit(10).all()

    # Calculate statistics
    stats = {
        "totalEarned": account.total_points_earned,
        "totalRedeemed": account.total_points_redeemed,
        "totalExpired": db.query(func.sum(PointsTransaction.points)).filter(
            PointsTransaction.loyalty_account_id == account.id,
            PointsTransaction.transaction_type == TransactionType.EXPIRY
        ).scalar() or 0,
        "totalSaved": account.total_discount_value,
        "averageOrderValue": 0
    }

    # Calculate average order value if orders exist
    if account.orders_count > 0:
        total_order_value = db.query(func.sum(Order.total_amount)).filter(
            Order.user_id == user_id,
            Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED])
        ).scalar() or 0
        stats["averageOrderValue"] = round(total_order_value / account.orders_count, 2)

    return {
        "account": account.to_dict(include_progress=True),
        "user": {
            "id": user.id,
            "email": user.email,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "fullName": user.full_name,
            "phone": user.phone,
            "createdAt": user.created_at.isoformat() if user.created_at else None
        },
        "recentTransactions": [txn.to_dict() for txn in recent_transactions],
        "redemptions": [r.to_dict() for r in redemptions],
        "statistics": stats
    }


@admin_router.post("/accounts/{user_id}/adjust")
async def adjust_user_points(
    user_id: int,
    request: AdminAdjustPointsRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Manually adjust points for a user account.
    Can add or remove points with a reason.
    Admin only.
    """
    account = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user_id).first()

    if not account:
        # Create account if it doesn't exist
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        account = get_or_create_loyalty_account(db, user)

    # Validate removal doesn't exceed available points
    if request.points < 0 and abs(request.points) > account.available_points:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot remove more points than available ({account.available_points})"
        )

    # Update account
    old_balance = account.available_points
    account.available_points += request.points

    if request.points > 0:
        account.total_points_earned += request.points
        description = f"Ajustement: +{request.points} points"
    else:
        description = f"Ajustement: {request.points} points"

    # Check tier update
    tier_changed = account.update_tier()

    # Create transaction
    transaction = PointsTransaction(
        loyalty_account_id=account.id,
        user_id=account.user_id,
        points=request.points,
        transaction_type=TransactionType.ADJUSTMENT,
        description=description,
        admin_notes=request.reason,
        adjusted_by=admin.id,
        balance_after=account.available_points,
        expires_at=PointsTransaction.calculate_expiry_date() if request.points > 0 else None
    )
    db.add(transaction)

    account.updated_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "previousBalance": old_balance,
        "adjustment": request.points,
        "newBalance": account.available_points,
        "tierChanged": tier_changed,
        "currentTier": account.current_tier.value,
        "reason": request.reason,
        "adjustedBy": admin.full_name,
        "transactionId": transaction.id
    }


@admin_router.get("/stats")
async def get_loyalty_statistics(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Get overall loyalty program statistics.
    Admin only.
    """
    # Total accounts by tier
    tier_stats = {}
    for tier in LoyaltyTier:
        count = db.query(LoyaltyAccount).filter(
            LoyaltyAccount.current_tier == tier,
            LoyaltyAccount.is_active == True
        ).count()
        tier_stats[tier.value] = count

    # Points statistics
    total_points_in_circulation = db.query(
        func.sum(LoyaltyAccount.available_points)
    ).filter(LoyaltyAccount.is_active == True).scalar() or 0

    total_points_earned_all_time = db.query(
        func.sum(LoyaltyAccount.total_points_earned)
    ).filter(LoyaltyAccount.is_active == True).scalar() or 0

    total_points_redeemed = db.query(
        func.sum(LoyaltyAccount.total_points_redeemed)
    ).filter(LoyaltyAccount.is_active == True).scalar() or 0

    total_discount_given = db.query(
        func.sum(LoyaltyAccount.total_discount_value)
    ).filter(LoyaltyAccount.is_active == True).scalar() or 0

    # Recent activity (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    recent_points_earned = db.query(
        func.sum(PointsTransaction.points)
    ).filter(
        PointsTransaction.points > 0,
        PointsTransaction.created_at >= thirty_days_ago
    ).scalar() or 0

    recent_points_redeemed = db.query(
        func.sum(PointsRedemption.points_redeemed)
    ).filter(
        PointsRedemption.created_at >= thirty_days_ago,
        PointsRedemption.is_reversed == False
    ).scalar() or 0

    new_members = db.query(LoyaltyAccount).filter(
        LoyaltyAccount.created_at >= thirty_days_ago
    ).count()

    # Top earners
    top_earners = db.query(LoyaltyAccount).join(User).filter(
        LoyaltyAccount.is_active == True
    ).order_by(LoyaltyAccount.total_points_earned.desc()).limit(5).all()

    return {
        "totalAccounts": sum(tier_stats.values()),
        "accountsByTier": tier_stats,
        "pointsInCirculation": total_points_in_circulation,
        "totalPointsEarnedAllTime": total_points_earned_all_time,
        "totalPointsRedeemed": total_points_redeemed,
        "totalDiscountGiven": round(total_discount_given, 2),
        "potentialLiability": round(total_points_in_circulation / 100, 2),  # TND value
        "last30Days": {
            "pointsEarned": recent_points_earned,
            "pointsRedeemed": recent_points_redeemed,
            "newMembers": new_members
        },
        "topEarners": [
            {
                "userId": account.user_id,
                "userName": account.user.full_name,
                "email": account.user.email,
                "totalPointsEarned": account.total_points_earned,
                "currentTier": account.current_tier.value
            }
            for account in top_earners
        ],
        "config": POINTS_CONFIG
    }


@admin_router.post("/expire-old-points")
async def manually_expire_old_points(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Manually trigger expiration of old points across all accounts.
    Normally this would be run by a scheduled job.
    Admin only.
    """
    accounts = db.query(LoyaltyAccount).filter(
        LoyaltyAccount.is_active == True,
        LoyaltyAccount.available_points > 0
    ).all()

    total_expired = 0
    accounts_affected = 0

    for account in accounts:
        expired = process_expired_points(db, account)
        if expired > 0:
            total_expired += expired
            accounts_affected += 1

    return {
        "success": True,
        "totalPointsExpired": total_expired,
        "accountsAffected": accounts_affected,
        "processedAt": datetime.utcnow().isoformat()
    }
