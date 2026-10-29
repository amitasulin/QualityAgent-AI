"""Audit Event model"""
import uuid
from datetime import timezone, datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import INET

from app.models.base import Base, IDMixin, TenantMixin
from app.models.organization import Organization
from app.models.user import User


class AuditEvent(Base, IDMixin, TenantMixin):
    __tablename__ = "audit_events"
    __table_args__ = (
        Index("ix_audit_events_entity", "entity_type", "entity_id"),
        Index("ix_audit_events_created", "created_at"),
        Index("ix_audit_events_actor", "actor_id"),
    )

    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # user, agent, system
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(nullable=True)
    old_values: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    new_values: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(INET, nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    correlation_id: Mapped[Optional[uuid.UUID]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Explicit FK to Organization
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="audit_events", foreign_keys="AuditEvent.organization_id")
    actor: Mapped[Optional["User"]] = relationship(back_populates="audit_events")

    def __repr__(self) -> str:
        return f"<AuditEvent(id={self.id}, action='{self.action}', entity='{self.entity_type}:{self.entity_id}')>"