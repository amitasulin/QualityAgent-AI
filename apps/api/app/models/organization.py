"""Organization (Tenant) model"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Text, Enum as SQLEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IDMixin, TimestampMixin
import enum


class OrganizationStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    TRIAL = "trial"


class Organization(Base, IDMixin, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Jerusalem", nullable=False)
    status: Mapped[OrganizationStatus] = mapped_column(
        SQLEnum(OrganizationStatus, name="organization_status", values_callable=lambda obj: [e.value for e in obj]),
        default=OrganizationStatus.ACTIVE,
        nullable=False,
    )
    settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    sites: Mapped[list["Site"]] = relationship(back_populates="organization", cascade="all, delete-orphan", foreign_keys="Site.organization_id")
    users: Mapped[list["User"]] = relationship(back_populates="organization", cascade="all, delete-orphan", foreign_keys="User.organization_id")
    products: Mapped[list["Product"]] = relationship(back_populates="organization", cascade="all, delete-orphan", foreign_keys="Product.organization_id")
    customers: Mapped[list["Customer"]] = relationship(back_populates="organization", cascade="all, delete-orphan", foreign_keys="Customer.organization_id")
    suppliers: Mapped[list["Supplier"]] = relationship(back_populates="organization", cascade="all, delete-orphan", foreign_keys="Supplier.organization_id")
    documents: Mapped[list["Document"]] = relationship(back_populates="organization", cascade="all, delete-orphan", foreign_keys="Document.organization_id")
    nonconformities: Mapped[list["Nonconformity"]] = relationship(back_populates="organization", cascade="all, delete-orphan", foreign_keys="Nonconformity.organization_id")
    corrective_actions: Mapped[list["CorrectiveAction"]] = relationship(back_populates="organization", cascade="all, delete-orphan", foreign_keys="CorrectiveAction.organization_id")
    effectiveness_checks: Mapped[list["EffectivenessCheck"]] = relationship(back_populates="organization", cascade="all, delete-orphan", foreign_keys="EffectivenessCheck.organization_id")
    agent_runs: Mapped[list["AgentRun"]] = relationship(back_populates="organization", cascade="all, delete-orphan", foreign_keys="AgentRun.organization_id")
    agent_recommendations: Mapped[list["AgentRecommendation"]] = relationship(back_populates="organization", cascade="all, delete-orphan", foreign_keys="AgentRecommendation.organization_id")
    audit_events: Mapped[list["AuditEvent"]] = relationship(back_populates="organization", cascade="all, delete-orphan", foreign_keys="AuditEvent.organization_id")
    tasks: Mapped[list["Task"]] = relationship(back_populates="organization", cascade="all, delete-orphan", foreign_keys="Task.organization_id")

    def __repr__(self) -> str:
        return f"<Organization(id={self.id}, name='{self.name}')>"
