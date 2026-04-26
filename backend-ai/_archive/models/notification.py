"""
Notification Models
User notifications for orders, promotions, support, etc.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class NotificationType(str, enum.Enum):
    """Notification types"""
    ORDER_STATUS = "order_status"          # Order status updates
    ORDER_SHIPPED = "order_shipped"        # Order shipped
    ORDER_DELIVERED = "order_delivered"    # Order delivered
    PAYMENT_SUCCESS = "payment_success"    # Payment confirmed
    PAYMENT_FAILED = "payment_failed"      # Payment failed
    RETURN_UPDATE = "return_update"        # Return request update
    SUPPORT_REPLY = "support_reply"        # Support ticket reply
    SUPPORT_RESOLVED = "support_resolved"  # Support ticket resolved
    PROMOTION = "promotion"                # Promotional notification
    COUPON = "coupon"                      # New coupon available
    PRICE_DROP = "price_drop"              # Price drop on wishlist item
    BACK_IN_STOCK = "back_in_stock"        # Item back in stock
    ACCOUNT = "account"                    # Account-related notification
    SYSTEM = "system"                      # System notification


class NotificationPriority(str, enum.Enum):
    """Notification priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class Notification(Base):
    """User notification model"""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Notification content
    type = Column(Enum(NotificationType), default=NotificationType.SYSTEM, nullable=False)
    priority = Column(Enum(NotificationPriority), default=NotificationPriority.NORMAL, nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    icon = Column(String(50), nullable=True)  # Icon class or emoji

    # Related entities
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id", ondelete="SET NULL"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)

    # Action link
    action_url = Column(String(500), nullable=True)
    action_label = Column(String(100), nullable=True)

    # Status
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime, nullable=True)
    is_archived = Column(Boolean, default=False)

    # Delivery channels
    sent_email = Column(Boolean, default=False)
    sent_push = Column(Boolean, default=False)
    sent_sms = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=True)  # Optional expiration

    # Relationships
    user = relationship("User", backref="notifications")

    @staticmethod
    def create_order_notification(
        user_id: int,
        order_id: int,
        order_ref: str,
        status: str
    ) -> "Notification":
        """Factory method for order notifications"""
        status_messages = {
            "confirmed": ("Commande confirm\u00e9e", f"Votre commande #{order_ref} a \u00e9t\u00e9 confirm\u00e9e."),
            "processing": ("Commande en pr\u00e9paration", f"Votre commande #{order_ref} est en cours de pr\u00e9paration."),
            "shipped": ("Commande exp\u00e9di\u00e9e", f"Votre commande #{order_ref} a \u00e9t\u00e9 exp\u00e9di\u00e9e !"),
            "delivered": ("Commande livr\u00e9e", f"Votre commande #{order_ref} a \u00e9t\u00e9 livr\u00e9e. Merci !"),
            "cancelled": ("Commande annul\u00e9e", f"Votre commande #{order_ref} a \u00e9t\u00e9 annul\u00e9e."),
        }

        title, message = status_messages.get(
            status,
            ("Mise \u00e0 jour commande", f"Le statut de votre commande #{order_ref} a chang\u00e9.")
        )

        return Notification(
            user_id=user_id,
            type=NotificationType.ORDER_STATUS,
            priority=NotificationPriority.NORMAL,
            title=title,
            message=message,
            icon="shopping_bag",
            order_id=order_id,
            action_url=f"/profile?tab=orders&order={order_id}",
            action_label="Voir la commande"
        )

    @staticmethod
    def create_support_notification(
        user_id: int,
        ticket_id: int,
        ticket_ref: str,
        notification_type: str = "reply"
    ) -> "Notification":
        """Factory method for support notifications"""
        if notification_type == "resolved":
            return Notification(
                user_id=user_id,
                type=NotificationType.SUPPORT_RESOLVED,
                priority=NotificationPriority.NORMAL,
                title="Ticket r\u00e9solu",
                message=f"Votre demande #{ticket_ref} a \u00e9t\u00e9 r\u00e9solue.",
                icon="check_circle",
                ticket_id=ticket_id,
                action_url=f"/support?ticket={ticket_id}",
                action_label="Voir le ticket"
            )
        else:
            return Notification(
                user_id=user_id,
                type=NotificationType.SUPPORT_REPLY,
                priority=NotificationPriority.NORMAL,
                title="Nouvelle r\u00e9ponse support",
                message=f"Vous avez une nouvelle r\u00e9ponse sur votre demande #{ticket_ref}.",
                icon="headset_mic",
                ticket_id=ticket_id,
                action_url=f"/support?ticket={ticket_id}",
                action_label="Voir le ticket"
            )

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": self.id,
            "userId": self.user_id,
            "type": self.type.value,
            "priority": self.priority.value,
            "title": self.title,
            "message": self.message,
            "icon": self.icon,
            "orderId": self.order_id,
            "ticketId": self.ticket_id,
            "productId": self.product_id,
            "actionUrl": self.action_url,
            "actionLabel": self.action_label,
            "isRead": self.is_read,
            "readAt": self.read_at.isoformat() if self.read_at else None,
            "isArchived": self.is_archived,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None
        }
