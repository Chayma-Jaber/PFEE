"""
Admin Customers Router
Customer management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from datetime import datetime
from typing import Optional

from app.core.database import get_db
from app.core.security import require_support_agent
from app.models.user import User, UserRole, Address
from app.models.order import Order
from app.models.wishlist import WishlistItem
from app.models.admin_log import log_admin_activity
from app.schemas.user import UserAdminUpdate

router = APIRouter(prefix="/admin/customers", tags=["Admin Customers"])


@router.get("")
async def list_customers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    has_orders: Optional[bool] = None,
    _: dict = Depends(require_support_agent),
    db: Session = Depends(get_db)
):
    """List customers with filters and pagination"""
    query = db.query(User).filter(User.role == UserRole.CUSTOMER)

    if search:
        query = query.filter(
            or_(
                User.email.ilike(f"%{search}%"),
                User.phone.ilike(f"%{search}%"),
                User.first_name.ilike(f"%{search}%"),
                User.last_name.ilike(f"%{search}%")
            )
        )

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if has_orders is not None:
        if has_orders:
            query = query.filter(User.orders.any())
        else:
            query = query.filter(~User.orders.any())

    total = query.count()

    customers = query.order_by(User.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    result = []
    for customer in customers:
        data = customer.to_dict()
        # Add order count
        data["orderCount"] = db.query(func.count(Order.id)).filter(
            Order.user_id == customer.id
        ).scalar() or 0
        # Add total spent
        data["totalSpent"] = db.query(func.sum(Order.total_amount)).filter(
            Order.user_id == customer.id
        ).scalar() or 0
        result.append(data)

    return {
        "items": result,
        "total": total,
        "page": page,
        "perPage": per_page,
        "pages": (total + per_page - 1) // per_page
    }


@router.get("/{customer_id}")
async def get_customer(
    customer_id: int,
    _: dict = Depends(require_support_agent),
    db: Session = Depends(get_db)
):
    """Get customer details"""
    customer = db.query(User).filter(
        User.id == customer_id,
        User.role == UserRole.CUSTOMER
    ).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    data = customer.to_dict(include_sensitive=True)

    # Add addresses
    data["addresses"] = [addr.to_dict() for addr in customer.addresses]

    # Add order statistics
    data["orderCount"] = db.query(func.count(Order.id)).filter(
        Order.user_id == customer.id
    ).scalar() or 0

    data["totalSpent"] = db.query(func.sum(Order.total_amount)).filter(
        Order.user_id == customer.id
    ).scalar() or 0

    # Add wishlist count
    data["wishlistCount"] = db.query(func.count(WishlistItem.id)).filter(
        WishlistItem.user_id == customer.id
    ).scalar() or 0

    return data


@router.get("/{customer_id}/orders")
async def get_customer_orders(
    customer_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    _: dict = Depends(require_support_agent),
    db: Session = Depends(get_db)
):
    """Get customer order history"""
    customer = db.query(User).filter(User.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    query = db.query(Order).filter(Order.user_id == customer_id)
    total = query.count()

    orders = query.order_by(Order.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return {
        "items": [order.to_dict() for order in orders],
        "total": total,
        "page": page,
        "perPage": per_page,
        "pages": (total + per_page - 1) // per_page
    }


@router.put("/{customer_id}")
async def update_customer(
    customer_id: int,
    update: UserAdminUpdate,
    request: Request,
    payload: dict = Depends(require_support_agent),
    db: Session = Depends(get_db)
):
    """Update customer details (admin)"""
    customer = db.query(User).filter(
        User.id == customer_id,
        User.role == UserRole.CUSTOMER
    ).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    old_values = {}
    new_values = {}

    for field, value in update.dict(exclude_unset=True).items():
        if hasattr(customer, field):
            old_values[field] = getattr(customer, field)
            setattr(customer, field, value)
            new_values[field] = value

    customer.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(customer)

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="update_customer",
        resource_type="customer",
        resource_id=customer.id,
        resource_reference=customer.email or customer.phone,
        old_values=old_values,
        new_values=new_values,
        ip_address=request.client.host if request.client else None
    )

    return customer.to_dict()


@router.post("/{customer_id}/toggle-active")
async def toggle_customer_active(
    customer_id: int,
    request: Request,
    payload: dict = Depends(require_support_agent),
    db: Session = Depends(get_db)
):
    """Enable/disable customer account"""
    customer = db.query(User).filter(
        User.id == customer_id,
        User.role == UserRole.CUSTOMER
    ).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.is_active = not customer.is_active
    customer.updated_at = datetime.utcnow()
    db.commit()

    # Log activity
    action = "enable_customer" if customer.is_active else "disable_customer"
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action=action,
        resource_type="customer",
        resource_id=customer.id,
        resource_reference=customer.email or customer.phone,
        ip_address=request.client.host if request.client else None
    )

    return {
        "message": f"Customer {'enabled' if customer.is_active else 'disabled'} successfully",
        "isActive": customer.is_active
    }


@router.post("/{customer_id}/notes")
async def add_customer_note(
    customer_id: int,
    note: str,
    request: Request,
    payload: dict = Depends(require_support_agent),
    db: Session = Depends(get_db)
):
    """Add admin note to customer"""
    customer = db.query(User).filter(User.id == customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Append to existing notes
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    new_note = f"[{timestamp}] {note}"

    if customer.admin_notes:
        customer.admin_notes = f"{customer.admin_notes}\n{new_note}"
    else:
        customer.admin_notes = new_note

    customer.updated_at = datetime.utcnow()
    db.commit()

    return {"message": "Note added successfully"}


@router.get("/export/csv")
async def export_customers_csv(
    _: dict = Depends(require_support_agent),
    db: Session = Depends(get_db)
):
    """Export customers to CSV format"""
    from fastapi.responses import StreamingResponse
    import csv
    import io

    customers = db.query(User).filter(User.role == UserRole.CUSTOMER).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "ID", "Email", "Phone", "First Name", "Last Name",
        "Active", "Verified", "Newsletter", "Created At", "Last Login"
    ])

    # Data
    for customer in customers:
        writer.writerow([
            customer.id,
            customer.email or "",
            customer.phone or "",
            customer.first_name or "",
            customer.last_name or "",
            "Yes" if customer.is_active else "No",
            "Yes" if customer.is_verified else "No",
            "Yes" if customer.newsletter_subscribed else "No",
            customer.created_at.strftime("%Y-%m-%d") if customer.created_at else "",
            customer.last_login.strftime("%Y-%m-%d") if customer.last_login else ""
        ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=customers_export_{datetime.utcnow().strftime('%Y%m%d')}.csv"
        }
    )
