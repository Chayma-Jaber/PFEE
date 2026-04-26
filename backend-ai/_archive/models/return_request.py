"""
Return Request Models
Product returns and refunds
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class ReturnStatus(str, enum.Enum):
    """Return request status"""
    PENDING = "pending"              # Request submitted
    UNDER_REVIEW = "under_review"    # Being reviewed by support
    APPROVED = "approved"            # Approved for return
    REJECTED = "rejected"            # Return denied
    SHIPPED = "shipped"              # Customer shipped item back
    RECEIVED = "received"            # Item received at warehouse
    INSPECTED = "inspected"          # Item inspected
    REFUND_PENDING = "refund_pending"  # Awaiting refund
    REFUNDED = "refunded"            # Refund completed
    COMPLETED = "completed"          # Process completed
    CANCELLED = "cancelled"          # Cancelled by customer


class ReturnReason(str, enum.Enum):
    """Return reason categories"""
    WRONG_SIZE = "wrong_size"
    WRONG_COLOR = "wrong_color"
    DEFECTIVE = "defective"
    NOT_AS_DESCRIBED = "not_as_described"
    CHANGED_MIND = "changed_mind"
    WRONG_ITEM = "wrong_item"
    DAMAGED = "damaged"
    OTHER = "other"


class ReturnRequest(Base):
    """Return request model"""
    __tablename__ = "return_requests"

    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True, nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Status
    status = Column(Enum(ReturnStatus), default=ReturnStatus.PENDING, nullable=False)

    # Reason
    reason = Column(Enum(ReturnReason), nullable=False)
    reason_details = Column(Text, nullable=True)

    # Items being returned
    items = Column(JSON, nullable=False)  # List of {orderItemId, quantity}

    # Refund
    refund_amount = Column(Float, nullable=True)
    refund_method = Column(String(50), nullable=True)  # original, store_credit

    # Shipping
    return_shipping_label = Column(String(500), nullable=True)
    return_tracking_number = Column(String(100), nullable=True)

    # Photos (evidence)
    photos = Column(JSON, nullable=True)  # List of URLs

    # Notes
    customer_notes = Column(Text, nullable=True)
    admin_notes = Column(Text, nullable=True)
    resolution_notes = Column(Text, nullable=True)

    # Assigned agent
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=True)
    refunded_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    order = relationship("Order", back_populates="return_requests")
    user = relationship("User", back_populates="return_requests", foreign_keys=[user_id])
    assigned_agent = relationship("User", foreign_keys=[assigned_to])
    status_history = relationship("ReturnStatusHistory", back_populates="return_request", cascade="all, delete-orphan")

    @staticmethod
    def generate_reference() -> str:
        """Generate unique return reference"""
        import uuid
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        unique_id = str(uuid.uuid4().hex)[:6].upper()
        return f"RET-{timestamp}-{unique_id}"

    def to_dict(self):
        return {
            "id": self.id,
            "reference": self.reference,
            "orderId": self.order_id,
            "userId": self.user_id,
            "status": self.status.value,
            "reason": self.reason.value,
            "reasonDetails": self.reason_details,
            "items": self.items,
            "refundAmount": self.refund_amount,
            "refundMethod": self.refund_method,
            "returnTrackingNumber": self.return_tracking_number,
            "photos": self.photos,
            "customerNotes": self.customer_notes,
            "adminNotes": self.admin_notes,
            "resolutionNotes": self.resolution_notes,
            "assignedTo": self.assigned_to,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "approvedAt": self.approved_at.isoformat() if self.approved_at else None,
            "refundedAt": self.refunded_at.isoformat() if self.refunded_at else None
        }


class ReturnStatusHistory(Base):
    """Return status change history"""
    __tablename__ = "return_status_history"

    id = Column(Integer, primary_key=True, index=True)
    return_request_id = Column(Integer, ForeignKey("return_requests.id", ondelete="CASCADE"), nullable=False)

    from_status = Column(Enum(ReturnStatus), nullable=True)
    to_status = Column(Enum(ReturnStatus), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    return_request = relationship("ReturnRequest", back_populates="status_history")

    def to_dict(self):
        return {
            "id": self.id,
            "fromStatus": self.from_status.value if self.from_status else None,
            "toStatus": self.to_status.value,
            "changedBy": self.changed_by,
            "notes": self.notes,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
