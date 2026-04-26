"""
Support Ticket Models
Customer support tickets, messages, and attachments
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class TicketCategory(str, enum.Enum):
    """Support ticket categories"""
    ORDER = "order"                    # Order-related issues
    PRODUCT = "product"                # Product questions/issues
    DELIVERY = "delivery"              # Shipping/delivery problems
    RETURN = "return"                  # Returns and exchanges
    PAYMENT = "payment"                # Payment issues
    ACCOUNT = "account"                # Account problems
    TECHNICAL = "technical"            # Website/app issues
    COMPLAINT = "complaint"            # Complaints
    SUGGESTION = "suggestion"          # Suggestions/feedback
    OTHER = "other"                    # Other inquiries


class TicketPriority(str, enum.Enum):
    """Ticket priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TicketStatus(str, enum.Enum):
    """Ticket status lifecycle"""
    OPEN = "open"                      # New ticket, awaiting response
    IN_PROGRESS = "in_progress"        # Being handled by support
    AWAITING_CUSTOMER = "awaiting_customer"  # Waiting for customer reply
    RESOLVED = "resolved"              # Issue resolved
    CLOSED = "closed"                  # Ticket closed
    REOPENED = "reopened"              # Customer reopened ticket


class SupportTicket(Base):
    """Support ticket model for customer inquiries"""
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for guest tickets

    # Ticket details
    subject = Column(String(255), nullable=False)
    category = Column(Enum(TicketCategory), default=TicketCategory.OTHER, nullable=False)
    priority = Column(Enum(TicketPriority), default=TicketPriority.MEDIUM, nullable=False)
    status = Column(Enum(TicketStatus), default=TicketStatus.OPEN, nullable=False, index=True)

    # Related entities (optional)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)

    # Contact info (for guest tickets or override)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    contact_name = Column(String(100), nullable=True)

    # Assignment
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)  # Support agent

    # Resolution
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Feedback
    satisfaction_rating = Column(Integer, nullable=True)  # 1-5 stars
    satisfaction_comment = Column(Text, nullable=True)

    # Internal notes
    internal_notes = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True)  # Comma-separated tags

    # First response SLA
    first_response_at = Column(DateTime, nullable=True)
    first_response_deadline = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    last_customer_message_at = Column(DateTime, nullable=True)
    last_agent_message_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="support_tickets")
    assigned_agent = relationship("User", foreign_keys=[assigned_to], backref="assigned_tickets")
    resolver = relationship("User", foreign_keys=[resolved_by])
    order = relationship("Order", backref="support_tickets")
    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketMessage.created_at")
    attachments = relationship("TicketAttachment", back_populates="ticket", cascade="all, delete-orphan")

    @staticmethod
    def generate_reference() -> str:
        """Generate unique ticket reference"""
        import uuid
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        unique_id = str(uuid.uuid4().hex)[:6].upper()
        return f"TKT-{timestamp}-{unique_id}"

    @property
    def is_open(self) -> bool:
        """Check if ticket is still open"""
        return self.status in [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_CUSTOMER, TicketStatus.REOPENED]

    @property
    def message_count(self) -> int:
        """Get total message count"""
        return len(self.messages) if self.messages else 0

    def to_dict(self, include_messages=False):
        """Convert to dictionary"""
        data = {
            "id": self.id,
            "reference": self.reference,
            "userId": self.user_id,
            "subject": self.subject,
            "category": self.category.value,
            "priority": self.priority.value,
            "status": self.status.value,
            "orderId": self.order_id,
            "productId": self.product_id,
            "contactEmail": self.contact_email,
            "contactPhone": self.contact_phone,
            "contactName": self.contact_name,
            "assignedTo": self.assigned_to,
            "resolutionNotes": self.resolution_notes,
            "resolvedAt": self.resolved_at.isoformat() if self.resolved_at else None,
            "satisfactionRating": self.satisfaction_rating,
            "tags": self.tags.split(",") if self.tags else [],
            "firstResponseAt": self.first_response_at.isoformat() if self.first_response_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "closedAt": self.closed_at.isoformat() if self.closed_at else None,
            "lastCustomerMessageAt": self.last_customer_message_at.isoformat() if self.last_customer_message_at else None,
            "lastAgentMessageAt": self.last_agent_message_at.isoformat() if self.last_agent_message_at else None,
            "messageCount": self.message_count,
            "isOpen": self.is_open
        }

        # Include user info if available
        if self.user:
            data["customer"] = {
                "id": self.user.id,
                "name": self.user.full_name,
                "email": self.user.email
            }

        # Include agent info if assigned
        if self.assigned_agent:
            data["agent"] = {
                "id": self.assigned_agent.id,
                "name": self.assigned_agent.full_name
            }

        # Include order reference if linked
        if self.order:
            data["orderReference"] = self.order.reference

        if include_messages:
            data["messages"] = [msg.to_dict() for msg in self.messages]

        return data

    def to_summary(self):
        """Compact summary for lists"""
        return {
            "id": self.id,
            "reference": self.reference,
            "subject": self.subject,
            "category": self.category.value,
            "priority": self.priority.value,
            "status": self.status.value,
            "customerName": self.contact_name or (self.user.full_name if self.user else "Guest"),
            "assignedTo": self.assigned_agent.full_name if self.assigned_agent else None,
            "messageCount": self.message_count,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "isOpen": self.is_open
        }


class TicketMessage(Base):
    """Individual message in a support ticket thread"""
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for system messages

    # Message content
    message = Column(Text, nullable=False)
    is_from_customer = Column(Boolean, default=True)  # True = customer, False = support agent
    is_internal = Column(Boolean, default=False)  # Internal notes (not visible to customer)
    is_system = Column(Boolean, default=False)  # System-generated messages

    # Read status
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    ticket = relationship("SupportTicket", back_populates="messages")
    sender = relationship("User", backref="ticket_messages")
    message_attachments = relationship("TicketAttachment", back_populates="message", cascade="all, delete-orphan")

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": self.id,
            "ticketId": self.ticket_id,
            "senderId": self.sender_id,
            "senderName": self.sender.full_name if self.sender else "System",
            "message": self.message,
            "isFromCustomer": self.is_from_customer,
            "isInternal": self.is_internal,
            "isSystem": self.is_system,
            "isRead": self.is_read,
            "readAt": self.read_at.isoformat() if self.read_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "attachments": [att.to_dict() for att in self.message_attachments] if self.message_attachments else []
        }


class TicketAttachment(Base):
    """File attachments for support tickets"""
    __tablename__ = "ticket_attachments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False)
    message_id = Column(Integer, ForeignKey("ticket_messages.id", ondelete="SET NULL"), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # File details
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=True)  # MIME type
    file_size = Column(Integer, nullable=True)  # Size in bytes
    file_path = Column(String(500), nullable=False)  # Storage path

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    ticket = relationship("SupportTicket", back_populates="attachments")
    message = relationship("TicketMessage", back_populates="message_attachments")
    uploader = relationship("User", backref="uploaded_attachments")

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": self.id,
            "ticketId": self.ticket_id,
            "messageId": self.message_id,
            "filename": self.filename,
            "originalFilename": self.original_filename,
            "fileType": self.file_type,
            "fileSize": self.file_size,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
