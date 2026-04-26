"""
Admin Activity Log Model
Audit trail for admin actions
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from datetime import datetime

from app.core.database import Base


class AdminActivityLog(Base):
    """Admin activity log for audit trail"""
    __tablename__ = "admin_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Action details
    action = Column(String(100), nullable=False)  # create_product, update_order, etc.
    resource_type = Column(String(50), nullable=False)  # product, order, user, coupon, etc.
    resource_id = Column(Integer, nullable=True)
    resource_reference = Column(String(100), nullable=True)  # For easier lookup

    # Change details
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    description = Column(Text, nullable=True)

    # Request context
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "action": self.action,
            "resourceType": self.resource_type,
            "resourceId": self.resource_id,
            "resourceReference": self.resource_reference,
            "description": self.description,
            "oldValues": self.old_values,
            "newValues": self.new_values,
            "ipAddress": self.ip_address,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }


def log_admin_activity(
    db,
    user_id: int,
    action: str,
    resource_type: str,
    resource_id: int = None,
    resource_reference: str = None,
    old_values: dict = None,
    new_values: dict = None,
    description: str = None,
    ip_address: str = None,
    user_agent: str = None
):
    """Helper function to log admin activity"""
    log = AdminActivityLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_reference=resource_reference,
        old_values=old_values,
        new_values=new_values,
        description=description,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db.add(log)
    db.commit()
    return log
