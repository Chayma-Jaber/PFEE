"""
Public Orders Router - Customer-facing Order Operations
Handles order creation, status checking, and order history for authenticated users
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

from ..core.database import get_db
from ..core.security import get_current_user, get_optional_user
from ..models.user import User, Address
from ..models.order import Order, OrderItem, OrderStatus
from ..services.order_service import OrderService, OrderError

router = APIRouter(prefix="/api/orders", tags=["Orders"])

# Compatibility router for legacy endpoints
compat_router = APIRouter(prefix="/api", tags=["Orders Compatibility"])


# ===================== SCHEMAS =====================

class OrderItemRequest(BaseModel):
    sku: str
    title: str
    ean13: Optional[str] = ""
    unit_price: float
    quantity: int
    variant_info: Optional[Dict[str, Any]] = None


class ShippingAddressRequest(BaseModel):
    street: str
    city: str
    state: Optional[str] = ""
    postal_code: Optional[str] = ""
    country: str = "Tunisia"
    phone: str


class CreateOrderRequest(BaseModel):
    items: List[OrderItemRequest]
    shipping_address: ShippingAddressRequest
    shipping_method: str = "1"  # 1=home, 2=store
    payment_method: str = "ctp"  # ctp, cod
    coupon_code: Optional[str] = None
    notes: Optional[str] = ""


class OrderResponse(BaseModel):
    id: int
    reference: str
    status: str
    payment_status: str
    subtotal: float
    discount_amount: float
    shipping_amount: float
    total_amount: float
    created_at: datetime
    items: List[Dict[str, Any]]


class OrderListResponse(BaseModel):
    items: List[OrderResponse]
    total: int
    page: int
    pages: int


# ===================== ENDPOINTS =====================

@router.post("/create", response_model=OrderResponse)
async def create_order(
    request: CreateOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new order for the authenticated user.
    Returns order details including ID for payment initiation.
    """
    order_service = OrderService(db)

    # Convert request items to dict list
    items = [
        {
            "sku": item.sku,
            "title": item.title,
            "ean13": item.ean13,
            "unit_price": item.unit_price,
            "quantity": item.quantity,
            "variant_info": item.variant_info or {}
        }
        for item in request.items
    ]

    # Convert shipping address
    shipping_address = {
        "street": request.shipping_address.street,
        "city": request.shipping_address.city,
        "state": request.shipping_address.state,
        "postal_code": request.shipping_address.postal_code,
        "country": request.shipping_address.country,
        "phone": request.shipping_address.phone
    }

    try:
        order = order_service.create_order(
            user=current_user,
            items=items,
            shipping_address=shipping_address,
            shipping_method=request.shipping_method,
            payment_method=request.payment_method,
            coupon_code=request.coupon_code
        )

        # Load order items
        order_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()

        return OrderResponse(
            id=order.id,
            reference=order.reference,
            status=order.status.value,
            payment_status=order.payment_status,
            subtotal=order.subtotal,
            discount_amount=order.discount_amount,
            shipping_amount=order.shipping_amount,
            total_amount=order.total_amount,
            created_at=order.created_at,
            items=[
                {
                    "sku": item.sku,
                    "title": item.title,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "total_price": item.total_price
                }
                for item in order_items
            ]
        )

    except OrderError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/my-orders", response_model=OrderListResponse)
async def get_my_orders(
    page: int = 1,
    per_page: int = 10,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get order history for authenticated user"""
    query = db.query(Order).filter(Order.user_id == current_user.id)

    if status:
        query = query.filter(Order.status == status)

    total = query.count()
    pages = (total + per_page - 1) // per_page

    orders = query.order_by(Order.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return OrderListResponse(
        items=[
            OrderResponse(
                id=order.id,
                reference=order.reference,
                status=order.status.value,
                payment_status=order.payment_status,
                subtotal=order.subtotal,
                discount_amount=order.discount_amount,
                shipping_amount=order.shipping_amount,
                total_amount=order.total_amount,
                created_at=order.created_at,
                items=[
                    {
                        "sku": item.sku,
                        "title": item.title,
                        "quantity": item.quantity,
                        "unit_price": item.unit_price,
                        "total_price": item.total_price
                    }
                    for item in order.items
                ]
            )
            for order in orders
        ],
        total=total,
        page=page,
        pages=pages
    )


@router.get("/{order_id}")
async def get_order_details(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed order information"""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Get items
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()

    # Get timeline
    order_service = OrderService(db)
    timeline = order_service.get_order_timeline(order.id)

    return {
        "id": order.id,
        "reference": order.reference,
        "status": order.status.value,
        "payment_status": order.payment_status,
        "payment_method": order.payment_method,
        "subtotal": order.subtotal,
        "discount_amount": order.discount_amount,
        "shipping_amount": order.shipping_amount,
        "total_amount": order.total_amount,
        "shipping_address": order.shipping_address,
        "shipping_method": order.shipping_method,
        "tracking_number": order.tracking_number,
        "tracking_url": order.tracking_url,
        "shipping_carrier": order.shipping_carrier,
        "created_at": order.created_at.isoformat(),
        "shipped_at": order.shipped_at.isoformat() if order.shipped_at else None,
        "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
        "items": [
            {
                "sku": item.sku,
                "title": item.title,
                "ean13": item.ean13,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item.total_price,
                "variant_info": item.variant_info
            }
            for item in items
        ],
        "timeline": timeline
    }


@router.get("/reference/{reference}")
async def get_order_by_reference(
    reference: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get order by reference number"""
    order = db.query(Order).filter(
        Order.reference == reference,
        Order.user_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return await get_order_details(order.id, db, current_user)


@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: int,
    reason: str = "Customer requested cancellation",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel an order (only if still pending)"""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Only allow cancellation of pending orders
    if order.status not in [OrderStatus.PENDING, OrderStatus.PAYMENT_PENDING, OrderStatus.CONFIRMED]:
        raise HTTPException(
            status_code=400,
            detail="Order cannot be cancelled at this stage"
        )

    order_service = OrderService(db)

    try:
        order = order_service.cancel_order(
            order_id=order.id,
            cancelled_by=current_user.id,
            reason=reason
        )

        return {
            "success": True,
            "message": "Order cancelled successfully",
            "order_reference": order.reference,
            "status": order.status.value
        }

    except OrderError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/{order_id}/track")
async def track_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get tracking information for an order"""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order_service = OrderService(db)
    timeline = order_service.get_order_timeline(order.id)

    return {
        "order_reference": order.reference,
        "status": order.status.value,
        "tracking_number": order.tracking_number,
        "tracking_url": order.tracking_url,
        "carrier": order.shipping_carrier,
        "shipped_at": order.shipped_at.isoformat() if order.shipped_at else None,
        "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
        "estimated_delivery": None,  # Can be calculated based on carrier and shipping method
        "timeline": timeline
    }


# ===================== COMPATIBILITY ENDPOINTS =====================
# These endpoints maintain compatibility with the existing frontend

@compat_router.get("/getOrders")
async def get_orders_legacy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Legacy endpoint: Get orders for authenticated user
    Returns format expected by the existing frontend
    """
    orders = db.query(Order).filter(
        Order.user_id == current_user.id
    ).order_by(Order.created_at.desc()).all()

    return {
        "status": 200,
        "data": [
            {
                "id": order.id,
                "reference": order.reference,
                "status": order.status.value,
                "paymentStatus": order.payment_status,
                "paymentStatusId": 7 if order.payment_status == "pending" else 5 if order.payment_status == "completed" else 3,
                "subtotal": order.subtotal,
                "discountAmount": order.discount_amount,
                "shippingAmount": order.shipping_amount,
                "totalAmount": order.total_amount,
                "createdAt": order.created_at.isoformat(),
                "shippedAt": order.shipped_at.isoformat() if order.shipped_at else None,
                "deliveredAt": order.delivered_at.isoformat() if order.delivered_at else None,
                "items": [
                    {
                        "id": item.id,
                        "sku": item.sku,
                        "title": item.title,
                        "quantity": item.quantity,
                        "unitPrice": item.unit_price,
                        "totalPrice": item.total_price,
                        "image": item.image_url or ""
                    }
                    for item in order.items
                ]
            }
            for order in orders
        ]
    }


@compat_router.get("/getOrderById/{order_id}")
async def get_order_by_id_legacy(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Legacy endpoint: Get order by ID"""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return {
        "status": 200,
        "data": {
            "id": order.id,
            "reference": order.reference,
            "status": order.status.value,
            "paymentStatus": order.payment_status,
            "subtotal": order.subtotal,
            "discountAmount": order.discount_amount,
            "shippingAmount": order.shipping_amount,
            "totalAmount": order.total_amount,
            "shippingAddress": order.shipping_address,
            "trackingNumber": order.tracking_number,
            "createdAt": order.created_at.isoformat(),
            "items": [
                {
                    "id": item.id,
                    "sku": item.sku,
                    "title": item.title,
                    "quantity": item.quantity,
                    "unitPrice": item.unit_price,
                    "totalPrice": item.total_price,
                    "image": item.image_url or ""
                }
                for item in order.items
            ]
        }
    }
