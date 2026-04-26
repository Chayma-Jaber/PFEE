"""
Payment Router - Click to Pay Integration with Security Hardening
Handles CTP transaction creation, verification, and webhook callbacks
"""
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timedelta
import hashlib
import hmac
import secrets
import httpx
import json
import logging

from ..core.database import get_db
from ..core.config import settings
from ..core.security import get_current_user
from ..models.user import User
from ..models.order import Order, OrderStatus
from ..models.payment import Payment, PaymentState, PaymentMethod, PaymentLog

router = APIRouter(prefix="/api/payment", tags=["Payment"])
logger = logging.getLogger(__name__)


# ===================== SCHEMAS =====================

class CTPTransactionRequest(BaseModel):
    order_id: int
    redirect_url: str
    cancel_url: Optional[str] = None


class CTPTransactionResponse(BaseModel):
    success: bool
    transaction_id: Optional[str] = None
    payment_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    message: Optional[str] = None


class CTPCallbackPayload(BaseModel):
    transaction_id: str
    payment_id: str
    status: str
    amount: float
    currency: str
    order_reference: str
    timestamp: str
    signature: str


class PaymentStatusResponse(BaseModel):
    order_id: int
    payment_status: str
    ctp_status: Optional[str] = None
    amount: float
    currency: str = "TND"
    paid_at: Optional[datetime] = None
    is_verified: bool = False


# ===================== SECURITY HELPERS =====================

def generate_idempotency_key(order_id: int, user_id: int) -> str:
    """Generate unique idempotency key for payment"""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H")
    raw = f"{order_id}-{user_id}-{timestamp}-{secrets.token_hex(8)}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def verify_ctp_signature(payload: dict, signature: str) -> bool:
    """Verify CTP callback signature using HMAC-SHA256"""
    if not settings.CTP_SECRET_KEY:
        logger.warning("CTP_SECRET_KEY not configured, skipping signature verification")
        return True

    # Build signature string from payload
    sig_string = "|".join([
        str(payload.get("transaction_id", "")),
        str(payload.get("payment_id", "")),
        str(payload.get("status", "")),
        str(payload.get("amount", "")),
        str(payload.get("order_reference", "")),
        str(payload.get("timestamp", ""))
    ])

    expected_sig = hmac.new(
        settings.CTP_SECRET_KEY.encode(),
        sig_string.encode(),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected_sig, signature)


def validate_order_for_payment(order: Order) -> tuple[bool, str]:
    """Validate order is eligible for payment"""
    if not order:
        return False, "Order not found"

    if order.status == OrderStatus.CANCELLED:
        return False, "Order has been cancelled"

    if order.payment_status == "completed":
        return False, "Order already paid"

    if order.total_amount <= 0:
        return False, "Invalid order amount"

    # Check if payment expired (older than 24 hours)
    if order.created_at < datetime.utcnow() - timedelta(hours=24):
        # Allow retry for unpaid orders
        if order.payment_status not in ["pending", "failed"]:
            return False, "Payment window expired"

    return True, ""


def log_payment_action(
    db: Session,
    payment: Payment,
    action: str,
    old_state: str,
    new_state: str,
    request_data: dict = None,
    response_data: dict = None,
    ip_address: str = None
):
    """Log payment action for audit trail"""
    log_entry = PaymentLog(
        payment_id=payment.id,
        action=action,
        old_state=old_state,
        new_state=new_state,
        request_data=json.dumps(request_data) if request_data else None,
        response_data=json.dumps(response_data) if response_data else None,
        ip_address=ip_address
    )
    db.add(log_entry)
    db.commit()


# ===================== CTP API CLIENT =====================

async def call_ctp_api(endpoint: str, payload: dict) -> dict:
    """Make authenticated call to CTP API"""
    if not settings.CTP_API_URL:
        # Mock response for development
        return {
            "success": True,
            "data": {
                "transaction_id": f"CTP-{secrets.token_hex(8).upper()}",
                "payment_url": f"https://checkout.clicktopay.tn/pay/{secrets.token_hex(12)}",
                "expires_at": (datetime.utcnow() + timedelta(hours=2)).isoformat()
            }
        }

    async with httpx.AsyncClient(timeout=30.0) as client:
        headers = {
            "Authorization": f"Bearer {settings.CTP_API_KEY}",
            "Content-Type": "application/json",
            "X-Merchant-ID": settings.CTP_MERCHANT_ID or "BARSHA_DEMO"
        }

        try:
            response = await client.post(
                f"{settings.CTP_API_URL}/{endpoint}",
                json=payload,
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"CTP API error: {str(e)}")
            raise HTTPException(status_code=502, detail="Payment gateway error")


async def verify_ctp_transaction(transaction_id: str) -> dict:
    """Verify transaction status with CTP API"""
    if not settings.CTP_API_URL:
        # Mock verification for development
        return {
            "success": True,
            "data": {
                "transaction_id": transaction_id,
                "status": "completed",
                "verified": True
            }
        }

    async with httpx.AsyncClient(timeout=30.0) as client:
        headers = {
            "Authorization": f"Bearer {settings.CTP_API_KEY}",
            "X-Merchant-ID": settings.CTP_MERCHANT_ID or "BARSHA_DEMO"
        }

        try:
            response = await client.get(
                f"{settings.CTP_API_URL}/transactions/{transaction_id}",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"CTP verification error: {str(e)}")
            return {"success": False, "error": str(e)}


# ===================== ENDPOINTS =====================

@router.post("/ctp/initiate", response_model=CTPTransactionResponse)
async def initiate_ctp_payment(
    request: Request,
    data: CTPTransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Initiate Click to Pay transaction
    - Validates order ownership and eligibility
    - Creates payment record with idempotency key
    - Generates CTP payment URL
    """
    # Get order
    order = db.query(Order).filter(
        Order.id == data.order_id,
        Order.user_id == current_user.id
    ).first()

    # Validate order
    is_valid, error_msg = validate_order_for_payment(order)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Check for existing pending payment
    existing_payment = db.query(Payment).filter(
        Payment.order_id == order.id,
        Payment.state.in_([PaymentState.INITIATED, PaymentState.PENDING])
    ).first()

    if existing_payment:
        # Return existing payment URL if still valid
        if existing_payment.ctp_redirect_url and existing_payment.created_at > datetime.utcnow() - timedelta(hours=1):
            return CTPTransactionResponse(
                success=True,
                transaction_id=existing_payment.ctp_transaction_id,
                payment_url=existing_payment.ctp_redirect_url,
                expires_at=existing_payment.created_at + timedelta(hours=2)
            )
        # Cancel expired payment
        existing_payment.state = PaymentState.FAILED
        existing_payment.failure_reason = "Expired"
        db.commit()

    # Generate idempotency key
    idempotency_key = generate_idempotency_key(order.id, current_user.id)

    # Create payment record
    payment = Payment(
        order_id=order.id,
        amount=order.total_amount,
        currency="TND",
        method=PaymentMethod.CTP,
        state=PaymentState.INITIATED,
        idempotency_key=idempotency_key,
        ctp_return_url=data.redirect_url,
        ctp_callback_url=f"{settings.APP_URL}/api/payment/ctp/callback"
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    # Log initiation
    client_ip = request.client.host if request.client else "unknown"
    log_payment_action(
        db, payment, "initiate", "none", "initiated",
        request_data={"order_id": order.id, "amount": order.total_amount},
        ip_address=client_ip
    )

    # Call CTP API
    ctp_payload = {
        "merchant_id": settings.CTP_MERCHANT_ID or "BARSHA_DEMO",
        "order_reference": order.reference,
        "amount": order.total_amount,
        "currency": "TND",
        "description": f"Commande Barsha {order.reference}",
        "customer_email": current_user.email,
        "customer_name": f"{current_user.first_name} {current_user.last_name}",
        "success_url": data.redirect_url,
        "cancel_url": data.cancel_url or data.redirect_url,
        "callback_url": payment.ctp_callback_url,
        "idempotency_key": idempotency_key,
        "metadata": {
            "order_id": order.id,
            "payment_id": payment.id
        }
    }

    try:
        ctp_response = await call_ctp_api("transactions/create", ctp_payload)

        if ctp_response.get("success"):
            ctp_data = ctp_response.get("data", {})
            payment.ctp_transaction_id = ctp_data.get("transaction_id")
            payment.ctp_redirect_url = ctp_data.get("payment_url")
            payment.state = PaymentState.PENDING
            payment.gateway_response = json.dumps(ctp_response)
            db.commit()

            # Update order payment status
            order.payment_status = "pending"
            order.ctp_transaction_id = payment.ctp_transaction_id
            db.commit()

            log_payment_action(
                db, payment, "ctp_created", "initiated", "pending",
                response_data=ctp_data,
                ip_address=client_ip
            )

            return CTPTransactionResponse(
                success=True,
                transaction_id=payment.ctp_transaction_id,
                payment_url=payment.ctp_redirect_url,
                expires_at=datetime.fromisoformat(ctp_data.get("expires_at")) if ctp_data.get("expires_at") else None
            )
        else:
            payment.state = PaymentState.FAILED
            payment.failure_reason = ctp_response.get("error", "Unknown error")
            db.commit()

            raise HTTPException(status_code=400, detail="Failed to create payment")

    except Exception as e:
        payment.state = PaymentState.FAILED
        payment.failure_reason = str(e)
        db.commit()
        logger.error(f"CTP initiation error: {str(e)}")
        raise HTTPException(status_code=500, detail="Payment initiation failed")


@router.post("/ctp/callback")
async def ctp_callback(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Handle CTP webhook callback
    - Verifies signature
    - Updates payment and order status
    - Logs all actions for audit
    """
    try:
        body = await request.json()
        callback = CTPCallbackPayload(**body)
    except Exception as e:
        logger.error(f"Invalid callback payload: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid payload")

    # Verify signature
    if not verify_ctp_signature(body, callback.signature):
        logger.warning(f"Invalid signature for transaction {callback.transaction_id}")
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Find payment
    payment = db.query(Payment).filter(
        Payment.ctp_transaction_id == callback.transaction_id
    ).first()

    if not payment:
        logger.error(f"Payment not found for transaction {callback.transaction_id}")
        raise HTTPException(status_code=404, detail="Payment not found")

    old_state = payment.state.value
    client_ip = request.client.host if request.client else "unknown"

    # Update payment based on status
    status_mapping = {
        "completed": PaymentState.COMPLETED,
        "paid": PaymentState.COMPLETED,
        "success": PaymentState.COMPLETED,
        "failed": PaymentState.FAILED,
        "cancelled": PaymentState.FAILED,
        "expired": PaymentState.FAILED,
        "processing": PaymentState.PROCESSING,
        "pending": PaymentState.PENDING
    }

    new_state = status_mapping.get(callback.status.lower(), PaymentState.PENDING)
    payment.state = new_state
    payment.ctp_payment_id = callback.payment_id
    payment.gateway_response = json.dumps(body)

    if new_state == PaymentState.COMPLETED:
        payment.paid_at = datetime.utcnow()
    elif new_state == PaymentState.FAILED:
        payment.failure_reason = f"CTP status: {callback.status}"

    db.commit()

    # Update order
    order = db.query(Order).filter(Order.id == payment.order_id).first()
    if order:
        if new_state == PaymentState.COMPLETED:
            order.payment_status = "completed"
            order.status = OrderStatus.CONFIRMED
        elif new_state == PaymentState.FAILED:
            order.payment_status = "failed"
        db.commit()

    # Log callback
    log_payment_action(
        db, payment, "callback_received", old_state, new_state.value,
        request_data=body,
        ip_address=client_ip
    )

    return {"status": "received", "processed": True}


@router.get("/ctp/verify/{order_id}", response_model=PaymentStatusResponse)
async def verify_ctp_payment(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verify CTP payment status for an order
    - Checks local payment record
    - Optionally verifies with CTP API
    - Returns comprehensive payment status
    """
    # Get order
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Get latest payment
    payment = db.query(Payment).filter(
        Payment.order_id == order_id
    ).order_by(Payment.created_at.desc()).first()

    if not payment:
        return PaymentStatusResponse(
            order_id=order_id,
            payment_status=order.payment_status or "no_payment",
            amount=order.total_amount,
            is_verified=False
        )

    # Verify with CTP if transaction exists and not yet completed
    ctp_status = None
    is_verified = False

    if payment.ctp_transaction_id and payment.state not in [PaymentState.COMPLETED, PaymentState.REFUNDED]:
        try:
            verification = await verify_ctp_transaction(payment.ctp_transaction_id)
            if verification.get("success"):
                ctp_data = verification.get("data", {})
                ctp_status = ctp_data.get("status")
                is_verified = ctp_data.get("verified", False)

                # Update payment if status changed
                if ctp_status == "completed" and payment.state != PaymentState.COMPLETED:
                    payment.state = PaymentState.COMPLETED
                    payment.paid_at = datetime.utcnow()
                    order.payment_status = "completed"
                    order.status = OrderStatus.CONFIRMED
                    db.commit()
        except Exception as e:
            logger.warning(f"CTP verification failed: {str(e)}")
    else:
        is_verified = payment.state == PaymentState.COMPLETED

    return PaymentStatusResponse(
        order_id=order_id,
        payment_status=payment.state.value,
        ctp_status=ctp_status,
        amount=payment.amount,
        paid_at=payment.paid_at,
        is_verified=is_verified
    )


@router.post("/ctp/retry/{order_id}", response_model=CTPTransactionResponse)
async def retry_ctp_payment(
    order_id: int,
    request: Request,
    redirect_url: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retry failed CTP payment
    - Cancels previous failed payment
    - Creates new payment attempt
    """
    # Get order
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check order is still payable
    if order.payment_status == "completed":
        raise HTTPException(status_code=400, detail="Order already paid")

    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Order cancelled")

    # Cancel any pending payments
    pending_payments = db.query(Payment).filter(
        Payment.order_id == order_id,
        Payment.state.in_([PaymentState.INITIATED, PaymentState.PENDING])
    ).all()

    for p in pending_payments:
        p.state = PaymentState.FAILED
        p.failure_reason = "Cancelled for retry"
    db.commit()

    # Create new payment via initiate endpoint
    return await initiate_ctp_payment(
        request,
        CTPTransactionRequest(order_id=order_id, redirect_url=redirect_url),
        db,
        current_user
    )


@router.get("/methods")
async def get_payment_methods(
    delivery_type: str = "home",
    db: Session = Depends(get_db)
):
    """
    Get available payment methods based on delivery type
    """
    methods = [
        {
            "id": "CBE",
            "name": "Carte bancaire",
            "description": "Paiement sécurisé par carte via Click to Pay",
            "icon": "credit-card",
            "available": True,
            "min_amount": 0,
            "max_amount": 10000
        }
    ]

    # COD only for home delivery
    if delivery_type == "home":
        methods.append({
            "id": "COD",
            "name": "Paiement à la livraison",
            "description": "Payez en espèces à la réception",
            "icon": "money-bill",
            "available": True,
            "min_amount": 0,
            "max_amount": 500,
            "fee": 7.000  # COD service fee
        })

    return {"methods": methods}
