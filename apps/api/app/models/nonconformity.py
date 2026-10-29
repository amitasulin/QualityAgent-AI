"""Nonconformity (NCR) and NCRAttachment models"""
import uuid
from datetime import timezone, datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text, ForeignKey, Enum as SQLEnum, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IDMixin, TimestampMixin, TenantMixin
from app.models.organization import Organization
from app.models.site import Site
from app.models.user import User
from app.models.product import Product
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.document import DocumentVersion
import enum


class NCRStatus(str, enum.Enum):
    DRAFT = "draft"
    OPEN = "open"
    CONTAINED = "contained"
    INVESTIGATING = "investigating"
    ACTION_PENDING = "action_pending"
    EFFECTIVENESS_REVIEW = "effectiveness_review"
    CLOSED = "closed"
    REOPENED = "reopened"


class NCRSeverity(str, enum.Enum):
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    OBSERVATION = "observation"


class Nonconformity(Base, IDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "nonconformities"
    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_ncr_tenant_number"),
    )

    number: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[NCRSeverity] = mapped_column(
        SQLEnum(NCRSeverity, name="ncr_severity", values_callable=lambda obj: [e.value for e in obj]),
        default=NCRSeverity.MINOR,
        nullable=False,
    )
    status: Mapped[NCRStatus] = mapped_column(
        SQLEnum(NCRStatus, name="ncr_status", values_callable=lambda obj: [e.value for e in obj]),
        default=NCRStatus.DRAFT,
        nullable=False,
    )
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
    )
    site_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("sites.id", ondelete="SET NULL"),
        nullable=True,
    )
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
    )
    supplier_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("suppliers.id", ondelete="SET NULL"),
        nullable=True,
    )
    lot_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    defect_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    defect_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    measured_value: Mapped[Optional[float]] = mapped_column(Numeric(15, 5), nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    requirement_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("document_versions.id", ondelete="SET NULL"),
        nullable=True,
    )
    detected_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    assigned_to_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    contained_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    contained_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    containment_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    root_cause: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    root_cause_analysis_method: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    closure_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Explicit FK to Organization
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="nonconformities", foreign_keys="Nonconformity.organization_id")
    product: Mapped[Optional["Product"]] = relationship(back_populates="nonconformities")
    site: Mapped[Optional["Site"]] = relationship(back_populates="nonconformities")
    customer: Mapped[Optional["Customer"]] = relationship(back_populates="nonconformities")
    supplier: Mapped[Optional["Supplier"]] = relationship(back_populates="nonconformities")
    requirement_version: Mapped[Optional["DocumentVersion"]] = relationship()
    detected_by: Mapped[Optional["User"]] = relationship(
        back_populates="detected_ncrs", foreign_keys=[detected_by_id]
    )
    assigned_to: Mapped[Optional["User"]] = relationship(
        back_populates="assigned_ncrs", foreign_keys=[assigned_to_id]
    )
    contained_by: Mapped[Optional["User"]] = relationship(foreign_keys=[contained_by_id])
    closed_by: Mapped[Optional["User"]] = relationship(foreign_keys=[closed_by_id])
    attachments: Mapped[list["NCRAttachment"]] = relationship(
        back_populates="ncr", cascade="all, delete-orphan"
    )
    corrective_actions: Mapped[list["CorrectiveAction"]] = relationship(
        back_populates="ncr", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Nonconformity(id={self.id}, number='{self.number}', status='{self.status.value}')>"


class NCRAttachment(Base, IDMixin, TimestampMixin):
    __tablename__ = "ncr_attachments"

    ncr_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("nonconformities.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    ncr: Mapped["Nonconformity"] = relationship(back_populates="attachments")
    uploaded_by: Mapped[Optional["User"]] = relationship()

    def __repr__(self) -> str:
        return f"<NCRAttachment(id={self.id}, ncr_id={self.ncr_id}, file_name='{self.file_name}')>"
