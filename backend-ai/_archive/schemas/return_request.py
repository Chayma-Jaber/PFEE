"""
Return Request Schemas
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ReturnItem(BaseModel):
    """Return item schema"""
    order_item_id: int
    quantity: int


class ReturnRequestCreate(BaseModel):
    """Return request creation schema"""
    order_id: int
    reason: str  # wrong_size, defective, not_as_described, etc.
    reason_details: Optional[str] = None
    items: List[ReturnItem]
    photos: Optional[List[str]] = None
    customer_notes: Optional[str] = None


class ReturnRequestUpdate(BaseModel):
    """Return request update schema (admin)"""
    status: Optional[str] = None
    admin_notes: Optional[str] = None
    resolution_notes: Optional[str] = None
    refund_amount: Optional[float] = None
    refund_method: Optional[str] = None
    assigned_to: Optional[int] = None
    return_shipping_label: Optional[str] = None
    return_tracking_number: Optional[str] = None


class ReturnStatusUpdate(BaseModel):
    """Return status update schema"""
    status: str
    notes: Optional[str] = None


class ReturnRequestResponse(BaseModel):
    """Return request response schema"""
    id: int
    reference: str
    order_id: int
    user_id: int
    status: str
    reason: str
    reason_details: Optional[str]
    items: List[dict]
    refund_amount: Optional[float]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ReturnListResponse(BaseModel):
    """Return list response"""
    items: List[ReturnRequestResponse]
    total: int
    page: int
    per_page: int
    pages: int
