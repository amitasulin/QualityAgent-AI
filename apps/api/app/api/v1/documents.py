"""Document routes"""
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_current_tenant, require_role
from app.models.document import Document, DocumentVersion, DocumentStatus
from app.models.user import User
from app.schemas.document import (
    DocumentCreate,
    DocumentUpdate,
    DocumentResponse,
    DocumentListResponse,
    DocumentVersionCreate,
    DocumentVersionResponse,
)
from app.schemas.base import PaginationParams

router = APIRouter()


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    document_data: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Create a new document"""
    existing = await db.execute(
        select(Document).where(Document.tenant_id == tenant.id, Document.code == document_data.code)
    )
    if existing.scalar_one_or_none():
        from app.core.exceptions import ConflictError
        raise ConflictError("Document with this code already exists")

    document_values = document_data.model_dump()
    document_values.pop("owner_id", None)
    document = Document(
        **document_values,
        tenant_id=tenant.id,
        owner_id=current_user.id,
    )
    db.add(document)
    await db.flush()
    await db.refresh(document)
    return document


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    pagination: PaginationParams = Depends(),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status_filter: Optional[DocumentStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """List documents for current tenant"""
    query = select(Document).where(Document.tenant_id == tenant.id)

    if search:
        query = query.where(
            or_(
                Document.code.ilike(f"%{search}%"),
                Document.title.ilike(f"%{search}%"),
                Document.description.ilike(f"%{search}%"),
            )
        )
    if category:
        query = query.where(Document.category == category)
    if status_filter:
        query = query.where(Document.status == status_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)
    query = query.order_by(Document.created_at.desc())

    result = await db.execute(query)
    documents = result.scalars().all()

    return DocumentListResponse.create(
        items=[DocumentResponse.model_validate(d) for d in documents],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Get document by ID with versions"""
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.versions))
        .where(Document.id == document_id, Document.tenant_id == tenant.id)
    )
    document = result.scalar_one_or_none()

    if not document:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Document", str(document_id))

    return document


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: UUID,
    document_data: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Update document"""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.tenant_id == tenant.id)
    )
    document = result.scalar_one_or_none()

    if not document:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Document", str(document_id))

    if document_data.code and document_data.code != document.code:
        existing = await db.execute(
            select(Document).where(
                Document.tenant_id == tenant.id,
                Document.code == document_data.code,
                Document.id != document_id,
            )
        )
        if existing.scalar_one_or_none():
            from app.core.exceptions import ConflictError
            raise ConflictError("Document with this code already exists")

    update_data = document_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(document, field, value)

    await db.flush()
    await db.refresh(document)
    return document


# Document Version routes
@router.post("/{document_id}/versions", response_model=DocumentVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_document_version(
    document_id: UUID,
    version_data: DocumentVersionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Create a new document version"""
    # Verify document exists and belongs to tenant
    doc_result = await db.execute(
        select(Document).where(Document.id == document_id, Document.tenant_id == tenant.id)
    )
    document = doc_result.scalar_one_or_none()

    if not document:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Document", str(document_id))

    # Check version uniqueness
    existing = await db.execute(
        select(DocumentVersion).where(
            DocumentVersion.document_id == document_id,
            DocumentVersion.version == version_data.version,
        )
    )
    if existing.scalar_one_or_none():
        from app.core.exceptions import ConflictError
        raise ConflictError("Version already exists for this document")

    # If this is marked as current, unset other versions
    if version_data.is_current:
        await db.execute(
            select(DocumentVersion)
            .where(DocumentVersion.document_id == document_id)
            .execution_options(synchronize_session="fetch")
        )
        # Reset all to not current
        versions_result = await db.execute(
            select(DocumentVersion).where(DocumentVersion.document_id == document_id)
        )
        for v in versions_result.scalars():
            v.is_current = False

    version = DocumentVersion(
        **version_data.model_dump(exclude={"document_id"}),
        document_id=document_id,
        uploaded_by_id=current_user.id,
    )
    db.add(version)
    await db.flush()

    # Update document's current_version_id if this is current
    if version_data.is_current:
        document.current_version_id = version.id
        document.status = DocumentStatus.PUBLISHED

    await db.refresh(version)
    return version


@router.get("/{document_id}/versions", response_model=List[DocumentVersionResponse])
async def list_document_versions(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """List all versions of a document"""
    # Verify document exists and belongs to tenant
    doc_result = await db.execute(
        select(Document).where(Document.id == document_id, Document.tenant_id == tenant.id)
    )
    if not doc_result.scalar_one_or_none():
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Document", str(document_id))

    result = await db.execute(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.created_at.desc())
    )
    versions = result.scalars().all()

    return [DocumentVersionResponse.model_validate(v) for v in versions]