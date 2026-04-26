"""
Barsha E-Commerce Backend - Main Application
Professional Full-Stack Platform
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.database import create_tables, SessionLocal

# Import models to register them with SQLAlchemy Base
# This ensures tables are created when create_tables() is called
from app.models import user, order, coupon, return_request, product
from app.models import bundles  # Product bundles for deals
from app.models import product_qa  # Product Q&A
from app.models import wishlist  # Wishlist with collections support
from app.models import promotions  # Flash sales and promo codes
# Analytics models for recommendation and user preferences
try:
    from app.models import analytics
except ImportError:
    pass  # Analytics models may not exist yet

from app.routers import (
    auth_router,
    payment_router,
    orders_router,
    orders_compat_router,
    admin_dashboard_router,
    admin_orders_router,
    admin_products_router,
    admin_customers_router,
    admin_coupons_router,
    admin_returns_router,
    admin_content_router,
    referrals_router,
    promotions_router,
    admin_promotions_router,
    bundles_router,
    admin_bundles_router,
    newsletter_router,
    wishlist_collections_router,
    product_qa_router,
    admin_product_qa_router
)

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting Barsha E-Commerce Backend...")
    create_tables()
    logger.info("Database tables created/verified")

    # Create default admin user if not exists
    from app.models.user import User, UserRole
    from app.core.security import hash_password

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
        if not admin:
            admin = User(
                email=settings.ADMIN_EMAIL,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                first_name="Admin",
                last_name="Barsha",
                role=UserRole.SUPER_ADMIN,
                is_active=True,
                is_verified=True
            )
            db.add(admin)
            db.commit()
            logger.info(f"Default admin user created: {settings.ADMIN_EMAIL}")
    finally:
        db.close()

    logger.info("Barsha Backend ready!")
    yield
    # Shutdown
    logger.info("Shutting down Barsha Backend...")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Barsha E-Commerce Platform - Professional Backend API",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS + ["*"],  # Allow all for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc) if settings.DEBUG else None}
    )


# Health check endpoint
@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "online",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "environment": settings.ENVIRONMENT
    }


# Register routers
app.include_router(auth_router, prefix="/api")
app.include_router(payment_router)  # No prefix - uses /api/payment internally
app.include_router(orders_router)   # No prefix - uses /api/orders internally
app.include_router(orders_compat_router)  # Legacy endpoints like /api/getOrders
app.include_router(admin_dashboard_router, prefix="/api")
app.include_router(admin_orders_router, prefix="/api")
app.include_router(admin_products_router, prefix="/api")
app.include_router(admin_customers_router, prefix="/api")
app.include_router(admin_coupons_router, prefix="/api")
app.include_router(admin_returns_router, prefix="/api")
app.include_router(admin_content_router, prefix="/api")
app.include_router(referrals_router)  # No prefix - uses /api/referrals internally
app.include_router(promotions_router, prefix="/api")  # Flash sales and promo codes
app.include_router(admin_promotions_router, prefix="/api")  # Admin promotions management
app.include_router(bundles_router)  # No prefix - uses /api/bundles internally
app.include_router(admin_bundles_router)  # No prefix - uses /api/admin/bundles internally
app.include_router(newsletter_router, prefix="/api")  # Newsletter subscription
app.include_router(wishlist_collections_router)  # No prefix - uses /api/wishlist/collections internally
app.include_router(product_qa_router)  # No prefix - uses /api/products/{id}/questions internally
app.include_router(admin_product_qa_router)  # No prefix - uses /api/admin/qa internally


# API info endpoint
@app.get("/api", tags=["API Info"])
async def api_info():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "endpoints": {
            "auth": "/api/auth",
            "payment": "/api/payment",
            "orders": "/api/orders",
            "admin": {
                "dashboard": "/api/admin/dashboard",
                "orders": "/api/admin/orders",
                "products": "/api/admin/products",
                "customers": "/api/admin/customers",
                "coupons": "/api/admin/coupons",
                "returns": "/api/admin/returns",
                "content": "/api/admin/content"
            }
        },
        "documentation": "/api/docs" if settings.DEBUG else None
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,  # Main backend port
        reload=settings.DEBUG
    )
