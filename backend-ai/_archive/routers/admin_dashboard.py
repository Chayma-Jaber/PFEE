"""
Admin Dashboard Router
KPIs, statistics, and overview data
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import Optional

from app.core.database import get_db
from app.core.security import require_any_staff
from app.models.order import Order, OrderStatus, PaymentStatus
from app.models.user import User, UserRole
from app.models.product import Product, ProductVariant
from app.models.return_request import ReturnRequest, ReturnStatus
from app.models.coupon import Coupon

router = APIRouter(prefix="/admin/dashboard", tags=["Admin Dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    period: str = Query("month", enum=["today", "week", "month", "year"]),
    _: dict = Depends(require_any_staff),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics"""
    now = datetime.utcnow()

    # Calculate date range
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:  # year
        start_date = now - timedelta(days=365)

    # Order statistics
    total_orders = db.query(func.count(Order.id)).filter(
        Order.created_at >= start_date
    ).scalar() or 0

    pending_orders = db.query(func.count(Order.id)).filter(
        Order.status.in_([OrderStatus.PENDING, OrderStatus.PAYMENT_PENDING])
    ).scalar() or 0

    processing_orders = db.query(func.count(Order.id)).filter(
        Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.READY])
    ).scalar() or 0

    shipped_orders = db.query(func.count(Order.id)).filter(
        Order.status.in_([OrderStatus.SHIPPED, OrderStatus.IN_TRANSIT, OrderStatus.OUT_FOR_DELIVERY])
    ).scalar() or 0

    delivered_orders = db.query(func.count(Order.id)).filter(
        and_(
            Order.status == OrderStatus.DELIVERED,
            Order.created_at >= start_date
        )
    ).scalar() or 0

    cancelled_orders = db.query(func.count(Order.id)).filter(
        and_(
            Order.status == OrderStatus.CANCELLED,
            Order.created_at >= start_date
        )
    ).scalar() or 0

    # Revenue
    total_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.payment_status == PaymentStatus.COMPLETED,
            Order.created_at >= start_date
        )
    ).scalar() or 0

    average_order_value = db.query(func.avg(Order.total_amount)).filter(
        and_(
            Order.payment_status == PaymentStatus.COMPLETED,
            Order.created_at >= start_date
        )
    ).scalar() or 0

    # Customer statistics
    total_customers = db.query(func.count(User.id)).filter(
        User.role == UserRole.CUSTOMER
    ).scalar() or 0

    new_customers = db.query(func.count(User.id)).filter(
        and_(
            User.role == UserRole.CUSTOMER,
            User.created_at >= start_date
        )
    ).scalar() or 0

    # Product statistics
    total_products = db.query(func.count(Product.id)).filter(
        Product.is_active == True
    ).scalar() or 0

    low_stock_count = db.query(func.count(ProductVariant.id)).filter(
        and_(
            ProductVariant.quantity > 0,
            ProductVariant.quantity <= ProductVariant.low_stock_threshold,
            ProductVariant.is_active == True
        )
    ).scalar() or 0

    out_of_stock_count = db.query(func.count(ProductVariant.id)).filter(
        and_(
            ProductVariant.quantity == 0,
            ProductVariant.is_active == True
        )
    ).scalar() or 0

    # Return statistics
    pending_returns = db.query(func.count(ReturnRequest.id)).filter(
        ReturnRequest.status.in_([ReturnStatus.PENDING, ReturnStatus.UNDER_REVIEW])
    ).scalar() or 0

    # Active coupons
    active_coupons = db.query(func.count(Coupon.id)).filter(
        Coupon.is_active == True
    ).scalar() or 0

    return {
        "period": period,
        "orders": {
            "total": total_orders,
            "pending": pending_orders,
            "processing": processing_orders,
            "shipped": shipped_orders,
            "delivered": delivered_orders,
            "cancelled": cancelled_orders
        },
        "revenue": {
            "total": round(total_revenue, 3),
            "averageOrderValue": round(average_order_value, 3),
            "currency": "TND"
        },
        "customers": {
            "total": total_customers,
            "new": new_customers
        },
        "products": {
            "total": total_products,
            "lowStock": low_stock_count,
            "outOfStock": out_of_stock_count
        },
        "returns": {
            "pending": pending_returns
        },
        "coupons": {
            "active": active_coupons
        }
    }


@router.get("/recent-orders")
async def get_recent_orders(
    limit: int = Query(10, ge=1, le=50),
    _: dict = Depends(require_any_staff),
    db: Session = Depends(get_db)
):
    """Get recent orders for dashboard"""
    orders = db.query(Order).order_by(Order.created_at.desc()).limit(limit).all()

    return [order.to_dict(include_items=False) for order in orders]


@router.get("/top-products")
async def get_top_products(
    limit: int = Query(10, ge=1, le=50),
    period: str = Query("month", enum=["week", "month", "year"]),
    _: dict = Depends(require_any_staff),
    db: Session = Depends(get_db)
):
    """Get top selling products"""
    now = datetime.utcnow()

    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = now - timedelta(days=365)

    products = db.query(Product).filter(
        Product.is_active == True
    ).order_by(Product.order_count.desc()).limit(limit).all()

    return [product.to_dict(include_variants=False) for product in products]


@router.get("/low-stock-alerts")
async def get_low_stock_alerts(
    limit: int = Query(20, ge=1, le=100),
    _: dict = Depends(require_any_staff),
    db: Session = Depends(get_db)
):
    """Get low stock product variants"""
    variants = db.query(ProductVariant).filter(
        and_(
            ProductVariant.quantity > 0,
            ProductVariant.quantity <= ProductVariant.low_stock_threshold,
            ProductVariant.is_active == True
        )
    ).order_by(ProductVariant.quantity.asc()).limit(limit).all()

    result = []
    for variant in variants:
        product = variant.product
        result.append({
            "variantId": variant.id,
            "productId": product.id if product else None,
            "productTitle": product.title if product else "Unknown",
            "sku": product.sku if product else variant.ean13,
            "color": variant.color,
            "size": variant.size,
            "quantity": variant.quantity,
            "threshold": variant.low_stock_threshold
        })

    return result


@router.get("/recent-activity")
async def get_recent_activity(
    limit: int = Query(20, ge=1, le=50),
    _: dict = Depends(require_any_staff),
    db: Session = Depends(get_db)
):
    """Get recent admin activity feed"""
    from app.models.admin_log import AdminActivityLog

    logs = db.query(AdminActivityLog).order_by(
        AdminActivityLog.created_at.desc()
    ).limit(limit).all()

    return [log.to_dict() for log in logs]


@router.get("/sales-chart")
async def get_sales_chart_data(
    period: str = Query("month", enum=["week", "month", "year"]),
    _: dict = Depends(require_any_staff),
    db: Session = Depends(get_db)
):
    """Get sales data for chart visualization"""
    now = datetime.utcnow()

    if period == "week":
        start_date = now - timedelta(days=7)
        group_format = "%Y-%m-%d"
    elif period == "month":
        start_date = now - timedelta(days=30)
        group_format = "%Y-%m-%d"
    else:
        start_date = now - timedelta(days=365)
        group_format = "%Y-%m"

    # This is a simplified version - in production you'd use proper SQL date grouping
    orders = db.query(Order).filter(
        and_(
            Order.payment_status == PaymentStatus.COMPLETED,
            Order.created_at >= start_date
        )
    ).order_by(Order.created_at.asc()).all()

    # Group by date
    data = {}
    for order in orders:
        date_key = order.created_at.strftime(group_format)
        if date_key not in data:
            data[date_key] = {"date": date_key, "revenue": 0, "orders": 0}
        data[date_key]["revenue"] += order.total_amount
        data[date_key]["orders"] += 1

    return list(data.values())
