"""Agent Run and Agent Recommendation models"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text, ForeignKey, Enum as SQLEnum, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IDMixin, TimestampMixin, TenantMixin
from app.models.organization import Organization
from app.models.user import User
import enum


class AgentRunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentRecommendationType(str, enum.Enum):
    REPEATED_DEFECT = "repeated_defect"
    OVERDUE_CAPA = "overdue_capa"
    DOCUMENT_EXPIRY = "document_expiry"
    TREND_ALERT = "trend_alert"
    RCA_SUGGESTION = "rca_suggestion"
    INSPECTION_SCHEDULE = "inspection_schedule"
    SUPPLIER_ALERT = "supplier_alert"


class AgentRecommendationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    IMPLEMENTED = "implemented"


class AgentRun(Base, IDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "agent_runs"

    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)  # scheduled, manual, event
    trigger_details: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[AgentRunStatus] = mapped_column(
        SQLEnum(AgentRunStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=AgentRunStatus.PENDING,
        nullable=False,
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    result_summary: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Explicit FK to Organization
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="agent_runs", foreign_keys="AgentRun.organization_id")
    recommendations: Mapped[list["AgentRecommendation"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AgentRun(id={self.id}, trigger='{self.trigger_type}', status='{self.status.value}')>"


class AgentRecommendation(Base, IDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "agent_recommendations"

    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("agent_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[AgentRecommendationType] = mapped_column(
        SQLEnum(AgentRecommendationType, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # info, warning, critical
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # low, medium, high
    evidence: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    missing_information: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    recommended_action: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[AgentRecommendationStatus] = mapped_column(
        SQLEnum(AgentRecommendationStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=AgentRecommendationStatus.PENDING,
        nullable=False,
    )
    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    implemented_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Explicit FK to Organization
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="agent_recommendations", foreign_keys="AgentRecommendation.organization_id")
    run: Mapped["AgentRun"] = relationship(back_populates="recommendations")
    approved_by: Mapped[Optional["User"]] = relationship(back_populates="agent_recommendations_approved")

    def __repr__(self) -> str:
        return f"<AgentRecommendation(id={self.id}, type='{self.type.value}', status='{self.status.value}')>"
