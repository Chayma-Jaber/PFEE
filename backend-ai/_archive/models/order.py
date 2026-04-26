"""
Order Models
Orders, order items, and status management
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import uuid

from app.core.database import Base


class OrderStatus(str, enum.Enum):
    """Order status enumeration with lifecycle"""
    # Initial states
    PENDING = "pending"              # Order created, awaiting payment
    PAYMENT_PENDING = "payment_pending"  # Payment initiated

    # Processing states
    CONFIRMED = "confirmed"          # Payment received, order confirmed
    PROCESSING = "processing"        # Being prepared
    READY = "ready"                  # Ready for shipping

    # Shipping states
    SHIPPED = "shipped"              # Handed to carrier
    IN_TRANSIT = "in_transit"        # On the way
    OUT_FOR_DELIVERY = "out_for_delivery"  # Last mile

    # Completion states
    DELIVERED = "delivered"          # Successfully delivered
    COMPLETED = "completed"          # Order completed (after return window)

    # Exception states
    CANCELLED = "cancelled"          # Cancelled before shipping
    RETURNED = "returned"            # Returned after delivery
    REFUNDED = "refunded"            # Money refunded
    FAILED = "failed"                # Payment failed

    # Valid transitions
    @classmethod
    def valid_transitions(cls):
        return {
            cls.PENDING: [cls.PAYMENT_PENDING, cls.CONFIRMED, cls.CANCELLED, cls.FAILED],
            cls.PAYMENT_PENDING: [cls.CONFIRMED, cls.CANCELLED, cls.FAILED],
            cls.CONFIRMED: [cls.PROCESSING, cls.CANCELLED],
            cls.PROCESSING: [cls.READY, cls.CANCELLED],
            cls.READY: [cls.SHIPPED, cls.CANCELLED],
            cls.SHIPPED: [cls.IN_TRANSIT, cls.DELIVERED],
            cls.IN_TRANSIT: [cls.OUT_FOR_DELIVERY, cls.DELIVERED],
            cls.OUT_FOR_DELIVERY: [cls.DELIVERED],
            cls.DELIVERED: [cls.COMPLETED, cls.RETURNED],
            cls.COMPLETED: [],
            cls.CANCELLED: [],
            cls.RETURNED: [cls.REFUNDED],
            cls.REFUNDED: [],
            cls.FAILED: [cls.PENDING]
        }


class PaymentStatus(str, enum.Enum):
    """Payment status enumeration"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


class Order(Base):
    """Order model"""
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for guest orders

    # Status
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING, nullable=False)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)

    # Pricing
    subtotal = Column(Float, nullable=False)  # Before discounts/shipping
    discount_amount = Column(Float, default=0)
    shipping_amount = Column(Float, default=0)
    tax_amount = Column(Float, default=0)
    total_amount = Column(Float, nullable=False)

    # Coupon
    coupon_code = Column(String(50), nullable=True)
    coupon_id = Column(Integer, ForeignKey("coupons.id"), nullable=True)

    # Shipping address (denormalized for history)
    shipping_first_name = Column(String(100), nullable=True)
    shipping_last_name = Column(String(100), nullable=True)
    shipping_phone = Column(String(20), nullable=True)
    shipping_street = Column(String(255), nullable=True)
    shipping_street2 = Column(String(255), nullable=True)
    shipping_city = Column(String(100), nullable=True)
    shipping_state = Column(String(100), nullable=True)
    shipping_postal_code = Column(String(20), nullable=True)
    shipping_country = Column(String(100), default="Tunisie")

    # Billing address (if different)
    billing_same_as_shipping = Column(Boolean, default=True)
    billing_first_name = Column(String(100), nullable=True)
    billing_last_name = Column(String(100), nullable=True)
    billing_street = Column(String(255), nullable=True)
    billing_city = Column(String(100), nullable=True)

    # Shipping method
    shipping_method = Column(String(50), nullable=True)
    shipping_carrier = Column(String(50), nullable=True)
    tracking_number = Column(String(100), nullable=True)
    tracking_url = Column(String(500), nullable=True)

    # Customer info (for guest orders)
    customer_email = Column(String(255), nullable=True)
    customer_phone = Column(String(20), nullable=True)

    # Notes
    customer_notes = Column(Text, nullable=True)
    admin_notes = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)

    # Metadata
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    source = Column(String(50), default="web")  # web, mobile, admin

    # Payment reference
    payment_method = Column(String(50), nullable=True)  # ctp, cod
    payment_reference = Column(String(100), nullable=True)
    ctp_transaction_id = Column(String(100), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    confirmed_at = Column(DateTime, nullable=True)
    shipped_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="order")
    coupon = relationship("Coupon", back_populates="orders")
    return_requests = relationship("ReturnRequest", back_populates="order")
    status_history = relationship("OrderStatusHistory", back_populates="order", cascade="all, delete-orphan")

    @staticmethod
    def generate_reference() -> str:
        """Generate unique order reference"""
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        unique_id = str(uuid.uuid4().hex)[:8].upper()
        return f"BRS-{timestamp}-{unique_id}"

    def can_transition_to(self, new_status: OrderStatus) -> bool:
        """Check if transition to new status is valid"""
        valid = OrderStatus.valid_transitions().get(self.status, [])
        return new_status in valid

    def to_dict(self, include_items=True):
        data = {
            "id": self.id,
            "reference": self.reference,
            "userId": self.user_id,
            "status": self.status.value,
            "paymentStatus": self.payment_status.value,
            "subtotal": self.subtotal,
            "discountAmount": self.discount_amount,
            "shippingAmount": self.shipping_amount,
            "totalAmount": self.total_amount,
            "couponCode": self.coupon_code,
            "shippingAddress": {
                "firstName": self.shipping_first_name,
                "lastName": self.shipping_last_name,
                "phone": self.shipping_phone,
                "street": self.shipping_street,
                "city": self.shipping_city,
                "state": self.shipping_state,
                "country": self.shipping_country
            },
            "shippingMethod": self.shipping_method,
            "trackingNumber": self.tracking_number,
            "paymentMethod": self.payment_method,
            "customerNotes": self.customer_notes,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "confirmedAt": self.confirmed_at.isoformat() if self.confirmed_at else None,
            "shippedAt": self.shipped_at.isoformat() if self.shipped_at else None,
            "deliveredAt": self.delivered_at.isoformat() if self.delivered_at else None
        }
        if include_items:
            data["items"] = [item.to_dict() for item in self.items]
            data["itemCount"] = len(self.items)
        return data


class OrderItem(Base):
    """Order line item model"""
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=True)

    # Product snapshot (denormalized for history)
    sku = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    image_url = Column(String(500), nullable=True)
    color = Column(String(50), nullable=True)
    size = Column(String(20), nullable=True)
    ean13 = Column(String(20), nullable=True)

    # Pricing
    unit_price = Column(Float, nullable=False)
    discount_amount = Column(Float, default=0)
    quantity = Column(Integer, nullable=False)
    total_price = Column(Float, nullable=False)

    # Status
    returned_quantity = Column(Integer, default=0)
    refunded_amount = Column(Float, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    order = relationship("Order", back_populates="items")

    def to_dict(self):
        return {
            "id": self.id,
            "productId": self.product_id,
            "variantId": self.variant_id,
            "sku": self.sku,
            "title": self.title,
            "imageUrl": self.image_url,
            "color": self.color,
            "size": self.size,
            "unitPrice": self.unit_price,
            "quantity": self.quantity,
            "totalPrice": self.total_price,
            "returnedQuantity": self.returned_quantity
        }


class OrderStatusHistory(Base):
    """Order status change history for audit trail"""
    __tablename__ = "order_status_history"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)

    from_status = Column(Enum(OrderStatus), nullable=True)
    to_status = Column(Enum(OrderStatus), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Admin user ID
    change_reason = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    order = relationship("Order", back_populates="status_history")

    def to_dict(self):
        return {
            "id": self.id,
            "fromStatus": self.from_status.value if self.from_status else None,
            "toStatus": self.to_status.value,
            "changedBy": self.changed_by,
            "changeReason": self.change_reason,
            "notes": self.notes,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
