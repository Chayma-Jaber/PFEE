"""
Support Ticket Router
Customer support tickets and messaging
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, and_
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import os
import uuid

from app.core.database import get_db
from app.models.support_ticket import SupportTicket, TicketMessage, TicketAttachment, TicketCategory, TicketPriority, TicketStatus
from app.models.user import User, UserRole
from app.models.order import Order
from app.routers.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/support", tags=["Support"])
admin_router = APIRouter(prefix="/admin/support", tags=["Admin Support"])


# ========================
# Pydantic Schemas
# ========================

class CreateTicketRequest(BaseModel):
    """Create a new support ticket"""
    subject: str = Field(..., min_length=5, max_length=255)
    message: str = Field(..., min_length=10)
    category: TicketCategory = TicketCategory.OTHER
    priority: Optional[TicketPriority] = TicketPriority.MEDIUM
    order_id: Optional[int] = None
    product_id: Optional[int] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_name: Optional[str] = None


class AddMessageRequest(BaseModel):
    """Add a message to a ticket"""
    message: str = Field(..., min_length=1)
    is_internal: bool = False  # Only for agents


class UpdateTicketRequest(BaseModel):
    """Update ticket (admin)"""
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    assigned_to: Optional[int] = None
    category: Optional[TicketCategory] = None
    internal_notes: Optional[str] = None
    tags: Optional[str] = None


class ResolveTicketRequest(BaseModel):
    """Resolve a ticket"""
    resolution_notes: str = Field(..., min_length=5)


class RateTicketRequest(BaseModel):
    """Rate ticket resolution"""
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


# ========================
# Customer Endpoints
# ========================

@router.post("/tickets")
def create_ticket(
    request: CreateTicketRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Create a new support ticket"""
    # Generate reference
    reference = SupportTicket.generate_reference()
    while db.query(SupportTicket).filter(SupportTicket.reference == reference).first():
        reference = SupportTicket.generate_reference()

    # Validate order if provided
    if request.order_id:
        order = db.query(Order).filter(Order.id == request.order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        # Verify ownership if user is logged in
        if current_user and order.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Order does not belong to you")

    # Calculate first response deadline (SLA: 4 hours for urgent, 24 hours for others)
    now = datetime.utcnow()
    priority = request.priority or TicketPriority.MEDIUM
    if priority == TicketPriority.URGENT:
        deadline = now + timedelta(hours=4)
    elif priority == TicketPriority.HIGH:
        deadline = now + timedelta(hours=8)
    else:
        deadline = now + timedelta(hours=24)

    # Create ticket
    ticket = SupportTicket(
        reference=reference,
        user_id=current_user.id if current_user else None,
        subject=request.subject,
        category=request.category,
        priority=priority,
        status=TicketStatus.OPEN,
        order_id=request.order_id,
        product_id=request.product_id,
        contact_email=request.contact_email or (current_user.email if current_user else None),
        contact_phone=request.contact_phone or (current_user.phone if current_user else None),
        contact_name=request.contact_name or (current_user.full_name if current_user else None),
        first_response_deadline=deadline,
        last_customer_message_at=now
    )
    db.add(ticket)
    db.flush()

    # Add initial message
    message = TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id if current_user else None,
        message=request.message,
        is_from_customer=True,
        is_system=False
    )
    db.add(message)
    db.commit()
    db.refresh(ticket)

    return {
        "success": True,
        "ticket": ticket.to_dict(include_messages=True),
        "message": f"Ticket created successfully. Reference: {ticket.reference}"
    }


@router.get("/tickets")
def get_my_tickets(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's support tickets"""
    query = db.query(SupportTicket).filter(SupportTicket.user_id == current_user.id)

    if status:
        if status == "open":
            query = query.filter(SupportTicket.status.in_([
                TicketStatus.OPEN, TicketStatus.IN_PROGRESS,
                TicketStatus.AWAITING_CUSTOMER, TicketStatus.REOPENED
            ]))
        elif status == "closed":
            query = query.filter(SupportTicket.status.in_([
                TicketStatus.RESOLVED, TicketStatus.CLOSED
            ]))
        else:
            try:
                ticket_status = TicketStatus(status)
                query = query.filter(SupportTicket.status == ticket_status)
            except ValueError:
                pass

    total = query.count()
    tickets = query.order_by(desc(SupportTicket.updated_at))\
        .offset((page - 1) * limit).limit(limit).all()

    return {
        "tickets": [t.to_summary() for t in tickets],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }


@router.get("/tickets/{ticket_id}")
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific ticket with messages"""
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == current_user.id
    ).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Mark unread agent messages as read
    unread_messages = db.query(TicketMessage).filter(
        TicketMessage.ticket_id == ticket_id,
        TicketMessage.is_from_customer == False,
        TicketMessage.is_read == False,
        TicketMessage.is_internal == False
    ).all()

    for msg in unread_messages:
        msg.is_read = True
        msg.read_at = datetime.utcnow()
    db.commit()

    # Filter out internal messages for customer view
    visible_messages = [
        msg.to_dict() for msg in ticket.messages
        if not msg.is_internal
    ]

    result = ticket.to_dict()
    result["messages"] = visible_messages

    return result


@router.get("/tickets/reference/{reference}")
def get_ticket_by_reference(
    reference: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Get a ticket by reference (for guest tracking)"""
    ticket = db.query(SupportTicket).filter(SupportTicket.reference == reference).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Verify ownership if user is logged in
    if current_user and ticket.user_id and ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="This ticket does not belong to you")

    # Filter out internal messages
    result = ticket.to_dict()
    result["messages"] = [
        msg.to_dict() for msg in ticket.messages
        if not msg.is_internal
    ]

    return result


@router.post("/tickets/{ticket_id}/messages")
def add_message_to_ticket(
    ticket_id: int,
    request: AddMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a message to a ticket"""
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == current_user.id
    ).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.status == TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot add messages to a closed ticket")

    # Add message
    message = TicketMessage(
        ticket_id=ticket_id,
        sender_id=current_user.id,
        message=request.message,
        is_from_customer=True,
        is_internal=False
    )
    db.add(message)

    # Update ticket
    ticket.last_customer_message_at = datetime.utcnow()
    ticket.updated_at = datetime.utcnow()

    # If ticket was awaiting customer response, move to open
    if ticket.status == TicketStatus.AWAITING_CUSTOMER:
        ticket.status = TicketStatus.OPEN

    # If ticket was resolved, allow reopening
    if ticket.status == TicketStatus.RESOLVED:
        ticket.status = TicketStatus.REOPENED

    db.commit()
    db.refresh(message)

    return {
        "success": True,
        "message": message.to_dict()
    }


@router.post("/tickets/{ticket_id}/reopen")
def reopen_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reopen a resolved ticket"""
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == current_user.id
    ).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.status not in [TicketStatus.RESOLVED, TicketStatus.CLOSED]:
        raise HTTPException(status_code=400, detail="Only resolved or closed tickets can be reopened")

    ticket.status = TicketStatus.REOPENED
    ticket.updated_at = datetime.utcnow()
    ticket.closed_at = None

    # Add system message
    system_msg = TicketMessage(
        ticket_id=ticket_id,
        message="Le ticket a \u00e9t\u00e9 r\u00e9ouvert par le client.",
        is_from_customer=False,
        is_system=True
    )
    db.add(system_msg)
    db.commit()

    return {"success": True, "message": "Ticket reopened successfully"}


@router.post("/tickets/{ticket_id}/rate")
def rate_ticket_resolution(
    ticket_id: int,
    request: RateTicketRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Rate the resolution of a ticket"""
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == current_user.id
    ).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.status not in [TicketStatus.RESOLVED, TicketStatus.CLOSED]:
        raise HTTPException(status_code=400, detail="Can only rate resolved tickets")

    if ticket.satisfaction_rating:
        raise HTTPException(status_code=400, detail="This ticket has already been rated")

    ticket.satisfaction_rating = request.rating
    ticket.satisfaction_comment = request.comment
    db.commit()

    return {"success": True, "message": "Thank you for your feedback!"}


# ========================
# Admin Endpoints
# ========================

@admin_router.get("/tickets")
def admin_get_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    assigned_to: Optional[int] = None,
    unassigned: bool = False,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get all support tickets (admin inbox)"""
    query = db.query(SupportTicket)

    # Status filter
    if status:
        if status == "open":
            query = query.filter(SupportTicket.status.in_([
                TicketStatus.OPEN, TicketStatus.IN_PROGRESS,
                TicketStatus.AWAITING_CUSTOMER, TicketStatus.REOPENED
            ]))
        elif status == "closed":
            query = query.filter(SupportTicket.status.in_([
                TicketStatus.RESOLVED, TicketStatus.CLOSED
            ]))
        else:
            try:
                ticket_status = TicketStatus(status)
                query = query.filter(SupportTicket.status == ticket_status)
            except ValueError:
                pass

    # Priority filter
    if priority:
        try:
            ticket_priority = TicketPriority(priority)
            query = query.filter(SupportTicket.priority == ticket_priority)
        except ValueError:
            pass

    # Category filter
    if category:
        try:
            ticket_category = TicketCategory(category)
            query = query.filter(SupportTicket.category == ticket_category)
        except ValueError:
            pass

    # Assignment filter
    if unassigned:
        query = query.filter(SupportTicket.assigned_to == None)
    elif assigned_to:
        query = query.filter(SupportTicket.assigned_to == assigned_to)

    # Search
    if search:
        search_term = f"%{search}%"
        query = query.filter(or_(
            SupportTicket.reference.ilike(search_term),
            SupportTicket.subject.ilike(search_term),
            SupportTicket.contact_name.ilike(search_term),
            SupportTicket.contact_email.ilike(search_term)
        ))

    total = query.count()

    # Order by priority and date
    tickets = query.order_by(
        # Urgent and high priority first
        SupportTicket.priority.desc(),
        # Open tickets before others
        SupportTicket.status.asc(),
        # Most recent first
        desc(SupportTicket.updated_at)
    ).offset((page - 1) * limit).limit(limit).all()

    return {
        "tickets": [t.to_summary() for t in tickets],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }


@admin_router.get("/tickets/stats")
def admin_get_ticket_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get support ticket statistics"""
    # Count by status
    open_count = db.query(SupportTicket).filter(SupportTicket.status.in_([
        TicketStatus.OPEN, TicketStatus.IN_PROGRESS,
        TicketStatus.AWAITING_CUSTOMER, TicketStatus.REOPENED
    ])).count()

    resolved_count = db.query(SupportTicket).filter(
        SupportTicket.status == TicketStatus.RESOLVED
    ).count()

    closed_count = db.query(SupportTicket).filter(
        SupportTicket.status == TicketStatus.CLOSED
    ).count()

    # Unassigned tickets
    unassigned_count = db.query(SupportTicket).filter(
        SupportTicket.assigned_to == None,
        SupportTicket.status.in_([TicketStatus.OPEN, TicketStatus.REOPENED])
    ).count()

    # Urgent tickets
    urgent_count = db.query(SupportTicket).filter(
        SupportTicket.priority == TicketPriority.URGENT,
        SupportTicket.status.in_([
            TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.REOPENED
        ])
    ).count()

    # Overdue (past first response deadline)
    now = datetime.utcnow()
    overdue_count = db.query(SupportTicket).filter(
        SupportTicket.first_response_at == None,
        SupportTicket.first_response_deadline < now,
        SupportTicket.status.in_([TicketStatus.OPEN, TicketStatus.REOPENED])
    ).count()

    # Average satisfaction rating
    avg_rating = db.query(func.avg(SupportTicket.satisfaction_rating))\
        .filter(SupportTicket.satisfaction_rating != None).scalar()

    # Tickets created today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = db.query(SupportTicket).filter(
        SupportTicket.created_at >= today_start
    ).count()

    # Tickets by category
    category_stats = db.query(
        SupportTicket.category,
        func.count(SupportTicket.id)
    ).group_by(SupportTicket.category).all()

    return {
        "open": open_count,
        "resolved": resolved_count,
        "closed": closed_count,
        "unassigned": unassigned_count,
        "urgent": urgent_count,
        "overdue": overdue_count,
        "todayCreated": today_count,
        "avgSatisfactionRating": round(avg_rating, 2) if avg_rating else None,
        "byCategory": {cat.value: count for cat, count in category_stats}
    }


@admin_router.get("/tickets/{ticket_id}")
def admin_get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get a specific ticket with all messages (including internal)"""
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return ticket.to_dict(include_messages=True)


@admin_router.put("/tickets/{ticket_id}")
def admin_update_ticket(
    ticket_id: int,
    request: UpdateTicketRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Update ticket details (admin)"""
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    changes = []

    if request.status and request.status != ticket.status:
        old_status = ticket.status.value
        ticket.status = request.status
        changes.append(f"Statut: {old_status} \u2192 {request.status.value}")

        if request.status == TicketStatus.CLOSED:
            ticket.closed_at = datetime.utcnow()

    if request.priority and request.priority != ticket.priority:
        old_priority = ticket.priority.value
        ticket.priority = request.priority
        changes.append(f"Priorit\u00e9: {old_priority} \u2192 {request.priority.value}")

    if request.assigned_to is not None:
        if request.assigned_to != ticket.assigned_to:
            # Validate agent exists
            if request.assigned_to:
                agent = db.query(User).filter(
                    User.id == request.assigned_to,
                    User.role != UserRole.CUSTOMER
                ).first()
                if not agent:
                    raise HTTPException(status_code=404, detail="Agent not found")
                changes.append(f"Assign\u00e9 \u00e0: {agent.full_name}")
            else:
                changes.append("D\u00e9sassign\u00e9")
            ticket.assigned_to = request.assigned_to

    if request.category and request.category != ticket.category:
        ticket.category = request.category
        changes.append(f"Cat\u00e9gorie: {request.category.value}")

    if request.internal_notes is not None:
        ticket.internal_notes = request.internal_notes

    if request.tags is not None:
        ticket.tags = request.tags

    ticket.updated_at = datetime.utcnow()

    # Add system message for changes
    if changes:
        system_msg = TicketMessage(
            ticket_id=ticket_id,
            sender_id=current_admin.id,
            message=f"Modifications: {', '.join(changes)}",
            is_from_customer=False,
            is_system=True,
            is_internal=True
        )
        db.add(system_msg)

    db.commit()
    db.refresh(ticket)

    return {
        "success": True,
        "ticket": ticket.to_dict(include_messages=True)
    }


@admin_router.post("/tickets/{ticket_id}/assign")
def admin_assign_ticket(
    ticket_id: int,
    agent_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Assign ticket to an agent (or self)"""
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Default to self-assignment
    target_agent_id = agent_id if agent_id else current_admin.id

    # Validate agent
    agent = db.query(User).filter(
        User.id == target_agent_id,
        User.role != UserRole.CUSTOMER
    ).first()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    ticket.assigned_to = target_agent_id
    ticket.status = TicketStatus.IN_PROGRESS
    ticket.updated_at = datetime.utcnow()

    # Add system message
    system_msg = TicketMessage(
        ticket_id=ticket_id,
        sender_id=current_admin.id,
        message=f"Ticket assign\u00e9 \u00e0 {agent.full_name}",
        is_from_customer=False,
        is_system=True,
        is_internal=True
    )
    db.add(system_msg)
    db.commit()

    return {"success": True, "message": f"Ticket assigned to {agent.full_name}"}


@admin_router.post("/tickets/{ticket_id}/messages")
def admin_add_message(
    ticket_id: int,
    request: AddMessageRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Add a message to a ticket (agent response)"""
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Add message
    message = TicketMessage(
        ticket_id=ticket_id,
        sender_id=current_admin.id,
        message=request.message,
        is_from_customer=False,
        is_internal=request.is_internal
    )
    db.add(message)

    # Update ticket
    now = datetime.utcnow()
    ticket.updated_at = now

    if not request.is_internal:
        ticket.last_agent_message_at = now

        # Track first response time
        if not ticket.first_response_at:
            ticket.first_response_at = now

        # Update status to awaiting customer
        if ticket.status in [TicketStatus.OPEN, TicketStatus.REOPENED]:
            ticket.status = TicketStatus.AWAITING_CUSTOMER

    db.commit()
    db.refresh(message)

    return {
        "success": True,
        "message": message.to_dict()
    }


@admin_router.post("/tickets/{ticket_id}/resolve")
def admin_resolve_ticket(
    ticket_id: int,
    request: ResolveTicketRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Resolve a ticket"""
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.status in [TicketStatus.RESOLVED, TicketStatus.CLOSED]:
        raise HTTPException(status_code=400, detail="Ticket is already resolved or closed")

    now = datetime.utcnow()
    ticket.status = TicketStatus.RESOLVED
    ticket.resolution_notes = request.resolution_notes
    ticket.resolved_at = now
    ticket.resolved_by = current_admin.id
    ticket.updated_at = now

    # Add system message
    system_msg = TicketMessage(
        ticket_id=ticket_id,
        sender_id=current_admin.id,
        message=f"Ticket r\u00e9solu. Notes: {request.resolution_notes}",
        is_from_customer=False,
        is_system=True
    )
    db.add(system_msg)
    db.commit()

    return {"success": True, "message": "Ticket resolved successfully"}


@admin_router.post("/tickets/{ticket_id}/close")
def admin_close_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Close a ticket (after resolution)"""
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.status = TicketStatus.CLOSED
    ticket.closed_at = datetime.utcnow()
    ticket.updated_at = datetime.utcnow()

    # Add system message
    system_msg = TicketMessage(
        ticket_id=ticket_id,
        sender_id=current_admin.id,
        message="Ticket ferm\u00e9.",
        is_from_customer=False,
        is_system=True,
        is_internal=True
    )
    db.add(system_msg)
    db.commit()

    return {"success": True, "message": "Ticket closed"}


@admin_router.get("/agents")
def admin_get_support_agents(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get list of support agents for assignment"""
    agents = db.query(User).filter(
        User.role != UserRole.CUSTOMER,
        User.is_active == True
    ).all()

    return {
        "agents": [
            {
                "id": agent.id,
                "name": agent.full_name,
                "email": agent.email,
                "role": agent.role.value,
                "assignedTickets": len([t for t in agent.assigned_tickets if t.is_open])
            }
            for agent in agents
        ]
    }
