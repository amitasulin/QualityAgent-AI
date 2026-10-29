"""Base model classes and mixins"""
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import DateTime, UUID, event
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


class Base(DeclarativeBase):
    """Base class for all models"""
    pass


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps"""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class TenantMixin:
    """Mixin for tenant isolation (multi-tenancy)"""
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )


class IDMixin:
    """Mixin for UUID primary key"""
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


@event.listens_for(Session, "before_flush")
def _fill_organization_id(session: Session, flush_context: Any, instances: Any) -> None:
    """Keep organization_id in sync with tenant_id for new rows.

    Every tenant table carries both tenant_id and organization_id; endpoints only
    set tenant_id, so fill organization_id automatically before INSERT.
    """
    for obj in session.new:
        if not hasattr(type(obj), "organization_id"):
            continue
        if getattr(obj, "organization_id", None) is not None:
            continue
        tenant_id = getattr(obj, "tenant_id", None)
        if tenant_id is not None:
            obj.organization_id = tenant_id


def to_dict(model_instance: Any, exclude: Optional[set] = None) -> dict:
    """Convert SQLAlchemy model instance to dictionary"""
    exclude = exclude or set()
    result = {}
    for column in model_instance.__table__.columns:
        if column.name not in exclude:
            value = getattr(model_instance, column.name)
            if isinstance(value, uuid.UUID):
                value = str(value)
            elif isinstance(value, datetime):
                value = value.isoformat()
            result[column.name] = value
    return result