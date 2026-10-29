"""Corrective Action (CAPA) and EffectivenessCheck models"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text, ForeignKey, Enum as SQLEnum, Date, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IDMixin, TimestampMixin, TenantMixin
from app.models.organization import Organization
from app.models.nonconformity import Nonconformity
from app.models.user import User
import enum


class CAPAStatus(str, enum.Enum):
    DRAFT = "draft"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    PENDING_REVIEW = "pending_review"
    EFFECTIVENESS_CHECK = "effectiveness_check"
    COMPLETED = "completed"
    REJECTED = "rejected"


class CorrectiveAction(Base, IDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "corrective_actions"

    ncr_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("nonconformities.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)  # correction, corrective_action, preventive_action
    status: Mapped[CAPAStatus] = mapped_column(
        SQLEnum(CAPAStatus, name="capa_status", values_callable=lambda obj: [e.value for e in obj]),
        default=CAPAStatus.DRAFT,
        nullable=False,
    )
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    effectiveness_check_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    effectiveness_result: Mapped[Optional[bool]] = mapped_column(nullable=True)
    effectiveness_evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Explicit FK to Organization
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="corrective_actions", foreign_keys="CorrectiveAction.organization_id")
    ncr: Mapped["Nonconformity"] = relationship(back_populates="corrective_actions")
    owner: Mapped[Optional["User"]] = relationship(
        back_populates="capa_owned", foreign_keys=[owner_id]
    )
    verified_by: Mapped[Optional["User"]] = relationship(
        back_populates="capa_verified", foreign_keys=[verified_by_id]
    )
    effectiveness_checks: Mapped[list["EffectivenessCheck"]] = relationship(
        back_populates="capa", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<CorrectiveAction(id={self.id}, ncr_id={self.ncr_id}, status='{self.status.value}')>"


class EffectivenessCheck(Base, IDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "effectiveness_checks"

    capa_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("corrective_actions.id", ondelete="CASCADE"),
        nullable=False,
    )
    check_date: Mapped[date] = mapped_column(Date, nullable=False)
    result: Mapped[bool] = mapped_column(nullable=False)
    evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checked_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Explicit FK to Organization
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="effectiveness_checks", foreign_keys="EffectivenessCheck.organization_id")
    capa: Mapped["CorrectiveAction"] = relationship(back_populates="effectiveness_checks")
    checked_by: Mapped[Optional["User"]] = relationship(back_populates="effectiveness_checks")

    def __repr__(self) -> str:
        return f"<EffectivenessCheck(id={self.id}, capa_id={self.capa_id}, result={self.result})>"
