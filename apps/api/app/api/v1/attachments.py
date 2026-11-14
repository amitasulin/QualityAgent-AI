"""Generic attachment upload/download endpoints."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_tenant, get_current_user, require_role
from app.core.database import get_db
from app.core.exceptions import NotFoundError, ValidationError as AppValidationError
from app.models.attachment import Attachment
from app.models.complaint import Complaint
from app.models.corrective_action import CorrectiveAction
from app.models.inspection import Inspection
from app.models.task import Task
from app.models.user import User
from app.schemas.attachment import AttachmentResponse
from app.services.storage import delete_file, get_file, save_upload, stream_file

router = APIRouter()

# Records that may own attachments through this generic endpoint.
ENTITY_MODELS = {
    "complaint": Complaint,
    "inspection": Inspection,
    "corrective_action": CorrectiveAction,
    "task": Task,
}


def _model_for(entity_type: str):
    model = ENTITY_MODELS.get(entity_type)
    if model is None:
        raise AppValidationError(f"Unsupported attachment entity type: {entity_type}")
    return model


async def _ensure_entity_exists(db: AsyncSession, tenant_id, entity_type: str, entity_id: UUID):
    model = _model_for(entity_type)
    result = await db.execute(
        select(model.id).where(model.id == entity_id, model.tenant_id == tenant_id)
    )
    if result.scalar_one_or_none() is None:
        raise NotFoundError(entity_type, str(entity_id))


@router.get("", response_model=List[AttachmentResponse])
async def list_attachments(
    entity_type: str = Query(..., max_length=50),
    entity_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """List the files attached to one record."""
    _model_for(entity_type)
    result = await db.execute(
        select(Attachment)
        .where(
            Attachment.tenant_id == tenant.id,
            Attachment.entity_type == entity_type,
            Attachment.entity_id == entity_id,
        )
        .order_by(Attachment.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=AttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    entity_type: str = Form(..., max_length=50),
    entity_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Attach a file to a complaint, inspection, corrective action or task."""
    await _ensure_entity_exists(db, tenant.id, entity_type, entity_id)

    stored = await save_upload(
        db,
        upload=file,
        tenant_id=tenant.id,
        prefix=f"{entity_type}/{entity_id}",
        user_id=current_user.id,
    )

    attachment = Attachment(
        entity_type=entity_type,
        entity_id=entity_id,
        file_key=stored.key,
        file_name=stored.file_name,
        file_size=stored.size_bytes,
        mime_type=stored.mime_type,
        uploaded_by_id=current_user.id,
        tenant_id=tenant.id,
    )
    db.add(attachment)
    await db.flush()
    await db.refresh(attachment)
    return attachment


@router.get("/{attachment_id}/download")
async def download_attachment(
    attachment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant=Depends(get_current_tenant),
):
    """Download an attachment through the API (auth cookies stay on the web origin)."""
    result = await db.execute(
        select(Attachment).where(
            Attachment.id == attachment_id,
            Attachment.tenant_id == tenant.id,
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise NotFoundError("Attachment", str(attachment_id))

    file_object = await get_file(db, tenant_id=tenant.id, key=attachment.file_key)
    if not file_object:
        raise NotFoundError("File", attachment.file_name)

    return stream_file(file_object)


@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    attachment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "quality_manager")),
    tenant=Depends(get_current_tenant),
):
    """Delete an attachment (managers only)."""
    result = await db.execute(
        select(Attachment).where(
            Attachment.id == attachment_id,
            Attachment.tenant_id == tenant.id,
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise NotFoundError("Attachment", str(attachment_id))

    await delete_file(db, tenant_id=tenant.id, key=attachment.file_key)
    await db.delete(attachment)
