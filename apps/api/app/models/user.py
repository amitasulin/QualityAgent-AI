"""User model"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text, ForeignKey, UniqueConstraint, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IDMixin, TimestampMixin, TenantMixin
from app.models.organization import Organization
from app.models.site import Site
import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    QUALITY_MANAGER = "quality_manager"
    QUALITY_INSPECTOR = "quality_inspector"
    PRODUCTION_WORKER = "production_worker"
    VIEWER = "viewer"

    @classmethod
    def _missing_(cls, value):
        # Allow lookup by value (database stores lowercase values)
        for member in cls:
            if member.value == value:
                return member
        return None


class User(Base, IDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("tenant_id", "identity_id", name="uq_user_tenant_identity"),
        UniqueConstraint("tenant_id", "email", name="uq_user_tenant_email"),
    )

    identity_id: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole, name="user_role", values_callable=lambda obj: [e.value for e in obj]),
        default=UserRole.VIEWER,
        nullable=False,
    )
    site_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("sites.id", ondelete="SET NULL"),
        nullable=True,
    )
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Explicit FK to Organization (separate from tenant_id)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="users", foreign_keys="User.organization_id")
    site: Mapped[Optional["Site"]] = relationship(back_populates="users")
    detected_ncrs: Mapped[list["Nonconformity"]] = relationship(
        back_populates="detected_by", foreign_keys="Nonconformity.detected_by_id"
    )
    assigned_ncrs: Mapped[list["Nonconformity"]] = relationship(
        back_populates="assigned_to", foreign_keys="Nonconformity.assigned_to_id"
    )
    owned_documents: Mapped[list["Document"]] = relationship(
        back_populates="owner", foreign_keys="Document.owner_id"
    )
    approved_documents: Mapped[list["Document"]] = relationship(
        back_populates="approved_by", foreign_keys="Document.approved_by_id"
    )
    document_versions: Mapped[list["DocumentVersion"]] = relationship(back_populates="uploaded_by")
    capa_owned: Mapped[list["CorrectiveAction"]] = relationship(back_populates="owner", foreign_keys="CorrectiveAction.owner_id")
    capa_verified: Mapped[list["CorrectiveAction"]] = relationship(
        back_populates="verified_by", foreign_keys="CorrectiveAction.verified_by_id"
    )
    effectiveness_checks: Mapped[list["EffectivenessCheck"]] = relationship(back_populates="checked_by", foreign_keys="EffectivenessCheck.checked_by_id")
    agent_recommendations_approved: Mapped[list["AgentRecommendation"]] = relationship(
        back_populates="approved_by", foreign_keys="AgentRecommendation.approved_by_id"
    )
    audit_events: Mapped[list["AuditEvent"]] = relationship(back_populates="actor")
    tasks_assigned: Mapped[list["Task"]] = relationship(
        back_populates="assignee", foreign_keys="Task.assignee_id"
    )
    tasks_reported: Mapped[list["Task"]] = relationship(
        back_populates="reporter", foreign_keys="Task.reporter_id"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role.value}')>"
