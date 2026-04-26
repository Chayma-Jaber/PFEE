"""
Gift Cards Router
Gift card purchase, redemption, and management
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

from app.core.database import get_db
from app.core.security import require_admin, require_marketing_manager, get_optional_current_user
from app.routers.auth import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.gift_card import (
    GiftCard, GiftCardTransaction, GiftCardStatus, GiftCardTransactionType,
    UserStoreCredit, StoreCreditTransaction, generate_gift_card_code
)
from app.models.admin_log import log_admin_activity

# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

# Available denominations in TND
VALID_DENOMINATIONS = [25, 50, 100, 200, 500]


class GiftCardPurchaseRequest(BaseModel):
    """Request schema for purchasing a gift card"""
    amount: float = Field(..., description="Amount in TND (25, 50, 100, 200, or 500)")
    recipient_email: Optional[EmailStr] = Field(None, description="Recipient's email address")
    recipient_name: Optional[str] = Field(None, max_length=200, description="Recipient's name")
    message: Optional[str] = Field(None, max_length=500, description="Personal message")


class GiftCardRedeemRequest(BaseModel):
    """Request schema for redeeming a gift card to store credit"""
    code: str = Field(..., min_length=16, max_length=20, description="Gift card code")


class GiftCardApplyRequest(BaseModel):
    """Request schema for applying a gift card to an order"""
    code: str = Field(..., min_length=16, max_length=20, description="Gift card code")
    order_id: int = Field(..., description="Order ID to apply the gift card to")
    amount: Optional[float] = Field(None, description="Amount to apply (defaults to order total or card balance)")


class AdminGiftCardCreateRequest(BaseModel):
    """Request schema for admin creating a gift card"""
    amount: float = Field(..., gt=0, description="Initial value in TND")
    recipient_email: Optional[EmailStr] = None
    recipient_name: Optional[str] = None
    message: Optional[str] = None
    expires_in_days: Optional[int] = Field(365, ge=1, le=730, description="Days until expiration")
    is_promotional: bool = Field(False, description="Mark as promotional card")
    admin_notes: Optional[str] = None


class AdminGiftCardUpdateRequest(BaseModel):
    """Request schema for admin updating a gift card"""
    status: Optional[str] = None
    expires_at: Optional[datetime] = None
    admin_notes: Optional[str] = None


class AdminGiftCardAdjustRequest(BaseModel):
    """Request schema for admin adjusting gift card balance"""
    amount: float = Field(..., description="Amount to adjust (positive or negative)")
    reason: str = Field(..., min_length=5, max_length=500, description="Reason for adjustment")


# ═══════════════════════════════════════════════════════════════════════════════
# USER ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

router = APIRouter(prefix="/gift-cards", tags=["Gift Cards"])


@router.get("/check/{code}")
async def check_gift_card_balance(
    code: str,
    db: Session = Depends(get_db)
):
    """
    Check gift card balance (public endpoint).
    Returns basic info without revealing purchaser details.
    """
    # Clean up the code (remove spaces, uppercase)
    clean_code = code.upper().replace(" ", "")

    gift_card = db.query(GiftCard).filter(GiftCard.code == clean_code).first()

    if not gift_card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carte cadeau introuvable"
        )

    # Check and update expired status
    if gift_card.is_expired and gift_card.status == GiftCardStatus.ACTIVE:
        gift_card.status = GiftCardStatus.EXPIRED
        db.commit()

    return gift_card.to_public_dict()


@router.post("/purchase")
async def purchase_gift_card(
    request: GiftCardPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Purchase a new gift card.
    Available denominations: 25, 50, 100, 200, 500 TND
    """
    # Validate denomination
    if request.amount not in VALID_DENOMINATIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Montant invalide. Valeurs disponibles: {', '.join(map(str, VALID_DENOMINATIONS))} TND"
        )

    # Generate unique code
    code = generate_gift_card_code()
    while db.query(GiftCard).filter(GiftCard.code == code).first():
        code = generate_gift_card_code()

    # Create gift card
    gift_card = GiftCard(
        code=code,
        initial_value=request.amount,
        current_balance=request.amount,
        purchaser_id=current_user.id,
        recipient_email=request.recipient_email,
        recipient_name=request.recipient_name,
        personal_message=request.message,
        status=GiftCardStatus.ACTIVE,
        purchased_at=datetime.utcnow(),
        expires_at=GiftCard.get_default_expiry(),
        is_promotional=False
    )

    db.add(gift_card)
    db.flush()

    # Create purchase transaction
    transaction = GiftCardTransaction(
        gift_card_id=gift_card.id,
        amount=request.amount,
        transaction_type=GiftCardTransactionType.PURCHASE,
        balance_after=request.amount,
        user_id=current_user.id,
        description=f"Achat de carte cadeau de {request.amount} TND"
    )
    db.add(transaction)

    db.commit()
    db.refresh(gift_card)

    return {
        "message": "Carte cadeau achetee avec succes",
        "giftCard": gift_card.to_dict()
    }


@router.get("/my-cards")
async def get_my_gift_cards(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all gift cards purchased by the current user"""
    query = db.query(GiftCard).filter(GiftCard.purchaser_id == current_user.id)

    total = query.count()

    gift_cards = query.order_by(GiftCard.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    # Update expired cards
    for card in gift_cards:
        if card.is_expired and card.status == GiftCardStatus.ACTIVE:
            card.status = GiftCardStatus.EXPIRED

    db.commit()

    return {
        "items": [card.to_dict() for card in gift_cards],
        "total": total,
        "page": page,
        "perPage": per_page,
        "pages": (total + per_page - 1) // per_page if total > 0 else 0
    }


@router.post("/redeem")
async def redeem_gift_card(
    request: GiftCardRedeemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Redeem a gift card to store credit.
    The entire balance is transferred to the user's store credit.
    """
    clean_code = request.code.upper().replace(" ", "")

    gift_card = db.query(GiftCard).filter(GiftCard.code == clean_code).first()

    if not gift_card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carte cadeau introuvable"
        )

    if not gift_card.is_valid:
        if gift_card.is_expired:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cette carte cadeau a expire"
            )
        if gift_card.status == GiftCardStatus.REDEEMED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cette carte cadeau a deja ete utilisee"
            )
        if gift_card.status == GiftCardStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cette carte cadeau a ete annulee"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette carte cadeau n'est pas valide"
        )

    # Get or create user's store credit
    store_credit = db.query(UserStoreCredit).filter(
        UserStoreCredit.user_id == current_user.id
    ).first()

    if not store_credit:
        store_credit = UserStoreCredit(user_id=current_user.id, balance=0, total_redeemed=0)
        db.add(store_credit)
        db.flush()

    # Transfer balance
    amount_to_transfer = gift_card.current_balance
    old_store_balance = store_credit.balance

    store_credit.add_credit(amount_to_transfer)

    # Redeem entire card
    gift_card.current_balance = 0
    gift_card.status = GiftCardStatus.REDEEMED
    if not gift_card.activated_at:
        gift_card.activated_at = datetime.utcnow()

    # Create gift card transaction
    gc_transaction = GiftCardTransaction(
        gift_card_id=gift_card.id,
        amount=-amount_to_transfer,
        transaction_type=GiftCardTransactionType.REDEMPTION,
        balance_after=0,
        user_id=current_user.id,
        description=f"Echange contre credit boutique"
    )
    db.add(gc_transaction)

    # Create store credit transaction
    sc_transaction = StoreCreditTransaction(
        store_credit_id=store_credit.id,
        amount=amount_to_transfer,
        balance_after=store_credit.balance,
        transaction_type="gift_card_redemption",
        gift_card_id=gift_card.id,
        description=f"Credit de carte cadeau {gift_card.code}"
    )
    db.add(sc_transaction)

    db.commit()

    return {
        "message": f"Carte cadeau echangee avec succes! {amount_to_transfer} TND ajoutes a votre credit boutique.",
        "amountRedeemed": amount_to_transfer,
        "newStoreBalance": store_credit.balance
    }


@router.get("/my-balance")
async def get_my_store_credit_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's store credit balance"""
    store_credit = db.query(UserStoreCredit).filter(
        UserStoreCredit.user_id == current_user.id
    ).first()

    if not store_credit:
        return {
            "balance": 0,
            "totalRedeemed": 0,
            "transactions": []
        }

    # Get recent transactions
    transactions = db.query(StoreCreditTransaction).filter(
        StoreCreditTransaction.store_credit_id == store_credit.id
    ).order_by(StoreCreditTransaction.created_at.desc()).limit(10).all()

    return {
        "balance": store_credit.balance,
        "totalRedeemed": store_credit.total_redeemed,
        "transactions": [t.to_dict() for t in transactions]
    }


@router.post("/apply")
async def apply_gift_card_to_order(
    request: GiftCardApplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Apply a gift card directly to an order.
    The specified amount (or card balance if not specified) is deducted from the gift card.
    """
    from app.models.order import Order, PaymentStatus

    clean_code = request.code.upper().replace(" ", "")

    # Get gift card
    gift_card = db.query(GiftCard).filter(GiftCard.code == clean_code).first()

    if not gift_card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carte cadeau introuvable"
        )

    if not gift_card.is_valid:
        if gift_card.is_expired:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cette carte cadeau a expire")
        if gift_card.status == GiftCardStatus.REDEEMED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cette carte cadeau est epuisee")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cette carte cadeau n'est pas valide")

    # Get order
    order = db.query(Order).filter(Order.id == request.order_id).first()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commande introuvable")

    # Verify order belongs to user (or is a guest order with matching email)
    if order.user_id and order.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces non autorise a cette commande")

    # Calculate amount to apply
    remaining_order_total = order.total_amount - (order.discount_amount or 0)
    amount_to_apply = request.amount if request.amount else min(gift_card.current_balance, remaining_order_total)
    amount_to_apply = min(amount_to_apply, gift_card.current_balance, remaining_order_total)

    if amount_to_apply <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun montant a appliquer"
        )

    # Apply gift card
    actual_amount = gift_card.redeem(amount_to_apply)

    # Update order discount
    order.discount_amount = (order.discount_amount or 0) + actual_amount

    # If gift card covers entire order, mark as paid
    if order.discount_amount >= order.total_amount:
        order.payment_status = PaymentStatus.COMPLETED

    # Create gift card transaction
    transaction = GiftCardTransaction(
        gift_card_id=gift_card.id,
        amount=-actual_amount,
        transaction_type=GiftCardTransactionType.REDEMPTION,
        balance_after=gift_card.current_balance,
        order_id=order.id,
        user_id=current_user.id,
        description=f"Paiement commande #{order.reference}"
    )
    db.add(transaction)

    db.commit()

    return {
        "message": f"Carte cadeau appliquee avec succes! {actual_amount} TND deduits.",
        "amountApplied": actual_amount,
        "remainingCardBalance": gift_card.current_balance,
        "orderDiscountTotal": order.discount_amount,
        "orderRemainingTotal": order.total_amount - order.discount_amount
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

admin_router = APIRouter(prefix="/admin/gift-cards", tags=["Admin Gift Cards"])


@admin_router.get("")
async def list_gift_cards(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    is_promotional: Optional[bool] = None,
    min_balance: Optional[float] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    _: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """List all gift cards with filters and pagination"""
    query = db.query(GiftCard)

    # Search by code, recipient email, or recipient name
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                GiftCard.code.ilike(search_term),
                GiftCard.recipient_email.ilike(search_term),
                GiftCard.recipient_name.ilike(search_term)
            )
        )

    # Filter by status
    if status_filter:
        try:
            status_enum = GiftCardStatus(status_filter)
            query = query.filter(GiftCard.status == status_enum)
        except ValueError:
            pass

    # Filter by promotional
    if is_promotional is not None:
        query = query.filter(GiftCard.is_promotional == is_promotional)

    # Filter by minimum balance
    if min_balance is not None:
        query = query.filter(GiftCard.current_balance >= min_balance)

    # Filter by date range
    if date_from:
        query = query.filter(GiftCard.created_at >= date_from)
    if date_to:
        query = query.filter(GiftCard.created_at <= date_to)

    total = query.count()

    gift_cards = query.order_by(GiftCard.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return {
        "items": [card.to_dict() for card in gift_cards],
        "total": total,
        "page": page,
        "perPage": per_page,
        "pages": (total + per_page - 1) // per_page if total > 0 else 0
    }


@admin_router.post("")
async def create_gift_card(
    gift_card_data: AdminGiftCardCreateRequest,
    request: Request,
    payload: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Create a new gift card (for promotional purposes)"""
    # Generate unique code
    code = generate_gift_card_code()
    while db.query(GiftCard).filter(GiftCard.code == code).first():
        code = generate_gift_card_code()

    # Calculate expiry
    expires_at = datetime.utcnow() + timedelta(days=gift_card_data.expires_in_days or 365)

    gift_card = GiftCard(
        code=code,
        initial_value=gift_card_data.amount,
        current_balance=gift_card_data.amount,
        purchaser_id=None,  # Admin-created
        recipient_email=gift_card_data.recipient_email,
        recipient_name=gift_card_data.recipient_name,
        personal_message=gift_card_data.message,
        status=GiftCardStatus.ACTIVE,
        purchased_at=datetime.utcnow(),
        expires_at=expires_at,
        is_promotional=gift_card_data.is_promotional,
        created_by_admin=int(payload.get("sub")),
        admin_notes=gift_card_data.admin_notes
    )

    db.add(gift_card)
    db.flush()

    # Create initial transaction
    transaction = GiftCardTransaction(
        gift_card_id=gift_card.id,
        amount=gift_card_data.amount,
        transaction_type=GiftCardTransactionType.PURCHASE,
        balance_after=gift_card_data.amount,
        user_id=int(payload.get("sub")),
        description=f"Creation carte cadeau {'promotionnelle' if gift_card_data.is_promotional else 'admin'}"
    )
    db.add(transaction)

    db.commit()
    db.refresh(gift_card)

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="create_gift_card",
        resource_type="gift_card",
        resource_id=gift_card.id,
        resource_reference=gift_card.code,
        new_values={"amount": gift_card_data.amount, "promotional": gift_card_data.is_promotional},
        ip_address=request.client.host if request.client else None
    )

    return gift_card.to_dict()


@admin_router.get("/stats")
async def get_gift_card_stats(
    _: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Get gift card statistics"""
    # Total cards
    total_cards = db.query(GiftCard).count()

    # Active cards
    active_cards = db.query(GiftCard).filter(GiftCard.status == GiftCardStatus.ACTIVE).count()

    # Total sold value
    total_sold = db.query(func.sum(GiftCard.initial_value)).scalar() or 0

    # Outstanding balance (unredeemed)
    outstanding_balance = db.query(func.sum(GiftCard.current_balance)).filter(
        GiftCard.status == GiftCardStatus.ACTIVE
    ).scalar() or 0

    # Total redeemed value
    total_redeemed = db.query(func.sum(GiftCardTransaction.amount)).filter(
        GiftCardTransaction.transaction_type == GiftCardTransactionType.REDEMPTION
    ).scalar() or 0
    total_redeemed = abs(total_redeemed)

    # Promotional cards
    promotional_count = db.query(GiftCard).filter(GiftCard.is_promotional == True).count()
    promotional_value = db.query(func.sum(GiftCard.initial_value)).filter(
        GiftCard.is_promotional == True
    ).scalar() or 0

    # Cards by status
    status_breakdown = {}
    for status in GiftCardStatus:
        count = db.query(GiftCard).filter(GiftCard.status == status).count()
        status_breakdown[status.value] = count

    # Recent activity (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_purchases = db.query(GiftCard).filter(
        GiftCard.created_at >= thirty_days_ago
    ).count()
    recent_redemptions = db.query(GiftCardTransaction).filter(
        and_(
            GiftCardTransaction.created_at >= thirty_days_ago,
            GiftCardTransaction.transaction_type == GiftCardTransactionType.REDEMPTION
        )
    ).count()

    return {
        "totalCards": total_cards,
        "activeCards": active_cards,
        "totalSoldValue": total_sold,
        "outstandingBalance": outstanding_balance,
        "totalRedeemedValue": total_redeemed,
        "promotional": {
            "count": promotional_count,
            "value": promotional_value
        },
        "statusBreakdown": status_breakdown,
        "recentActivity": {
            "purchases": recent_purchases,
            "redemptions": recent_redemptions,
            "periodDays": 30
        }
    }


@admin_router.get("/{gift_card_id}")
async def get_gift_card_details(
    gift_card_id: int,
    _: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Get detailed gift card information with transaction history"""
    gift_card = db.query(GiftCard).filter(GiftCard.id == gift_card_id).first()

    if not gift_card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carte cadeau introuvable")

    data = gift_card.to_dict(include_transactions=True)

    # Add purchaser info if available
    if gift_card.purchaser_id:
        purchaser = db.query(User).filter(User.id == gift_card.purchaser_id).first()
        if purchaser:
            data["purchaser"] = {
                "id": purchaser.id,
                "email": purchaser.email,
                "name": purchaser.full_name
            }

    return data


@admin_router.put("/{gift_card_id}")
async def update_gift_card(
    gift_card_id: int,
    update_data: AdminGiftCardUpdateRequest,
    request: Request,
    payload: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Update gift card status or expiry"""
    gift_card = db.query(GiftCard).filter(GiftCard.id == gift_card_id).first()

    if not gift_card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carte cadeau introuvable")

    old_values = {}
    new_values = {}

    if update_data.status:
        try:
            new_status = GiftCardStatus(update_data.status)
            old_values["status"] = gift_card.status.value
            gift_card.status = new_status
            new_values["status"] = new_status.value
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Statut invalide")

    if update_data.expires_at:
        old_values["expires_at"] = gift_card.expires_at.isoformat() if gift_card.expires_at else None
        gift_card.expires_at = update_data.expires_at
        new_values["expires_at"] = update_data.expires_at.isoformat()

    if update_data.admin_notes is not None:
        gift_card.admin_notes = update_data.admin_notes
        new_values["admin_notes"] = "updated"

    db.commit()
    db.refresh(gift_card)

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="update_gift_card",
        resource_type="gift_card",
        resource_id=gift_card.id,
        resource_reference=gift_card.code,
        old_values=old_values,
        new_values=new_values,
        ip_address=request.client.host if request.client else None
    )

    return gift_card.to_dict()


@admin_router.post("/{gift_card_id}/adjust")
async def adjust_gift_card_balance(
    gift_card_id: int,
    adjustment: AdminGiftCardAdjustRequest,
    request: Request,
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Adjust gift card balance with reason (admin only)"""
    gift_card = db.query(GiftCard).filter(GiftCard.id == gift_card_id).first()

    if not gift_card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carte cadeau introuvable")

    old_balance = gift_card.current_balance
    new_balance = old_balance + adjustment.amount

    if new_balance < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le solde ne peut pas etre negatif. Solde actuel: {old_balance} TND"
        )

    gift_card.current_balance = new_balance

    # Update status based on new balance
    if new_balance > 0 and gift_card.status == GiftCardStatus.REDEEMED:
        gift_card.status = GiftCardStatus.ACTIVE
    elif new_balance == 0 and gift_card.status == GiftCardStatus.ACTIVE:
        gift_card.status = GiftCardStatus.REDEEMED

    # Create adjustment transaction
    transaction = GiftCardTransaction(
        gift_card_id=gift_card.id,
        amount=adjustment.amount,
        transaction_type=GiftCardTransactionType.ADJUSTMENT,
        balance_after=new_balance,
        user_id=int(payload.get("sub")),
        description=f"Ajustement admin: {adjustment.reason}"
    )
    db.add(transaction)

    db.commit()
    db.refresh(gift_card)

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="adjust_gift_card",
        resource_type="gift_card",
        resource_id=gift_card.id,
        resource_reference=gift_card.code,
        old_values={"balance": old_balance},
        new_values={"balance": new_balance, "reason": adjustment.reason},
        ip_address=request.client.host if request.client else None
    )

    return {
        "message": f"Solde ajuste de {adjustment.amount} TND",
        "oldBalance": old_balance,
        "newBalance": new_balance,
        "giftCard": gift_card.to_dict()
    }


@admin_router.delete("/{gift_card_id}")
async def cancel_gift_card(
    gift_card_id: int,
    request: Request,
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Cancel a gift card (admin only)"""
    gift_card = db.query(GiftCard).filter(GiftCard.id == gift_card_id).first()

    if not gift_card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carte cadeau introuvable")

    if gift_card.status == GiftCardStatus.CANCELLED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cette carte cadeau est deja annulee")

    old_status = gift_card.status
    gift_card.status = GiftCardStatus.CANCELLED

    db.commit()

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="cancel_gift_card",
        resource_type="gift_card",
        resource_id=gift_card.id,
        resource_reference=gift_card.code,
        old_values={"status": old_status.value},
        new_values={"status": GiftCardStatus.CANCELLED.value},
        ip_address=request.client.host if request.client else None
    )

    return {"message": "Carte cadeau annulee avec succes"}
