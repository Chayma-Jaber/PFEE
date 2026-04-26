"""
Product Schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ProductVariantCreate(BaseModel):
    """Product variant creation schema"""
    color: Optional[str] = None
    color_code: Optional[str] = None
    texture_url: Optional[str] = None
    size: Optional[str] = None
    ean13: Optional[str] = None
    quantity: int = 0
    price_adjustment: float = 0


class ProductVariantUpdate(BaseModel):
    """Product variant update schema"""
    color: Optional[str] = None
    color_code: Optional[str] = None
    texture_url: Optional[str] = None
    size: Optional[str] = None
    ean13: Optional[str] = None
    quantity: Optional[int] = None
    price_adjustment: Optional[float] = None
    is_active: Optional[bool] = None


class ProductCreate(BaseModel):
    """Product creation schema"""
    sku: str
    title: str
    slug: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    price: float = Field(..., gt=0)
    current_price: Optional[float] = None
    cost_price: Optional[float] = None
    discount: bool = False
    discount_value: int = 0
    famille: Optional[str] = None
    ligne: Optional[str] = None
    persona: Optional[str] = None
    is_active: bool = True
    is_new: bool = False
    is_featured: bool = False
    first_image_url: Optional[str] = None
    second_image_url: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    composition: Optional[str] = None
    category_ids: Optional[List[int]] = None
    variants: Optional[List[ProductVariantCreate]] = None


class ProductUpdate(BaseModel):
    """Product update schema"""
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    price: Optional[float] = None
    current_price: Optional[float] = None
    cost_price: Optional[float] = None
    discount: Optional[bool] = None
    discount_value: Optional[int] = None
    famille: Optional[str] = None
    ligne: Optional[str] = None
    persona: Optional[str] = None
    is_active: Optional[bool] = None
    is_available: Optional[bool] = None
    is_new: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_bestseller: Optional[bool] = None
    first_image_url: Optional[str] = None
    second_image_url: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    composition: Optional[str] = None
    category_ids: Optional[List[int]] = None


class ProductResponse(BaseModel):
    """Product response schema"""
    id: int
    sku: str
    title: str
    slug: str
    price: float
    current_price: float
    discount: bool
    discount_value: int
    famille: Optional[str]
    is_active: bool
    is_available: bool
    is_new: bool
    is_featured: bool
    total_stock: int
    first_image_url: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    """Product list response"""
    items: List[ProductResponse]
    total: int
    page: int
    per_page: int
    pages: int


class CategoryCreate(BaseModel):
    """Category creation schema"""
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None
    image_url: Optional[str] = None
    banner_url: Optional[str] = None
    position: int = 0
    is_active: bool = True
    is_featured: bool = False
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None


class CategoryUpdate(BaseModel):
    """Category update schema"""
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None
    image_url: Optional[str] = None
    banner_url: Optional[str] = None
    position: Optional[int] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
