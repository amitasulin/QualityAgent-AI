"""File storage helpers.

Default backend: Postgres (``file_objects``). This keeps uploads durable on
hosts without a persistent disk. When an S3-compatible bucket is configured
later, only this module needs a second implementation — callers keep using the
same ``save_upload`` / ``get_file`` / ``delete_file`` API.
"""
import hashlib
import io
import re
import uuid
from typing import Optional
from urllib.parse import quote

from fastapi import UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ValidationError
from app.models.file_object import FileObject

_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9._\-\u0590-\u05FF ]+")
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_MIME_CHARS = re.compile(r"[^A-Za-z0-9.+/_-]+")


def sanitize_filename(name: Optional[str]) -> str:
    """Return a safe basename, keeping Hebrew letters and a readable name."""
    base = (name or "").replace("\\", "/").split("/")[-1].strip()
    base = _CONTROL_CHARS.sub("", base)
    base = _UNSAFE_CHARS.sub("_", base)
    base = base.strip(" .")
    if not base:
        return "file"
    return base[:180]


def sanitize_mime_type(mime_type: Optional[str]) -> Optional[str]:
    if not mime_type:
        return None
    # Keep only the media type; parameters such as "; charset=utf-8" are dropped.
    media_type = mime_type.split(";", 1)[0].strip()
    cleaned = _MIME_CHARS.sub("", media_type)[:150]
    return cleaned or None


def build_storage_key(prefix: str, tenant_id: uuid.UUID, filename: str) -> str:
    """Build a collision-free key such as ``ncr/<id>/<tenant>/<uuid>-<name>``."""
    clean_prefix = prefix.strip("/")
    safe_name = sanitize_filename(filename)
    return f"{clean_prefix}/{tenant_id}/{uuid.uuid4().hex}-{safe_name}"


def max_upload_bytes() -> int:
    return max(1, settings.MAX_UPLOAD_SIZE_MB) * 1024 * 1024


async def read_upload(upload: UploadFile) -> tuple[bytes, str]:
    """Read an upload while enforcing the size limit. Returns (bytes, sha256)."""
    limit = max_upload_bytes()
    data = await upload.read(limit + 1)
    if len(data) > limit:
        raise ValidationError(
            f"File is too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB} MB"
        )
    if not data:
        raise ValidationError("File is empty")
    return data, hashlib.sha256(data).hexdigest()


async def save_upload(
    db: AsyncSession,
    *,
    upload: UploadFile,
    tenant_id: uuid.UUID,
    prefix: str,
    user_id: Optional[uuid.UUID] = None,
) -> FileObject:
    """Persist an upload and return the stored file record."""
    data, checksum = await read_upload(upload)
    file_name = sanitize_filename(upload.filename)

    file_object = FileObject(
        key=build_storage_key(prefix, tenant_id, file_name),
        file_name=file_name,
        mime_type=sanitize_mime_type(upload.content_type),
        size_bytes=len(data),
        checksum=checksum,
        content=data,
        uploaded_by_id=user_id,
        tenant_id=tenant_id,
    )
    db.add(file_object)
    await db.flush()
    return file_object


async def get_file(
    db: AsyncSession, *, tenant_id: uuid.UUID, key: str
) -> Optional[FileObject]:
    result = await db.execute(
        select(FileObject).where(
            FileObject.tenant_id == tenant_id, FileObject.key == key
        )
    )
    return result.scalar_one_or_none()


async def delete_file(db: AsyncSession, *, tenant_id: uuid.UUID, key: str) -> bool:
    file_object = await get_file(db, tenant_id=tenant_id, key=key)
    if not file_object:
        return False
    await db.delete(file_object)
    return True


def stream_file(file_object: FileObject, *, as_attachment: bool = True) -> StreamingResponse:
    """Stream a stored file with a safe, UTF-8 aware download name."""
    disposition = "attachment" if as_attachment else "inline"
    headers = {
        "Content-Disposition": (
            f"{disposition}; filename*=UTF-8''{quote(file_object.file_name)}"
        ),
        "Content-Length": str(file_object.size_bytes),
        "X-Content-Type-Options": "nosniff",
    }
    return StreamingResponse(
        io.BytesIO(file_object.content),
        media_type=file_object.mime_type or "application/octet-stream",
        headers=headers,
    )
