"""
Authentication Router
Login, registration, and token management
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import (
    verify_password, hash_password, create_access_token,
    create_refresh_token, decode_token, get_current_user_id
)
from app.core.config import settings
from app.models.user import User, UserRole
from app.schemas.auth import (
    LoginRequest, LoginResponse, RegisterRequest, TokenResponse,
    ChangePasswordRequest, RefreshTokenRequest
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ========================
# Dependencies
# ========================

async def get_current_user_from_token(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
) -> User:
    """Get the current user from the JWT token"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return user


async def get_current_admin(
    user: User = Depends(get_current_user_from_token)
) -> User:
    """Get the current admin user - requires staff/admin role"""
    if user.role == UserRole.CUSTOMER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user


# Alias for backwards compatibility - dependency to get current user (optional)
async def get_current_user(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
) -> User:
    """Get the current user from JWT token - dependency version"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return user


from typing import Optional
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security_optional = HTTPBearer(auto_error=False)

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get current user from JWT token if provided, otherwise return None.
    Use this for endpoints that work both for logged-in and anonymous users.
    """
    if not credentials:
        return None

    try:
        token = credentials.credentials
        payload = decode_token(token)
        if not payload:
            return None

        user_id = payload.get("sub")
        if not user_id:
            return None

        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user or not user.is_active:
            return None

        return user
    except Exception:
        return None


# ========================
# Routes
# ========================

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with email/phone and password"""
    import logging
    logger = logging.getLogger(__name__)

    # Find user
    user = None
    if request.email:
        logger.info(f"LOGIN: Looking for user with email: {request.email}")
        user = db.query(User).filter(User.email == request.email).first()
    elif request.phone:
        user = db.query(User).filter(User.phone == request.phone).first()

    if not user:
        logger.warning(f"LOGIN: User not found for email: {request.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    logger.info(f"LOGIN: Found user {user.email}, checking password")
    password_valid = verify_password(request.password, user.password_hash)
    logger.info(f"LOGIN: Password valid: {password_valid}")

    if not user.password_hash or not password_valid:
        logger.warning(f"LOGIN: Password verification failed for {user.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Update login stats
    user.last_login = datetime.utcnow()
    user.login_count = (user.login_count or 0) + 1
    db.commit()

    # Generate tokens
    token_data = {"sub": str(user.id), "role": user.role.value}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return LoginResponse(
        user=user.to_dict(),
        tokens=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    )


@router.post("/register", response_model=LoginResponse)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check for existing user
    if request.email:
        existing = db.query(User).filter(User.email == request.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

    if request.phone:
        existing = db.query(User).filter(User.phone == request.phone).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number already registered"
            )

    # Create user
    user = User(
        email=request.email,
        phone=request.phone,
        password_hash=hash_password(request.password),
        first_name=request.first_name,
        last_name=request.last_name,
        role=UserRole.CUSTOMER,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Generate tokens
    token_data = {"sub": str(user.id), "role": user.role.value}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return LoginResponse(
        user=user.to_dict(),
        tokens=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Refresh access token using refresh token"""
    payload = decode_token(request.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    # Generate new tokens
    token_data = {"sub": str(user.id), "role": user.role.value}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Change user password"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(request.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    user.password_hash = hash_password(request.new_password)
    db.commit()

    return {"message": "Password changed successfully"}


@router.get("/me")
async def get_current_user(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get current user profile"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user.to_dict()


@router.put("/profile")
async def update_profile(
    updates: dict,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update user profile"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Allowed fields to update
    allowed_fields = ['first_name', 'last_name', 'phone', 'gender', 'birthday', 'firstName', 'lastName']

    for key, value in updates.items():
        # Handle camelCase to snake_case conversion
        if key == 'firstName':
            user.first_name = value
        elif key == 'lastName':
            user.last_name = value
        elif key in allowed_fields and hasattr(user, key):
            setattr(user, key, value)

    db.commit()
    db.refresh(user)

    return user.to_dict()


@router.delete("/account")
async def delete_account(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete user account"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Soft delete - just mark as inactive
    user.is_active = False
    db.commit()

    return {"message": "Account deleted successfully"}


@router.post("/admin/login", response_model=LoginResponse)
async def admin_login(request: LoginRequest, db: Session = Depends(get_db)):
    """Admin login - same as regular login but enforces staff role"""
    # First perform regular login
    response = await login(request, db)

    # Check if user is staff by looking at the role in the response
    user_role = response.user.get("role", "customer")
    if user_role == "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return response
