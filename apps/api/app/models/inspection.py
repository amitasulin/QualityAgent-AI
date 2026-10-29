"""Quality Inspection models: plans, inspections and measurement results"""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    DateTime,
    ForeignKey,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IDMixin, TimestampMixin, TenantMixin


class InspectionType(str, enum.Enum):
    INCOMING = "incoming"
    IN_PROCESS = "in_process"
    FINAL = "final"
    AUDIT = "audit"


class InspectionStatus(str, enum.Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    FAILED = "failed"
    ON_HOLD = "on_hold"


class InspectionResultValue(str, enum.Enum):
    PASS = "pass"
    FAIL = "fail"
    NA = "na"


class InspectionPlan(Base, IDMixin, TimestampMixin, TenantMixin):
    """Template describing what to inspect and how often"""

    __tablename__ = "inspection_plans"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_inspection_plan_tenant_code"),
    )

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    inspection_type: Mapped[InspectionType] = mapped_column(
        SQLEnum(
            InspectionType,
            name="inspection_type",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=InspectionType.IN_PROCESS,
        nullable=False,
    )
    frequency: Mapped[str] = mapped_column(String(50), default="per_lot", nullable=False)
    sample_size: Mapped[int] = mapped_column(default=5, nullable=False)
    characteristics: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    site_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("sites.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )

    organization: Mapped["Organization"] = relationship(foreign_keys=[organization_id])
    product: Mapped[Optional["Product"]] = relationship(foreign_keys=[product_id])
    site: Mapped[Optional["Site"]] = relationship(foreign_keys=[site_id])
    inspections: Mapped[list["Inspection"]] = relationship(back_populates="plan")

    def __repr__(self) -> str:
        return f"<InspectionPlan(id={self.id}, code='{self.code}')>"


class Inspection(Base, IDMixin, TimestampMixin, TenantMixin):
    """A single executed (or planned) inspection"""

    __tablename__ = "inspections"
    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_inspection_tenant_number"),
    )

    number: Mapped[str] = mapped_column(String(50), nullable=False)
    inspection_type: Mapped[InspectionType] = mapped_column(
        SQLEnum(
            InspectionType,
            name="inspection_type",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=InspectionType.IN_PROCESS,
        nullable=False,
    )
    status: Mapped[InspectionStatus] = mapped_column(
        SQLEnum(
            InspectionStatus,
            name="inspection_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=InspectionStatus.PLANNED,
        nullable=False,
    )
    plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("inspection_plans.id", ondelete="SET NULL"), nullable=True
    )
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    site_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("sites.id", ondelete="SET NULL"), nullable=True
    )
    lot_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    inspector_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    inspected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sample_size: Mapped[int] = mapped_column(default=5, nullable=False)
    passed_count: Mapped[int] = mapped_column(default=0, nullable=False)
    failed_count: Mapped[int] = mapped_column(default=0, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ncr_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("nonconformities.id", ondelete="SET NULL"), nullable=True
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )

    organization: Mapped["Organization"] = relationship(foreign_keys=[organization_id])
    plan: Mapped[Optional["InspectionPlan"]] = relationship(back_populates="inspections")
    product: Mapped[Optional["Product"]] = relationship(foreign_keys=[product_id])
    site: Mapped[Optional["Site"]] = relationship(foreign_keys=[site_id])
    inspector: Mapped[Optional["User"]] = relationship(foreign_keys=[inspector_id])
    ncr: Mapped[Optional["Nonconformity"]] = relationship(foreign_keys=[ncr_id])
    results: Mapped[list["InspectionResult"]] = relationship(
        back_populates="inspection", cascade="all, delete-orphan"
    )

    @property
    def pass_rate(self) -> Optional[float]:
        total = self.passed_count + self.failed_count
        if total == 0:
            return None
        return round(self.passed_count / total * 100, 2)

    def __repr__(self) -> str:
        return f"<Inspection(id={self.id}, number='{self.number}', status='{self.status.value}')>"


class InspectionResult(Base, IDMixin, TimestampMixin, TenantMixin):
    """A single measurement recorded during an inspection"""

    __tablename__ = "inspection_results"

    inspection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False
    )
    characteristic: Mapped[str] = mapped_column(String(255), nullable=False)
    nominal: Mapped[Optional[float]] = mapped_column(Numeric(15, 5), nullable=True)
    tolerance_plus: Mapped[Optional[float]] = mapped_column(Numeric(15, 5), nullable=True)
    tolerance_minus: Mapped[Optional[float]] = mapped_column(Numeric(15, 5), nullable=True)
    measured_value: Mapped[Optional[float]] = mapped_column(Numeric(15, 5), nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    result: Mapped[InspectionResultValue] = mapped_column(
        SQLEnum(
            InspectionResultValue,
            name="inspection_result",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=InspectionResultValue.PASS,
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )

    inspection: Mapped["Inspection"] = relationship(back_populates="results")

    def __repr__(self) -> str:
        return f"<InspectionResult(id={self.id}, characteristic='{self.characteristic}')>"
