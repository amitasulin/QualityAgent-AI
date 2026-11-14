"""Generic attachments for records that need supporting files.

NCR attachments keep their dedicated table for backwards compatibility; this
table covers complaints, inspections, corrective actions and tasks.
"""
import uuid
from typing import Optional

from sqlalchemy import ForeignKey, Index, String, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IDMixin, TimestampMixin, TenantMixin


class Attachment(Base, IDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "attachments"
    __table_args__ = (
        Index("ix_attachments_entity", "tenant_id", "entity_type", "entity_id"),
    )

    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    file_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    def __repr__(self) -> str:
        return (
            f"<Attachment(id={self.id}, entity='{self.entity_type}:{self.entity_id}', "
            f"file_name='{self.file_name}')>"
        )
