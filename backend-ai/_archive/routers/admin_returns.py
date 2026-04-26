"""
Admin Returns Router
Return request management
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime
from typing import Optional

from app.core.database import get_db
from app.core.security import require_support_agent
from app.models.return_request import ReturnRequest, ReturnStatus, ReturnStatusHistory
from app.models.order import Order, OrderItem
from app.models.admin_log import log_admin_activity
from app.schemas.return_request import ReturnRequestUpdate, ReturnStatusUpdate

router = APIRouter(prefix="/admin/returns", tags=["Admin Returns"])


@router.get("")
async def list_returns(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    assigned_to: Optional[int] = None,
    _: dict = Depends(require_support_agent),
    db: Session = Depends(get_db)
):
    """List return requests with filters and pagination"""
    query = db.query(ReturnRequest)

    if status:
        try:
            status_enum = ReturnStatus(status)
            query = query.filter(ReturnRequest.status == status_enum)
        except ValueError:
            pass

    if search:
        query = query.filter(
            or_(
                ReturnRequest.reference.ilike(f"%{search}%"),
                ReturnRequest.order.has(Order.reference.ilike(f"%{search}%"))
            )
        )

    if assigned_to:
        query = query.filter(ReturnRequest.assigned_to == assigned_to)

    total = query.count()

    returns = query.order_by(ReturnRequest.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return {
        "items": [r.to_dict() for r in returns],
        "total": total,
        "page": page,
        "perPage": per_page,
        "pages": (total + per_page - 1) // per_page
    }


@router.get("/pending")
async def get_pending_returns(
    _: dict = Depends(require_support_agent),
    db: Session = Depends(get_db)
):
    """Get pending return requests requiring attention"""
    returns = db.query(ReturnRequest).filter(
        ReturnRequest.status.in_([
            ReturnStatus.PENDING,
            ReturnStatus.UNDER_REVIEW
        ])
    ).order_by(ReturnRequest.created_at.asc()).all()

    return [r.to_dict() for r in returns]


@router.get("/{return_id}")
async def get_return(
    return_id: int,
    _: dict = Depends(require_support_agent),
    db: Session = Depends(get_db)
):
    """Get return request details"""
    return_request = db.query(ReturnRequest).filter(
        ReturnRequest.id == return_id
    ).first()

    if not return_request:
        raise HTTPException(status_code=404, detail="Return request not found")

    data = return_request.to_dict()

    # Include order details
    if return_request.order:
        data["order"] = return_request.order.to_dict()

    # Include user details
    if return_request.user:
        data["user"] = return_request.user.to_dict()

    # Include status history
    data["statusHistory"] = [h.to_dict() for h in return_request.status_history]

    return data


@router.put("/{return_id}")
async def update_return(
    return_id: int,
    update: ReturnRequestUpdate,
    request: Request,
    payload: dict = Depends(require_support_agent),
    db: Session = Depends(get_db)
):
    """Update return request"""
    return_request = db.query(ReturnRequest).filter(
        ReturnRequest.id == return_id
    ).first()

    if not return_request:
        raise HTTPException(status_code=404, detail="Return request not found")

    old_values = {}
    new_values = {}

    for field, value in update.dict(exclude_unset=True).items():
        if field == "status":
            try:
                value = ReturnStatus(value)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status: {value}")

        if hasattr(return_request, field):
            old_values[field] = getattr(return_request, field)
            if hasattr(old_values[field], 'value'):
                old_values[field] = old_values[field].value
            setattr(return_request, field, value)
            new_values[field] = value if not hasattr(value, 'value') else value.value

    return_request.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(return_request)

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="update_return",
        resource_type="return",
        resource_id=return_request.id,
        resource_reference=return_request.reference,
        old_values=old_values,
        new_values=new_values,
        ip_address=request.client.host if request.client else None
    )

    return return_request.to_dict()


@router.post("/{return_id}/status")
async def update_return_status(
    return_id: int,
    status_update: ReturnStatusUpdate,
    request: Request,
    payload: dict = Depends(require_support_agent),
    db: Session = Depends(get_db)
):
    """Update return request status"""
    return_request = db.query(ReturnRequest).filter(
        ReturnRequest.id == return_id
    ).first()

    if not return_request:
        raise HTTPException(status_code=404, detail="Return request not found")

    try:
        new_status = ReturnStatus(status_update.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {status_update.status}")

    old_status = return_request.status

    # Update status
    return_request.status = new_status
    return_request.updated_at = datetime.utcnow()

    # Update related timestamps
    if new_status == ReturnStatus.APPROVED:
        return_request.approved_at = datetime.utcnow()
    elif new_status == ReturnStatus.RECEIVED:
        return_request.received_at = datetime.utcnow()
    elif new_status == ReturnStatus.REFUNDED:
        return_request.refunded_at = datetime.utcnow()
    elif new_status == ReturnStatus.COMPLETED:
        return_request.completed_at = datetime.utcnow()

    # Create status history entry
    history = ReturnStatusHistory(
        return_request_id=return_request.id,
        from_status=old_status,
        to_status=new_status,
        changed_by=int(payload.get("sub")),
        notes=status_update.notes
    )
    db.add(history)
    db.commit()

    # Log activity
    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="update_return_status",
        resource_type="return",
        resource_id=return_request.id,
        resource_reference=return_request.reference,
        old_values={"status": old_status.value},
        new_values={"status": new_status.value},
        description=f"Status changed from {old_status.value} to {new_status.value}",
        ip_address=request.client.host if request.client else None
    )

    return return_request.to_dict()


@router.post("/{return_id}/assign")
async def assign_return(
    return_id: int,
    agent_id: int,
    request: Request,
    payload: dict = Depends(require_support_agent),
    db: Session = Depends(get_db)
):
    """Assign return request to support agent"""
    return_request = db.query(ReturnRequest).filter(
        ReturnRequest.id == return_id
    ).first()

    if not return_request:
        raise HTTPException(status_code=404, detail="Return request not found")

    return_request.assigned_to = agent_id
    return_request.updated_at = datetime.utcnow()

    # Move to under_review if pending
    if return_request.status == ReturnStatus.PENDING:
        old_status = return_request.status
        return_request.status = ReturnStatus.UNDER_REVIEW

        history = ReturnStatusHistory(
            return_request_id=return_request.id,
            from_status=old_status,
            to_status=ReturnStatus.UNDER_REVIEW,
            changed_by=int(payload.get("sub")),
            notes="Assigned to support agent"
        )
        db.add(history)

    db.commit()

    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="assign_return",
        resource_type="return",
        resource_id=return_request.id,
        resource_reference=return_request.reference,
        new_values={"assignedTo": agent_id},
        ip_address=request.client.host if request.client else None
    )

    return return_request.to_dict()


@router.post("/{return_id}/refund")
async def process_refund(
    return_id: int,
    refund_amount: float,
    refund_method: str = "original",
    notes: Optional[str] = None,
    request: Request = None,
    payload: dict = Depends(require_support_agent),
    db: Session = Depends(get_db)
):
    """Process refund for return request"""
    return_request = db.query(ReturnRequest).filter(
        ReturnRequest.id == return_id
    ).first()

    if not return_request:
        raise HTTPException(status_code=404, detail="Return request not found")

    if return_request.status not in [ReturnStatus.APPROVED, ReturnStatus.INSPECTED, ReturnStatus.REFUND_PENDING]:
        raise HTTPException(
            status_code=400,
            detail="Return request must be approved before refund"
        )

    old_status = return_request.status

    return_request.refund_amount = refund_amount
    return_request.refund_method = refund_method
    return_request.status = ReturnStatus.REFUNDED
    return_request.refunded_at = datetime.utcnow()
    return_request.resolution_notes = notes
    return_request.updated_at = datetime.utcnow()

    # Create status history entry
    history = ReturnStatusHistory(
        return_request_id=return_request.id,
        from_status=old_status,
        to_status=ReturnStatus.REFUNDED,
        changed_by=int(payload.get("sub")),
        notes=f"Refund processed: {refund_amount} TND via {refund_method}"
    )
    db.add(history)
    db.commit()

    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="process_refund",
        resource_type="return",
        resource_id=return_request.id,
        resource_reference=return_request.reference,
        new_values={"refundAmount": refund_amount, "refundMethod": refund_method},
        ip_address=request.client.host if request.client else None
    )

    return return_request.to_dict()
