"""
Admin Reports Router
Generate and manage business reports for the admin back-office
"""
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from io import StringIO
import csv
import json

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.user import User, UserRole
from ..models.order import Order, OrderItem, OrderStatus, PaymentStatus
from ..models.coupon import Coupon, CouponUsage
from ..models.return_request import ReturnRequest, ReturnStatus

router = APIRouter(prefix="/admin/reports", tags=["Admin Reports"])


# ===================== SCHEMAS =====================

class ReportPeriod(BaseModel):
    start_date: Optional[str] = None  # ISO date string
    end_date: Optional[str] = None
    period: str = "30d"  # 7d, 30d, 90d, 365d, custom


class ReportResponse(BaseModel):
    report_type: str
    period: str
    generated_at: str
    data: dict


# ===================== HELPER FUNCTIONS =====================

def get_date_range(period: str, start_date: str = None, end_date: str = None):
    """Calculate date range based on period or custom dates"""
    now = datetime.utcnow()

    if period == "custom" and start_date and end_date:
        return datetime.fromisoformat(start_date), datetime.fromisoformat(end_date)

    period_map = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "365d": 365
    }

    days = period_map.get(period, 30)
    return now - timedelta(days=days), now


# ===================== SALES REPORT =====================

@router.get("/sales")
async def generate_sales_report(
    period: str = "30d",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate sales report with revenue, orders, and trends"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Admin access required")

    start, end = get_date_range(period, start_date, end_date)

    # Get orders in period
    orders = db.query(Order).filter(
        and_(
            Order.created_at >= start,
            Order.created_at <= end
        )
    ).all()

    # Calculate metrics
    total_orders = len(orders)
    total_revenue = sum(o.total_amount or 0 for o in orders if o.status != OrderStatus.CANCELLED)
    completed_orders = len([o for o in orders if o.status == OrderStatus.DELIVERED])
    cancelled_orders = len([o for o in orders if o.status == OrderStatus.CANCELLED])
    pending_orders = len([o for o in orders if o.status in [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING]])

    # Average order value
    avg_order_value = total_revenue / completed_orders if completed_orders > 0 else 0

    # Daily breakdown
    daily_sales = {}
    for order in orders:
        if order.status != OrderStatus.CANCELLED:
            day = order.created_at.strftime("%Y-%m-%d")
            if day not in daily_sales:
                daily_sales[day] = {"orders": 0, "revenue": 0}
            daily_sales[day]["orders"] += 1
            daily_sales[day]["revenue"] += order.total_amount or 0

    # Payment method breakdown
    payment_methods = {}
    for order in orders:
        method = order.payment_method or "unknown"
        if method not in payment_methods:
            payment_methods[method] = {"count": 0, "amount": 0}
        payment_methods[method]["count"] += 1
        payment_methods[method]["amount"] += order.total_amount or 0

    return {
        "reportType": "sales",
        "period": period,
        "dateRange": {
            "start": start.isoformat(),
            "end": end.isoformat()
        },
        "generatedAt": datetime.utcnow().isoformat(),
        "summary": {
            "totalOrders": total_orders,
            "totalRevenue": round(total_revenue, 2),
            "completedOrders": completed_orders,
            "cancelledOrders": cancelled_orders,
            "pendingOrders": pending_orders,
            "averageOrderValue": round(avg_order_value, 2),
            "conversionRate": round((completed_orders / total_orders * 100) if total_orders > 0 else 0, 1)
        },
        "dailySales": [
            {"date": date, "orders": data["orders"], "revenue": round(data["revenue"], 2)}
            for date, data in sorted(daily_sales.items())
        ],
        "paymentMethods": [
            {"method": method, "count": data["count"], "amount": round(data["amount"], 2)}
            for method, data in payment_methods.items()
        ]
    }


# ===================== CUSTOMERS REPORT =====================

@router.get("/customers")
async def generate_customers_report(
    period: str = "30d",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate customer analytics report"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Admin access required")

    start, end = get_date_range(period, start_date, end_date)

    # New customers in period
    new_customers = db.query(User).filter(
        and_(
            User.role == UserRole.CUSTOMER,
            User.created_at >= start,
            User.created_at <= end
        )
    ).count()

    # Total customers
    total_customers = db.query(User).filter(User.role == UserRole.CUSTOMER).count()

    # Active customers (logged in during period)
    active_customers = db.query(User).filter(
        and_(
            User.role == UserRole.CUSTOMER,
            User.last_login >= start
        )
    ).count()

    # Top customers by spending
    top_customers = db.query(
        User.id,
        User.first_name,
        User.last_name,
        User.email,
        func.sum(Order.total_amount).label("total_spent"),
        func.count(Order.id).label("order_count")
    ).join(Order, Order.user_id == User.id).filter(
        and_(
            Order.created_at >= start,
            Order.status != OrderStatus.CANCELLED
        )
    ).group_by(User.id).order_by(func.sum(Order.total_amount).desc()).limit(10).all()

    # Customer acquisition by day
    daily_signups = {}
    customers = db.query(User).filter(
        and_(
            User.role == UserRole.CUSTOMER,
            User.created_at >= start,
            User.created_at <= end
        )
    ).all()

    for customer in customers:
        day = customer.created_at.strftime("%Y-%m-%d")
        daily_signups[day] = daily_signups.get(day, 0) + 1

    return {
        "reportType": "customers",
        "period": period,
        "dateRange": {
            "start": start.isoformat(),
            "end": end.isoformat()
        },
        "generatedAt": datetime.utcnow().isoformat(),
        "summary": {
            "totalCustomers": total_customers,
            "newCustomers": new_customers,
            "activeCustomers": active_customers,
            "growthRate": round((new_customers / total_customers * 100) if total_customers > 0 else 0, 1)
        },
        "topCustomers": [
            {
                "id": c.id,
                "name": f"{c.first_name or ''} {c.last_name or ''}".strip(),
                "email": c.email,
                "totalSpent": round(float(c.total_spent or 0), 2),
                "orderCount": c.order_count
            }
            for c in top_customers
        ],
        "dailySignups": [
            {"date": date, "count": count}
            for date, count in sorted(daily_signups.items())
        ]
    }


# ===================== PRODUCTS REPORT =====================

@router.get("/products")
async def generate_products_report(
    period: str = "30d",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate product performance report"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Admin access required")

    start, end = get_date_range(period, start_date, end_date)

    # Top selling products
    top_products = db.query(
        OrderItem.product_id,
        OrderItem.title,
        func.sum(OrderItem.quantity).label("total_qty"),
        func.sum(OrderItem.total_price).label("total_revenue")
    ).join(Order, Order.id == OrderItem.order_id).filter(
        and_(
            Order.created_at >= start,
            Order.status != OrderStatus.CANCELLED
        )
    ).group_by(OrderItem.product_id, OrderItem.title).order_by(
        func.sum(OrderItem.quantity).desc()
    ).limit(20).all()

    # Category breakdown (using title to infer category)
    category_sales = {}
    order_items = db.query(OrderItem).join(Order).filter(
        and_(
            Order.created_at >= start,
            Order.status != OrderStatus.CANCELLED
        )
    ).all()

    for item in order_items:
        # Infer category from product title
        title_lower = (item.title or "").lower()
        if any(k in title_lower for k in ["t-shirt", "tshirt", "t shirt"]):
            cat = "T-Shirts"
        elif any(k in title_lower for k in ["pantalon", "jean", "jeans"]):
            cat = "Pantalons"
        elif any(k in title_lower for k in ["robe", "dress"]):
            cat = "Robes"
        elif any(k in title_lower for k in ["sac", "bag", "sacoche"]):
            cat = "Sacs"
        elif any(k in title_lower for k in ["chaussure", "basket", "shoe"]):
            cat = "Chaussures"
        else:
            cat = "Autres"

        if cat not in category_sales:
            category_sales[cat] = {"qty": 0, "revenue": 0}
        category_sales[cat]["qty"] += item.quantity or 0
        category_sales[cat]["revenue"] += item.total_price or 0

    return {
        "reportType": "products",
        "period": period,
        "dateRange": {
            "start": start.isoformat(),
            "end": end.isoformat()
        },
        "generatedAt": datetime.utcnow().isoformat(),
        "topProducts": [
            {
                "productId": p.product_id,
                "title": p.title,
                "quantitySold": int(p.total_qty or 0),
                "revenue": round(float(p.total_revenue or 0), 2)
            }
            for p in top_products
        ],
        "categoryBreakdown": [
            {
                "category": cat,
                "quantitySold": data["qty"],
                "revenue": round(data["revenue"], 2)
            }
            for cat, data in sorted(category_sales.items(), key=lambda x: x[1]["revenue"], reverse=True)
        ]
    }


# ===================== RETURNS REPORT =====================

@router.get("/returns")
async def generate_returns_report(
    period: str = "30d",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate returns and refunds report"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Admin access required")

    start, end = get_date_range(period, start_date, end_date)

    # Get returns in period
    returns = db.query(ReturnRequest).filter(
        and_(
            ReturnRequest.created_at >= start,
            ReturnRequest.created_at <= end
        )
    ).all()

    total_returns = len(returns)
    pending_returns = len([r for r in returns if r.status == ReturnStatus.PENDING])
    approved_returns = len([r for r in returns if r.status in [ReturnStatus.APPROVED, ReturnStatus.REFUNDED, ReturnStatus.COMPLETED]])
    rejected_returns = len([r for r in returns if r.status == ReturnStatus.REJECTED])
    total_refunded = sum(r.refund_amount or 0 for r in returns if r.status in [ReturnStatus.REFUNDED, ReturnStatus.COMPLETED])

    # Returns by reason
    reason_breakdown = {}
    for ret in returns:
        reason = ret.reason.value if ret.reason else "unknown"
        if reason not in reason_breakdown:
            reason_breakdown[reason] = 0
        reason_breakdown[reason] += 1

    # Get orders in same period for return rate calculation
    total_orders = db.query(Order).filter(
        and_(
            Order.created_at >= start,
            Order.status == OrderStatus.DELIVERED
        )
    ).count()

    return_rate = (total_returns / total_orders * 100) if total_orders > 0 else 0

    return {
        "reportType": "returns",
        "period": period,
        "dateRange": {
            "start": start.isoformat(),
            "end": end.isoformat()
        },
        "generatedAt": datetime.utcnow().isoformat(),
        "summary": {
            "totalReturns": total_returns,
            "pendingReturns": pending_returns,
            "approvedReturns": approved_returns,
            "rejectedReturns": rejected_returns,
            "totalRefunded": round(total_refunded, 2),
            "returnRate": round(return_rate, 2)
        },
        "reasonBreakdown": [
            {"reason": reason, "count": count}
            for reason, count in sorted(reason_breakdown.items(), key=lambda x: x[1], reverse=True)
        ]
    }


# ===================== EXPORT ENDPOINTS =====================

@router.get("/export/{report_type}")
async def export_report(
    report_type: str,
    format: str = "csv",
    period: str = "30d",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export report as CSV or JSON"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get report data based on type
    if report_type == "sales":
        report = await generate_sales_report(period, None, None, db, current_user)
    elif report_type == "customers":
        report = await generate_customers_report(period, None, None, db, current_user)
    elif report_type == "products":
        report = await generate_products_report(period, None, None, db, current_user)
    elif report_type == "returns":
        report = await generate_returns_report(period, None, None, db, current_user)
    else:
        raise HTTPException(status_code=400, detail="Invalid report type")

    if format == "json":
        return Response(
            content=json.dumps(report, indent=2),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={report_type}_report_{period}.json"
            }
        )

    # CSV export
    output = StringIO()
    writer = csv.writer(output)

    # Write headers and data based on report type
    if report_type == "sales":
        writer.writerow(["Date", "Orders", "Revenue (TND)"])
        for day in report.get("dailySales", []):
            writer.writerow([day["date"], day["orders"], day["revenue"]])

    elif report_type == "customers":
        writer.writerow(["Name", "Email", "Total Spent (TND)", "Order Count"])
        for c in report.get("topCustomers", []):
            writer.writerow([c["name"], c["email"], c["totalSpent"], c["orderCount"]])

    elif report_type == "products":
        writer.writerow(["Product ID", "Title", "Quantity Sold", "Revenue (TND)"])
        for p in report.get("topProducts", []):
            writer.writerow([p["productId"], p["title"], p["quantitySold"], p["revenue"]])

    elif report_type == "returns":
        writer.writerow(["Reason", "Count"])
        for r in report.get("reasonBreakdown", []):
            writer.writerow([r["reason"], r["count"]])

    content = output.getvalue()
    output.close()

    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={report_type}_report_{period}.csv"
        }
    )


# ===================== RECENT REPORTS =====================

# Store generated reports (in production, use database)
_recent_reports: List[dict] = []

@router.get("/recent")
async def get_recent_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of recently generated reports"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Return mock recent reports if no real ones
    if not _recent_reports:
        now = datetime.utcnow()
        return [
            {
                "id": 1,
                "name": f"Ventes mensuelles - {now.strftime('%B %Y')}",
                "type": "sales",
                "typeLabel": "Ventes",
                "period": f"01/{now.month:02d} - {now.day:02d}/{now.month:02d}/{now.year}",
                "date": now.strftime("%d/%m/%Y"),
                "downloadUrl": "/api/admin/reports/export/sales?period=30d"
            },
            {
                "id": 2,
                "name": f"Analyse clients - {now.strftime('%B %Y')}",
                "type": "customers",
                "typeLabel": "Clients",
                "period": f"01/{now.month:02d} - {now.day:02d}/{now.month:02d}/{now.year}",
                "date": now.strftime("%d/%m/%Y"),
                "downloadUrl": "/api/admin/reports/export/customers?period=30d"
            },
            {
                "id": 3,
                "name": f"Performance produits - {now.strftime('%B %Y')}",
                "type": "products",
                "typeLabel": "Produits",
                "period": f"01/{now.month:02d} - {now.day:02d}/{now.month:02d}/{now.year}",
                "date": now.strftime("%d/%m/%Y"),
                "downloadUrl": "/api/admin/reports/export/products?period=30d"
            }
        ]

    return _recent_reports[:10]
