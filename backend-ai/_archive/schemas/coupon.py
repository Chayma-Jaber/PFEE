"""
Coupon Schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class CouponCreate(BaseModel):
    """Coupon creation schema"""
    code: str = Field(..., min_length=3, max_length=50)
    name: str
    description: Optional[str] = None
    discount_type: str  # percentage, fixed_amount, free_shipping
    discount_value: float = Field(..., gt=0)
    minimum_order_amount: Optional[float] = None
    maximum_discount_amount: Optional[float] = None
    usage_limit: Optional[int] = None
    usage_limit_per_user: int = 1
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True
    first_order_only: bool = False
    new_customers_only: bool = False
    applicable_category_ids: Optional[List[int]] = None
    applicable_product_ids: Optional[List[int]] = None
    excluded_product_ids: Optional[List[int]] = None


class CouponUpdate(BaseModel):
    """Coupon update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    minimum_order_amount: Optional[float] = None
    maximum_discount_amount: Optional[float] = None
    usage_limit: Optional[int] = None
    usage_limit_per_user: Optional[int] = None
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None
    first_order_only: Optional[bool] = None
    new_customers_only: Optional[bool] = None


class CouponValidate(BaseModel):
    """Coupon validation request"""
    code: str
    cart_total: float
    user_id: Optional[int] = None
    product_ids: Optional[List[int]] = None


class CouponValidateResponse(BaseModel):
    """Coupon validation response"""
    is_valid: bool
    discount_amount: float = 0
    message: Optional[str] = None
    coupon: Optional[dict] = None


class CouponResponse(BaseModel):
    """Coupon response schema"""
    id: int
    code: str
    name: str
    discount_type: str
    discount_value: float
    is_active: bool
    is_valid: bool
    usage_count: int
    usage_limit: Optional[int]
    starts_at: Optional[datetime]
    expires_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class CouponListResponse(BaseModel):
    """Coupon list response"""
    items: List[CouponResponse]
    total: int
    page: int
    per_page: int
    pages: int
