"""
Admin Orders Router
Order management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
from typing import Optional, List

from app.core.database import get_db
from app.core.security import require_order_manager, get_current_user_id
from app.models.order import Order, OrderItem, OrderStatus, PaymentStatus, OrderStatusHistory
from app.models.admin_log import log_admin_activity
from app.schemas.order import OrderUpdate, OrderStatusUpdate, OrderListResponse

router = APIRouter(prefix="/admin/orders", tags=["Admin Orders"])


@router.get("")
async def list_orders(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    _: dict = Depends(require_order_manager),
    db: Session = Depends(get_db)
):
    """List orders with filters and pagination"""
    query = db.query(Order)

    # Apply filters
    if status:
        try:
            status_enum = OrderStatus(status)
            query = query.filter(Order.status == status_enum)
        except ValueError:
            pass

    if payment_status:
        try:
            payment_status_enum = PaymentStatus(payment_status)
            query = query.filter(Order.payment_status == payment_status_enum)
        except ValueError:
            pass

    if search:
        query = query.filter(
            or_(
                Order.reference.ilike(f"%{search}%"),
                Order.customer_email.ilike(f"%{search}%"),
                Order.customer_phone.ilike(f"%{search}%"),
                Order.shipping_first_name.ilike(f"%{search}%"),
                Order.shipping_last_name.ilike(f"%{search}%")
            )
        )

    if date_from:
        try:
            from_date = datetime.fromisoformat(date_from)
            query = query.filter(Order.created_at >= from_date)
        except ValueError:
            pass

    if date_to:
        try:
            to_date = datetime.fromisoformat(date_to)
            query = query.filter(Order.created_at <= to_date)
        except ValueError:
            pass

    # Get total count
    total = query.count()

    # Apply pagination
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


@router.get("/{order_id}")
async def get_order(
    order_id: int,
    _: dict = Depends(require_order_manager),
    db: Session = Depends(get_db)
):
    """Get order details"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order_data = order.to_dict()

    # Include status history
    order_data["statusHistory"] = [h.to_dict() for h in order.status_history]

    # Include payment history
    order_data["payments"] = [p.to_dict() for p in order.payments]

    return order_data


@router.put("/{order_id}")
async def update_order(
    order_id: int,
    update: OrderUpdate,
    request: Request,
    payload: dict = Depends(require_order_manager),
    db: Session = Depends(get_db)
):
    """Update order details"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_values = {}
    new_values = {}

    # Update fields
    for field, value in update.dict(exclude_unset=True).items():
        if hasattr(order, field):
            old_values[field] = getattr(order, field)
            if field == "status":
                try:
                    value = OrderStatus(value)
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Invalid status: {value}")
            elif field == "payment_status":
                try:
                    value = PaymentStatus(value)
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Invalid payment status: {value}")
            setattr(order, field, value)
            new_values[field] = value if not hasattr(value, 'value') else value.value

    order.updated_at = datetime.utcnow()
    db.commit()

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="update_order",
        resource_type="order",
        resource_id=order.id,
        resource_reference=order.reference,
        old_values={k: str(v) if hasattr(v, 'value') else v for k, v in old_values.items()},
        new_values=new_values,
        ip_address=request.client.host if request.client else None
    )

    return order.to_dict()


@router.post("/{order_id}/status")
async def update_order_status(
    order_id: int,
    status_update: OrderStatusUpdate,
    request: Request,
    payload: dict = Depends(require_order_manager),
    db: Session = Depends(get_db)
):
    """Update order status with validation"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        new_status = OrderStatus(status_update.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {status_update.status}")

    # Validate transition
    if not order.can_transition_to(new_status):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {order.status.value} to {new_status.value}"
        )

    old_status = order.status

    # Update status
    order.status = new_status
    order.updated_at = datetime.utcnow()

    # Update related timestamps
    if new_status == OrderStatus.CONFIRMED:
        order.confirmed_at = datetime.utcnow()
    elif new_status == OrderStatus.SHIPPED:
        order.shipped_at = datetime.utcnow()
    elif new_status == OrderStatus.DELIVERED:
        order.delivered_at = datetime.utcnow()
    elif new_status == OrderStatus.CANCELLED:
        order.cancelled_at = datetime.utcnow()

    # Create status history entry
    history = OrderStatusHistory(
        order_id=order.id,
        from_status=old_status,
        to_status=new_status,
        changed_by=int(payload.get("sub")),
        change_reason=status_update.reason,
        notes=status_update.notes
    )
    db.add(history)
    db.commit()

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="update_order_status",
        resource_type="order",
        resource_id=order.id,
        resource_reference=order.reference,
        old_values={"status": old_status.value},
        new_values={"status": new_status.value},
        description=f"Status changed from {old_status.value} to {new_status.value}",
        ip_address=request.client.host if request.client else None
    )

    return order.to_dict()


@router.post("/{order_id}/tracking")
async def update_tracking(
    order_id: int,
    tracking_number: str,
    carrier: Optional[str] = None,
    tracking_url: Optional[str] = None,
    request: Request = None,
    payload: dict = Depends(require_order_manager),
    db: Session = Depends(get_db)
):
    """Update order tracking information"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.tracking_number = tracking_number
    if carrier:
        order.shipping_carrier = carrier
    if tracking_url:
        order.tracking_url = tracking_url
    order.updated_at = datetime.utcnow()

    db.commit()

    return order.to_dict()


@router.get("/{order_id}/timeline")
async def get_order_timeline(
    order_id: int,
    _: dict = Depends(require_order_manager),
    db: Session = Depends(get_db)
):
    """Get order status timeline"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    timeline = []

    # Add creation
    timeline.append({
        "status": "created",
        "date": order.created_at.isoformat() if order.created_at else None,
        "description": "Commande créée"
    })

    # Add status history
    for history in order.status_history:
        timeline.append({
            "status": history.to_status.value,
            "date": history.created_at.isoformat() if history.created_at else None,
            "description": f"Statut changé vers {history.to_status.value}",
            "notes": history.notes,
            "changedBy": history.changed_by
        })

    return timeline


@router.get("/export/csv")
async def export_orders_csv(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    _: dict = Depends(require_order_manager),
    db: Session = Depends(get_db)
):
    """Export orders to CSV format"""
    from fastapi.responses import StreamingResponse
    import csv
    import io

    query = db.query(Order)

    if status:
        try:
            status_enum = OrderStatus(status)
            query = query.filter(Order.status == status_enum)
        except ValueError:
            pass

    if date_from:
        try:
            from_date = datetime.fromisoformat(date_from)
            query = query.filter(Order.created_at >= from_date)
        except ValueError:
            pass

    if date_to:
        try:
            to_date = datetime.fromisoformat(date_to)
            query = query.filter(Order.created_at <= to_date)
        except ValueError:
            pass

    orders = query.order_by(Order.created_at.desc()).all()

    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Reference", "Date", "Status", "Payment Status",
        "Customer Name", "Customer Phone", "City",
        "Subtotal", "Discount", "Shipping", "Total"
    ])

    # Data
    for order in orders:
        writer.writerow([
            order.reference,
            order.created_at.strftime("%Y-%m-%d %H:%M") if order.created_at else "",
            order.status.value,
            order.payment_status.value,
            f"{order.shipping_first_name} {order.shipping_last_name}",
            order.shipping_phone,
            order.shipping_city,
            order.subtotal,
            order.discount_amount,
            order.shipping_amount,
            order.total_amount
        ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=orders_export_{datetime.utcnow().strftime('%Y%m%d')}.csv"
        }
    )
