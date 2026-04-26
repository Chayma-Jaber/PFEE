"""
Order Service - Business Logic for Order Lifecycle Management
Handles order creation, status transitions, and business rules
"""
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List, Dict, Any
import logging

from ..models.order import Order, OrderItem, OrderStatus, OrderStatusHistory
from ..models.payment import Payment, PaymentState
from ..models.coupon import Coupon, CouponUsage
from ..models.user import User, Address

logger = logging.getLogger(__name__)


class OrderError(Exception):
    """Custom exception for order-related errors"""
    def __init__(self, message: str, code: str = "ORDER_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)


class OrderService:
    """
    Service class for order lifecycle management.
    Implements state machine pattern for order status transitions.
    """

    # Valid status transitions
    STATUS_TRANSITIONS = {
        OrderStatus.PENDING: [OrderStatus.PAYMENT_PENDING, OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
        OrderStatus.PAYMENT_PENDING: [OrderStatus.CONFIRMED, OrderStatus.FAILED, OrderStatus.CANCELLED],
        OrderStatus.FAILED: [OrderStatus.PENDING, OrderStatus.CANCELLED],  # Allow retry
        OrderStatus.CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
        OrderStatus.PROCESSING: [OrderStatus.READY, OrderStatus.CANCELLED],
        OrderStatus.READY: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
        OrderStatus.SHIPPED: [OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED],
        OrderStatus.IN_TRANSIT: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED],
        OrderStatus.OUT_FOR_DELIVERY: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
        OrderStatus.DELIVERED: [OrderStatus.COMPLETED, OrderStatus.RETURNED],
        OrderStatus.COMPLETED: [OrderStatus.RETURNED],
        OrderStatus.RETURNED: [OrderStatus.REFUNDED],
        OrderStatus.CANCELLED: [],  # Terminal state
        OrderStatus.REFUNDED: []  # Terminal state
    }

    def __init__(self, db: Session):
        self.db = db

    def create_order(
        self,
        user: User,
        items: List[Dict[str, Any]],
        shipping_address: Address,
        shipping_method: str,
        payment_method: str,
        coupon_code: Optional[str] = None
    ) -> Order:
        """
        Create a new order with validation and business rules.

        Args:
            user: The user placing the order
            items: List of order items with sku, quantity, price, etc.
            shipping_address: Delivery address
            shipping_method: Shipping method ID
            payment_method: Payment method (ctp, cod)
            coupon_code: Optional coupon code to apply

        Returns:
            Created Order instance

        Raises:
            OrderError: If validation fails
        """
        # Validate items
        if not items:
            raise OrderError("Order must contain at least one item", "EMPTY_CART")

        # Calculate totals
        subtotal = sum(item["unit_price"] * item["quantity"] for item in items)

        # Calculate shipping
        shipping_amount = self._calculate_shipping(subtotal, shipping_method)

        # Apply coupon if provided
        discount_amount = 0.0
        coupon = None
        if coupon_code:
            coupon = self._validate_and_apply_coupon(coupon_code, user.id, subtotal)
            if coupon:
                discount_amount = self._calculate_discount(coupon, subtotal)

        # Calculate total
        total_amount = subtotal + shipping_amount - discount_amount
        if total_amount < 0:
            total_amount = 0

        # Determine initial status based on payment method
        initial_status = OrderStatus.PENDING
        if payment_method == "ctp":
            initial_status = OrderStatus.PAYMENT_PENDING

        # Generate order reference
        reference = self._generate_order_reference()

        # Create order
        order = Order(
            reference=reference,
            user_id=user.id,
            status=initial_status,
            payment_status="pending",
            payment_method=payment_method,
            subtotal=subtotal,
            discount_amount=discount_amount,
            shipping_amount=shipping_amount,
            tax_amount=0,  # Tunisia VAT included in price
            total_amount=total_amount,
            shipping_method=shipping_method,
            shipping_address=self._serialize_address(shipping_address),
            coupon_id=coupon.id if coupon else None,
            notes=""
        )

        self.db.add(order)
        self.db.flush()  # Get order ID

        # Create order items
        for item_data in items:
            order_item = OrderItem(
                order_id=order.id,
                sku=item_data["sku"],
                title=item_data["title"],
                ean13=item_data.get("ean13", ""),
                unit_price=item_data["unit_price"],
                quantity=item_data["quantity"],
                total_price=item_data["unit_price"] * item_data["quantity"],
                variant_info=item_data.get("variant_info", {})
            )
            self.db.add(order_item)

        # Record coupon usage
        if coupon:
            coupon_usage = CouponUsage(
                coupon_id=coupon.id,
                user_id=user.id,
                order_id=order.id,
                discount_applied=discount_amount
            )
            self.db.add(coupon_usage)
            coupon.usage_count += 1

        # Add initial status history
        history = OrderStatusHistory(
            order_id=order.id,
            old_status=None,
            new_status=initial_status.value,
            changed_by=user.id,
            reason="Order created"
        )
        self.db.add(history)

        self.db.commit()
        self.db.refresh(order)

        logger.info(f"Order {reference} created for user {user.id}")
        return order

    def update_status(
        self,
        order_id: int,
        new_status: OrderStatus,
        changed_by: int,
        reason: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Order:
        """
        Update order status with validation and audit trail.

        Args:
            order_id: Order ID
            new_status: New status to set
            changed_by: User ID making the change
            reason: Reason for status change
            notes: Additional notes

        Returns:
            Updated Order instance

        Raises:
            OrderError: If transition is invalid
        """
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise OrderError("Order not found", "ORDER_NOT_FOUND")

        # Validate transition
        if not self._is_valid_transition(order.status, new_status):
            raise OrderError(
                f"Invalid status transition from {order.status.value} to {new_status.value}",
                "INVALID_TRANSITION"
            )

        old_status = order.status

        # Apply status change
        order.status = new_status
        order.updated_at = datetime.utcnow()

        # Handle special status effects
        if new_status == OrderStatus.SHIPPED:
            order.shipped_at = datetime.utcnow()
        elif new_status == OrderStatus.DELIVERED:
            order.delivered_at = datetime.utcnow()
        elif new_status == OrderStatus.CANCELLED:
            order.cancelled_at = datetime.utcnow()
            # Cancel any pending payments
            self._cancel_pending_payments(order.id)
            # Release coupon if used
            if order.coupon_id:
                self._release_coupon(order.id)

        # Record history
        history = OrderStatusHistory(
            order_id=order.id,
            old_status=old_status.value,
            new_status=new_status.value,
            changed_by=changed_by,
            reason=reason or f"Status changed to {new_status.value}",
            notes=notes
        )
        self.db.add(history)

        self.db.commit()
        self.db.refresh(order)

        logger.info(f"Order {order.reference} status changed: {old_status.value} -> {new_status.value}")
        return order

    def update_tracking(
        self,
        order_id: int,
        tracking_number: str,
        carrier_name: str,
        tracking_url: Optional[str] = None
    ) -> Order:
        """Update order tracking information"""
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise OrderError("Order not found", "ORDER_NOT_FOUND")

        order.tracking_number = tracking_number
        order.shipping_carrier = carrier_name
        order.tracking_url = tracking_url
        order.updated_at = datetime.utcnow()

        # If order was in READY status, move to SHIPPED
        if order.status == OrderStatus.READY:
            self.update_status(order_id, OrderStatus.SHIPPED, 0, "Tracking added")

        self.db.commit()
        self.db.refresh(order)

        return order

    def confirm_payment(self, order_id: int) -> Order:
        """
        Confirm payment received and update order status.
        Called after successful CTP payment.
        """
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise OrderError("Order not found", "ORDER_NOT_FOUND")

        if order.payment_status == "completed":
            logger.warning(f"Payment already completed for order {order.reference}")
            return order

        order.payment_status = "completed"
        order.paid_at = datetime.utcnow()

        # Move to confirmed status if payment was pending
        if order.status in [OrderStatus.PENDING, OrderStatus.PAYMENT_PENDING]:
            order.status = OrderStatus.CONFIRMED
            history = OrderStatusHistory(
                order_id=order.id,
                old_status=OrderStatus.PAYMENT_PENDING.value,
                new_status=OrderStatus.CONFIRMED.value,
                changed_by=0,
                reason="Payment confirmed"
            )
            self.db.add(history)

        self.db.commit()
        self.db.refresh(order)

        logger.info(f"Payment confirmed for order {order.reference}")
        return order

    def cancel_order(
        self,
        order_id: int,
        cancelled_by: int,
        reason: str
    ) -> Order:
        """Cancel order with full cleanup"""
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise OrderError("Order not found", "ORDER_NOT_FOUND")

        # Check if cancellable
        if order.status in [OrderStatus.DELIVERED, OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
            raise OrderError("Order cannot be cancelled", "CANNOT_CANCEL")

        return self.update_status(
            order_id,
            OrderStatus.CANCELLED,
            cancelled_by,
            reason=reason
        )

    def get_order_timeline(self, order_id: int) -> List[Dict]:
        """Get complete order status history"""
        history = self.db.query(OrderStatusHistory).filter(
            OrderStatusHistory.order_id == order_id
        ).order_by(OrderStatusHistory.created_at.asc()).all()

        return [
            {
                "old_status": h.old_status,
                "new_status": h.new_status,
                "reason": h.reason,
                "notes": h.notes,
                "changed_by": h.changed_by,
                "created_at": h.created_at.isoformat()
            }
            for h in history
        ]

    # ==================== PRIVATE METHODS ====================

    def _is_valid_transition(self, current: OrderStatus, new: OrderStatus) -> bool:
        """Check if status transition is valid"""
        valid_next = self.STATUS_TRANSITIONS.get(current, [])
        return new in valid_next

    def _calculate_shipping(self, subtotal: float, shipping_method: str) -> float:
        """Calculate shipping cost based on method and order value"""
        # Free shipping threshold
        if subtotal >= 150:
            return 0.0

        shipping_costs = {
            "1": 8.000,   # Standard delivery
            "2": 0.000,   # Store pickup
            "3": 12.000   # Express delivery
        }
        return shipping_costs.get(str(shipping_method), 8.000)

    def _validate_and_apply_coupon(
        self,
        code: str,
        user_id: int,
        subtotal: float
    ) -> Optional[Coupon]:
        """Validate coupon and check usage limits"""
        coupon = self.db.query(Coupon).filter(
            Coupon.code == code.upper(),
            Coupon.is_active == True
        ).first()

        if not coupon:
            logger.warning(f"Invalid coupon code: {code}")
            return None

        # Check expiration
        if coupon.expires_at and coupon.expires_at < datetime.utcnow():
            logger.warning(f"Coupon expired: {code}")
            return None

        # Check usage limit
        if coupon.usage_limit and coupon.usage_count >= coupon.usage_limit:
            logger.warning(f"Coupon usage limit reached: {code}")
            return None

        # Check user usage limit
        if coupon.per_user_limit:
            user_usage = self.db.query(CouponUsage).filter(
                CouponUsage.coupon_id == coupon.id,
                CouponUsage.user_id == user_id
            ).count()
            if user_usage >= coupon.per_user_limit:
                logger.warning(f"User usage limit reached for coupon: {code}")
                return None

        # Check minimum amount
        if coupon.min_amount and subtotal < coupon.min_amount:
            logger.warning(f"Order subtotal below coupon minimum: {code}")
            return None

        return coupon

    def _calculate_discount(self, coupon: Coupon, subtotal: float) -> float:
        """Calculate discount amount from coupon"""
        if coupon.discount_type.value == "percentage":
            discount = subtotal * (coupon.discount_value / 100)
            if coupon.max_discount:
                discount = min(discount, coupon.max_discount)
        else:  # fixed_amount
            discount = coupon.discount_value

        return round(discount, 3)

    def _generate_order_reference(self) -> str:
        """Generate unique order reference"""
        import random
        import string
        timestamp = datetime.utcnow().strftime("%y%m%d")
        random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        return f"BS-{timestamp}-{random_suffix}"

    def _serialize_address(self, address: Address) -> dict:
        """Serialize address to JSON-compatible dict"""
        if isinstance(address, dict):
            return address
        return {
            "street": address.street,
            "city": address.city,
            "state": address.state,
            "postal_code": address.postal_code,
            "country": address.country,
            "phone": address.phone
        }

    def _cancel_pending_payments(self, order_id: int):
        """Cancel any pending payments for an order"""
        pending_payments = self.db.query(Payment).filter(
            Payment.order_id == order_id,
            Payment.state.in_([PaymentState.INITIATED, PaymentState.PENDING])
        ).all()

        for payment in pending_payments:
            payment.state = PaymentState.FAILED
            payment.failure_reason = "Order cancelled"

    def _release_coupon(self, order_id: int):
        """Release coupon usage when order is cancelled"""
        usage = self.db.query(CouponUsage).filter(
            CouponUsage.order_id == order_id
        ).first()

        if usage:
            coupon = self.db.query(Coupon).filter(
                Coupon.id == usage.coupon_id
            ).first()
            if coupon and coupon.usage_count > 0:
                coupon.usage_count -= 1
            self.db.delete(usage)
