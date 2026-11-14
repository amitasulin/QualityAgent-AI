"""Models package initialization"""
from app.models.base import Base, TimestampMixin, TenantMixin

# Import all models to register them with SQLAlchemy
from app.models import (
    organization,
    site,
    user,
    product,
    customer,
    supplier,
    document,
    file_object,
    nonconformity,
    corrective_action,
    agent,
    task,
    audit,
    inspection,
    complaint,
)

__all__ = [
    "Base",
    "TimestampMixin",
    "TenantMixin",
]