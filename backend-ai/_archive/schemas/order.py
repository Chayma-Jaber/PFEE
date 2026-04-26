"""
Order Schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class OrderItemCreate(BaseModel):
    """Order item creation schema"""
    product_id: int
    variant_id: Optional[int] = None
    sku: str
    title: str
    image_url: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    ean13: Optional[str] = None
    unit_price: float
    quantity: int = Field(..., ge=1)


class ShippingAddress(BaseModel):
    """Shipping address schema"""
    first_name: str
    last_name: str
    phone: str
    street: str
    street2: Optional[str] = None
    city: str
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "Tunisie"


class OrderCreate(BaseModel):
    """Order creation schema"""
    items: List[OrderItemCreate]
    shipping_address: ShippingAddress
    billing_same_as_shipping: bool = True
    shipping_method: str
    payment_method: str = "ctp"
    coupon_code: Optional[str] = None
    customer_notes: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None


class OrderUpdate(BaseModel):
    """Order update schema (admin)"""
    status: Optional[str] = None
    payment_status: Optional[str] = None
    shipping_carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    admin_notes: Optional[str] = None
    internal_notes: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    """Order status update schema"""
    status: str
    reason: Optional[str] = None
    notes: Optional[str] = None


class OrderResponse(BaseModel):
    """Order response schema"""
    id: int
    reference: str
    user_id: Optional[int]
    status: str
    payment_status: str
    subtotal: float
    discount_amount: float
    shipping_amount: float
    total_amount: float
    coupon_code: Optional[str]
    items: List[dict]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    """Order list response"""
    items: List[OrderResponse]
    total: int
    page: int
    per_page: int
    pages: int


class OrderStatsResponse(BaseModel):
    """Order statistics response"""
    total_orders: int
    pending_orders: int
    processing_orders: int
    shipped_orders: int
    delivered_orders: int
    cancelled_orders: int
    total_revenue: float
    average_order_value: float
