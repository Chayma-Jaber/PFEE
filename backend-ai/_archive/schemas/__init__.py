# Schemas module
from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest, TokenResponse
from app.schemas.user import UserCreate, UserUpdate, UserResponse, AddressCreate, AddressUpdate
from app.schemas.order import OrderCreate, OrderUpdate, OrderResponse, OrderItemCreate
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.schemas.coupon import CouponCreate, CouponUpdate, CouponValidate
from app.schemas.return_request import ReturnRequestCreate, ReturnRequestUpdate

__all__ = [
    "LoginRequest", "LoginResponse", "RegisterRequest", "TokenResponse",
    "UserCreate", "UserUpdate", "UserResponse", "AddressCreate", "AddressUpdate",
    "OrderCreate", "OrderUpdate", "OrderResponse", "OrderItemCreate",
    "ProductCreate", "ProductUpdate", "ProductResponse",
    "CouponCreate", "CouponUpdate", "CouponValidate",
    "ReturnRequestCreate", "ReturnRequestUpdate"
]
