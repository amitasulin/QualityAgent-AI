"""Document and DocumentVersion models"""
import uuid
from datetime import date, datetime
from typing import Optional, List

from sqlalchemy import DateTime, String, Text, ForeignKey, UniqueConstraint, Enum as SQLEnum, Date, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IDMixin, TimestampMixin, TenantMixin
from app.models.organization import Organization
from app.models.user import User
import enum


class DocumentStatus(str, enum.Enum):
    DRAFT = "draft"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    OBSOLETE = "obsolete"


class Document(Base, IDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_document_tenant_code"),
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[DocumentStatus] = mapped_column(
        SQLEnum(DocumentStatus, name="document_status", values_callable=lambda obj: [e.value for e in obj]),
        default=DocumentStatus.DRAFT,
        nullable=False,
    )
    current_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("document_versions.id", ondelete="SET NULL"),
        nullable=True,
    )
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    effective_until: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, nullable=False)

    # Explicit FK to Organization
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="documents", foreign_keys="Document.organization_id")
    versions: Mapped[List["DocumentVersion"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentVersion.created_at.desc()",
        foreign_keys="DocumentVersion.document_id"
    )
    owner: Mapped[Optional["User"]] = relationship(
        back_populates="owned_documents", foreign_keys=[owner_id]
    )
    approved_by: Mapped[Optional["User"]] = relationship(
        back_populates="approved_documents", foreign_keys=[approved_by_id]
    )
    current_version: Mapped[Optional["DocumentVersion"]] = relationship(
        foreign_keys=[current_version_id], post_update=True
    )

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, code='{self.code}', title='{self.title}', status='{self.status.value}')>"


class DocumentVersion(Base, IDMixin, TimestampMixin):
    __tablename__ = "document_versions"
    __table_args__ = (
        UniqueConstraint("document_id", "version", name="uq_doc_version_doc_ver"),
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    file_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    checksum: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    change_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_current: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Relationships
    document: Mapped["Document"] = relationship(back_populates="versions", foreign_keys="DocumentVersion.document_id")
    uploaded_by: Mapped[Optional["User"]] = relationship(back_populates="document_versions", foreign_keys="DocumentVersion.uploaded_by_id")

    def __repr__(self) -> str:
        return f"<DocumentVersion(id={self.id}, document_id={self.document_id}, version='{self.version}')>"
