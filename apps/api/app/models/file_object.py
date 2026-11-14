"""Stored file blobs.

Files are kept in Postgres so uploads survive restarts on hosts without a
persistent disk (e.g. Render's free plan). The row in this table is the source
of truth for the bytes; ``NCRAttachment.file_key`` and
``DocumentVersion.file_key`` point at ``FileObject.key``.
"""
import uuid
from typing import Optional

from sqlalchemy import ForeignKey, LargeBinary, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IDMixin, TenantMixin, TimestampMixin


class FileObject(Base, IDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "file_objects"
    __table_args__ = (
        UniqueConstraint("tenant_id", "key", name="uq_file_object_tenant_key"),
    )

    key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    size_bytes: Mapped[int] = mapped_column(nullable=False)
    checksum: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Explicit FK to Organization (kept in sync with tenant_id by before_flush)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<FileObject(id={self.id}, key='{self.key}', size={self.size_bytes})>"
