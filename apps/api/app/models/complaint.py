"""Customer complaint model"""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IDMixin, TimestampMixin, TenantMixin


class ComplaintStatus(str, enum.Enum):
    NEW = "new"
    UNDER_REVIEW = "under_review"
    INVESTIGATING = "investigating"
    ACTION_PENDING = "action_pending"
    RESOLVED = "resolved"
    CLOSED = "closed"
    REJECTED = "rejected"


class ComplaintSeverity(str, enum.Enum):
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    OBSERVATION = "observation"


class Complaint(Base, IDMixin, TimestampMixin, TenantMixin):
    """A complaint received from a customer about a product or shipment"""

    __tablename__ = "complaints"
    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_complaint_tenant_number"),
    )

    number: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ComplaintStatus] = mapped_column(
        SQLEnum(
            ComplaintStatus,
            name="complaint_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=ComplaintStatus.NEW,
        nullable=False,
    )
    severity: Mapped[ComplaintSeverity] = mapped_column(
        SQLEnum(
            ComplaintSeverity,
            name="complaint_severity",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=ComplaintSeverity.MINOR,
        nullable=False,
    )
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    lot_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    customer_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    due_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    assigned_to_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    root_cause: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ncr_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("nonconformities.id", ondelete="SET NULL"), nullable=True
    )
    satisfaction_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )

    customer: Mapped[Optional["Customer"]] = relationship(foreign_keys=[customer_id])
    product: Mapped[Optional["Product"]] = relationship(foreign_keys=[product_id])
    assigned_to: Mapped[Optional["User"]] = relationship(foreign_keys=[assigned_to_id])
    ncr: Mapped[Optional["Nonconformity"]] = relationship(foreign_keys=[ncr_id])

    def __repr__(self) -> str:
        return f"<Complaint(id={self.id}, number='{self.number}', status='{self.status.value}')>"
