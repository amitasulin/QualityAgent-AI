"""Document routes"""
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status, File, Form, UploadFile
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.sorting import apply_sorting
from app.api.dependencies import get_current_user, get_current_tenant, require_role
from app.models.document import Document, DocumentVersion, DocumentStatus
from app.models.user import User
from app.services.storage import get_file, save_upload, stream_file
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

DOCUMENT_SORT_COLUMNS = {
    "code": Document.code,
    "title": Document.title,
    "category": Document.category,
    "status": Document.status,
    "effective_from": Document.effective_from,
    "effective_until": Document.effective_until,
    "created_at": Document.created_at,
    "updated_at": Document.updated_at,
}


async def _unset_current_versions(db: AsyncSession, document_id: UUID) -> None:
    """Mark every existing version of a document as not current."""
    versions_result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == document_id)
    )
    for existing_version in versions_result.scalars():
        existing_version.is_current = False


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

    query = apply_sorting(
        query,
        DOCUMENT_SORT_COLUMNS,
        pagination.sort_by,
        pagination.sort_order,
        default_order=Document.created_at.desc(),
    )
    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)

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
        await _unset_current_versions(db, document_id)

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


@router.post(
    "/{document_id}/versions/upload",
    response_model=DocumentVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document_version(
    document_id: UUID,
    file: UploadFile = File(...),
    version: str = Form(...),
    change_summary: Optional[str] = Form(None),
    is_current: bool = Form(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Create a document version from a real uploaded file."""
    from app.core.exceptions import ConflictError, NotFoundError

    doc_result = await db.execute(
        select(Document).where(Document.id == document_id, Document.tenant_id == tenant.id)
    )
    document = doc_result.scalar_one_or_none()
    if not document:
        raise NotFoundError("Document", str(document_id))

    clean_version = version.strip()
    if not clean_version:
        raise ConflictError("Version is required")

    existing = await db.execute(
        select(DocumentVersion).where(
            DocumentVersion.document_id == document_id,
            DocumentVersion.version == clean_version,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError("Version already exists for this document")

    stored = await save_upload(
        db,
        upload=file,
        tenant_id=tenant.id,
        prefix=f"documents/{document_id}",
        user_id=current_user.id,
    )

    if is_current:
        await _unset_current_versions(db, document_id)

    version_row = DocumentVersion(
        document_id=document_id,
        version=clean_version,
        file_key=stored.key,
        file_name=stored.file_name,
        file_size=stored.size_bytes,
        mime_type=stored.mime_type,
        checksum=stored.checksum,
        change_summary=(change_summary or "").strip() or None,
        is_current=is_current,
        uploaded_by_id=current_user.id,
    )
    db.add(version_row)
    await db.flush()

    if is_current:
        document.current_version_id = version_row.id
        document.status = DocumentStatus.PUBLISHED

    await db.refresh(version_row)
    return version_row


@router.get("/{document_id}/versions/{version_id}/download")
async def download_document_version(
    document_id: UUID,
    version_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Download the stored file of a document version."""
    from app.core.exceptions import NotFoundError

    result = await db.execute(
        select(DocumentVersion)
        .join(Document)
        .where(
            DocumentVersion.id == version_id,
            DocumentVersion.document_id == document_id,
            Document.tenant_id == tenant.id,
        )
    )
    version_row = result.scalar_one_or_none()
    if not version_row:
        raise NotFoundError("DocumentVersion", str(version_id))

    file_object = await get_file(db, tenant_id=tenant.id, key=version_row.file_key)
    if not file_object:
        raise NotFoundError("File", version_row.file_name)

    return stream_file(file_object)


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