"""
Payment Models
Payment transactions and methods
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class PaymentMethod(str, enum.Enum):
    """Payment method types"""
    CTP = "ctp"              # Click to Pay
    COD = "cod"              # Cash on Delivery
    BANK_TRANSFER = "bank_transfer"
    GIFT_CARD = "gift_card"


class PaymentState(str, enum.Enum):
    """Payment transaction states"""
    INITIATED = "initiated"
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


class Payment(Base):
    """Payment transaction model"""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)

    # Transaction details
    reference = Column(String(100), unique=True, nullable=False, index=True)
    method = Column(Enum(PaymentMethod), nullable=False)
    state = Column(Enum(PaymentState), default=PaymentState.INITIATED, nullable=False)

    # Amounts
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="TND")
    refunded_amount = Column(Float, default=0)

    # CTP specific fields
    ctp_transaction_id = Column(String(100), nullable=True, index=True)
    ctp_payment_id = Column(String(100), nullable=True)
    ctp_redirect_url = Column(String(500), nullable=True)
    ctp_callback_url = Column(String(500), nullable=True)
    ctp_return_url = Column(String(500), nullable=True)

    # Response data
    gateway_response = Column(JSON, nullable=True)
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)

    # Idempotency
    idempotency_key = Column(String(100), unique=True, nullable=True, index=True)
    attempt_count = Column(Integer, default=1)

    # Metadata
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    refunded_at = Column(DateTime, nullable=True)

    # Relationships
    order = relationship("Order", back_populates="payments")
    logs = relationship("PaymentLog", back_populates="payment", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "orderId": self.order_id,
            "reference": self.reference,
            "method": self.method.value,
            "state": self.state.value,
            "amount": self.amount,
            "currency": self.currency,
            "refundedAmount": self.refunded_amount,
            "ctpTransactionId": self.ctp_transaction_id,
            "errorCode": self.error_code,
            "errorMessage": self.error_message,
            "attemptCount": self.attempt_count,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None
        }


class PaymentLog(Base):
    """Payment activity log for audit trail"""
    __tablename__ = "payment_logs"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id", ondelete="CASCADE"), nullable=False)

    action = Column(String(50), nullable=False)  # initiated, callback_received, verified, etc.
    from_state = Column(Enum(PaymentState), nullable=True)
    to_state = Column(Enum(PaymentState), nullable=True)

    request_data = Column(JSON, nullable=True)
    response_data = Column(JSON, nullable=True)

    ip_address = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    payment = relationship("Payment", back_populates="logs")

    def to_dict(self):
        return {
            "id": self.id,
            "action": self.action,
            "fromState": self.from_state.value if self.from_state else None,
            "toState": self.to_state.value if self.to_state else None,
            "notes": self.notes,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
