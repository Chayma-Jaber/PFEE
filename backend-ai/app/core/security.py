"""
Security Module
JWT token handling, password hashing, authentication, and RBAC
Implements secure token management and role-based access control
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token scheme
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: Dict[str, Any]) -> str:
    """Create a JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh"
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> int:
    """Extract user ID from JWT token"""
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    return int(user_id)


def get_current_user_role(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Extract user role from JWT token"""
    payload = decode_token(credentials.credentials)
    return payload.get("role", "customer")


class RoleChecker:
    """Dependency class to check user roles"""

    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles

    def __call__(self, credentials: HTTPAuthorizationCredentials = Depends(security)):
        payload = decode_token(credentials.credentials)
        role = payload.get("role", "customer")
        if role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(self.allowed_roles)}"
            )
        return payload


# Pre-defined role checkers
require_admin = RoleChecker(["super_admin", "admin"])
require_catalog_manager = RoleChecker(["super_admin", "admin", "catalog_manager"])
require_order_manager = RoleChecker(["super_admin", "admin", "order_manager"])
require_marketing_manager = RoleChecker(["super_admin", "admin", "marketing_manager"])
require_support_agent = RoleChecker(["super_admin", "admin", "support_agent"])
require_any_staff = RoleChecker(["super_admin", "admin", "catalog_manager", "order_manager", "marketing_manager", "support_agent"])


# ─────────────────────────────────────────────────────────────
# USER RETRIEVAL (requires database session)
# ─────────────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    Extract and return user data from JWT token.
    Returns a dict with user_id, email, role, and other claims.
    For full User model, use get_current_user_from_db with a database session.
    """
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user identifier"
        )

    return {
        "id": int(user_id),
        "email": payload.get("email"),
        "role": payload.get("role", "customer"),
        "first_name": payload.get("first_name"),
        "last_name": payload.get("last_name")
    }


def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[Dict[str, Any]]:
    """
    Extract user data if token is present, return None otherwise.
    Useful for endpoints that work for both authenticated and anonymous users.
    """
    if credentials is None:
        return None
    try:
        return get_current_user(credentials)
    except HTTPException:
        return None


# ─────────────────────────────────────────────────────────────
# SECURITY LOGGING
# ─────────────────────────────────────────────────────────────

def log_security_event(
    event_type: str,
    user_id: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None
):
    """
    Log security-relevant events for audit trail.
    Events: login, logout, failed_login, password_change, admin_action, etc.
    """
    log_data = {
        "event_type": event_type,
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
        "details": details or {}
    }

    if request:
        log_data["ip"] = request.client.host if request.client else "unknown"
        log_data["user_agent"] = request.headers.get("user-agent", "unknown")[:200]

    logger.info(f"SECURITY_EVENT: {log_data}")


# ─────────────────────────────────────────────────────────────
# PASSWORD VALIDATION
# ─────────────────────────────────────────────────────────────

def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password meets security requirements.
    Returns (is_valid, message).
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"
    return True, "Password is valid"


# ─────────────────────────────────────────────────────────────
# ADMIN VERIFICATION
# ─────────────────────────────────────────────────────────────

def verify_admin_access(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    Verify user has admin privileges and return user data.
    Raises 403 if not admin.
    """
    user = get_current_user(credentials)
    if user["role"] not in ["super_admin", "admin"]:
        log_security_event(
            "unauthorized_admin_access",
            user_id=user["id"],
            details={"attempted_role": user["role"]}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user


# Aliases for compatibility
get_optional_user = get_optional_current_user
