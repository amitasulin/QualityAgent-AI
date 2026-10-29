"""Site/Plant model"""
import uuid
from typing import Optional

from sqlalchemy import String, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IDMixin, TimestampMixin, TenantMixin
from app.models.organization import Organization


class Site(Base, IDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "sites"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_site_tenant_code"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # FK to Organization
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="sites", foreign_keys=[organization_id])
    users: Mapped[list["User"]] = relationship(back_populates="site")
    nonconformities: Mapped[list["Nonconformity"]] = relationship(back_populates="site")

    def __repr__(self) -> str:
        return f"<Site(id={self.id}, name='{self.name}', code='{self.code}')>"