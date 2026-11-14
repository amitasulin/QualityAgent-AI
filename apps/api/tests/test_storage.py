"""Storage layer tests (no database required)."""
import io
from uuid import uuid4

import pytest
from fastapi import UploadFile
from starlette.datastructures import Headers

from app.core.config import settings
from app.core.exceptions import ValidationError
from app.models.file_object import FileObject
from app.services import storage


def make_upload(content: bytes, filename: str = "test.pdf", content_type: str = "application/pdf"):
    return UploadFile(
        file=io.BytesIO(content),
        size=len(content),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


def test_sanitize_filename_strips_paths_and_control_characters():
    assert storage.sanitize_filename("../../etc/passwd") == "passwd"
    assert storage.sanitize_filename("C:\\temp\\report.pdf") == "report.pdf"
    assert storage.sanitize_filename("bad\x00name\n.pdf") == "badname.pdf"
    assert storage.sanitize_filename("") == "file"
    assert storage.sanitize_filename(None) == "file"


def test_sanitize_filename_keeps_hebrew_and_letters():
    assert storage.sanitize_filename("נוהל איכות.pdf") == "נוהל איכות.pdf"


def test_sanitize_filename_limits_length():
    long_name = "a" * 400 + ".pdf"
    assert len(storage.sanitize_filename(long_name)) == 180


def test_sanitize_mime_type_drops_unsafe_characters():
    assert storage.sanitize_mime_type("application/pdf") == "application/pdf"
    assert storage.sanitize_mime_type("text/html; charset=utf-8") == "text/html"
    assert storage.sanitize_mime_type(None) is None
    assert storage.sanitize_mime_type("") is None


def test_build_storage_key_is_tenant_scoped_and_unique():
    tenant_id = uuid4()
    first = storage.build_storage_key("ncr/123", tenant_id, "photo.jpg")
    second = storage.build_storage_key("ncr/123", tenant_id, "photo.jpg")

    assert first.startswith(f"ncr/123/{tenant_id}/")
    assert first.endswith("-photo.jpg")
    assert first != second


@pytest.mark.asyncio
async def test_read_upload_returns_bytes_and_checksum():
    data, checksum = await storage.read_upload(make_upload(b"hello world"))

    assert data == b"hello world"
    assert checksum == "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"


@pytest.mark.asyncio
async def test_read_upload_rejects_empty_files():
    with pytest.raises(ValidationError):
        await storage.read_upload(make_upload(b""))


@pytest.mark.asyncio
async def test_read_upload_enforces_the_configured_size_limit(monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_MB", 1)

    with pytest.raises(ValidationError):
        await storage.read_upload(make_upload(b"x" * (1024 * 1024 + 1)))


def test_stream_file_sets_download_headers():
    file_object = FileObject(
        key="ncr/1/t/file.pdf",
        file_name="נוהל איכות.pdf",
        mime_type="application/pdf",
        size_bytes=5,
        content=b"%PDF-",
        tenant_id=uuid4(),
        organization_id=uuid4(),
    )

    response = storage.stream_file(file_object)

    assert response.media_type == "application/pdf"
    assert response.headers["content-length"] == "5"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "filename*=UTF-8''" in response.headers["content-disposition"]
