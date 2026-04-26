"""
User Schemas
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


class AddressCreate(BaseModel):
    """Address creation schema"""
    label: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    street: str
    street2: Optional[str] = None
    city: str
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "Tunisie"
    is_default: bool = False
    is_billing: bool = False
    is_shipping: bool = True


class AddressUpdate(BaseModel):
    """Address update schema"""
    label: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    street: Optional[str] = None
    street2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    is_default: Optional[bool] = None
    is_billing: Optional[bool] = None
    is_shipping: Optional[bool] = None


class UserCreate(BaseModel):
    """User creation schema"""
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str = Field(..., min_length=6)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    role: str = "customer"


class UserUpdate(BaseModel):
    """User update schema"""
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    avatar_url: Optional[str] = None
    newsletter_subscribed: Optional[bool] = None
    preferred_language: Optional[str] = None
    selected_gender: Optional[str] = None


class UserAdminUpdate(BaseModel):
    """Admin user update schema"""
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    admin_notes: Optional[str] = None


class UserResponse(BaseModel):
    """User response schema"""
    id: int
    email: Optional[str]
    phone: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: Optional[datetime]
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """User list response"""
    items: List[UserResponse]
    total: int
    page: int
    per_page: int
    pages: int
