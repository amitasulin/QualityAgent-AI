"""Supplier model"""
import uuid
from typing import Optional

from sqlalchemy import String, Text, ForeignKey, UniqueConstraint, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IDMixin, TimestampMixin, TenantMixin
from app.models.organization import Organization


class Supplier(Base, IDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "suppliers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_supplier_tenant_code"),
    )

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_person: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quality_rating: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    is_approved: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Explicit FK to Organization
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="suppliers", foreign_keys="Supplier.organization_id")
    nonconformities: Mapped[list["Nonconformity"]] = relationship(back_populates="supplier")

    def __repr__(self) -> str:
        return f"<Supplier(id={self.id}, code='{self.code}', name='{self.name}')>"