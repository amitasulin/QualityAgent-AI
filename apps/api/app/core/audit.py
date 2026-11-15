"""Audit trail middleware.

Every successful mutating API call writes one row to ``audit_events``. The
middleware runs after the response, uses its own database session, and never
lets an audit failure break the request.

This is intentionally request-level auditing: it records who changed what,
when, from where, and through which endpoint. It is the baseline required by
quality-management systems (ISO 9001/13485) and can later be enriched with
field-level diffs inside the services.
"""
import json
import logging
import re
import uuid
from typing import Optional

from app.core.database import AsyncSessionLocal
from app.core.security import verify_token
from app.models.audit import AuditEvent

logger = logging.getLogger("qualityagent.audit")

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Authentication plumbing that should not clutter the business audit log.
SKIP_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/demo-login",
}

ENTITY_ALIASES = {
    "nonconformities": "nonconformity",
    "corrective-actions": "corrective_action",
    "inspections": "inspection",
    "complaints": "complaint",
    "documents": "document",
    "tasks": "task",
    "users": "user",
    "sites": "site",
    "products": "product",
    "customers": "customer",
    "suppliers": "supplier",
    "attachments": "attachment",
    "organizations": "organization",
    "agent": "agent",
}

ACTION_ALIASES = {
    "attachments": "upload",
    "upload": "upload",
    "versions": "add_version",
    "complete": "complete",
    "verify": "verify",
    "start": "start",
    "submit": "submit",
    "status": "status_change",
    "results": "add_result",
    "plans": "create_plan",
    "create-ncr": "create_ncr",
    "action": "act",
    "effectiveness": "record_effectiveness",
    "approve": "approve",
    "reject": "reject",
    "archive": "archive",
    "run": "run",
    "runs": "run",
    "change-password": "change_password",
}

UUID_RE = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)

# Only buffer small JSON bodies; exports and file downloads are never parsed.
MAX_CAPTURED_BODY = 512 * 1024


def _first_uuid(path: str) -> Optional[uuid.UUID]:
    match = UUID_RE.search(path)
    return uuid.UUID(match.group(0)) if match else None


def _entity_from_path(path: str) -> tuple[str, Optional[uuid.UUID]]:
    """Return (entity_type, entity_id) from an /api/v1/... path."""
    parts = [part for part in path.split("/") if part]
    if len(parts) < 3:
        return "api", None
    raw = parts[2]
    if raw == "auth":
        return "user", _first_uuid(path)
    return ENTITY_ALIASES.get(raw, raw.rstrip("s") or raw), _first_uuid(path)


def _action_for(method: str, path: str) -> str:
    """Translate an HTTP verb + path into a readable audit action."""
    if method == "DELETE":
        return "delete"
    if method in {"PUT", "PATCH"}:
        return "update"
    if method == "POST":
        tail = path.rstrip("/").split("/")[-1]
        if tail in ACTION_ALIASES:
            return ACTION_ALIASES[tail]
        return "create"
    return method.lower()


def _entity_id_from_body(body: bytes) -> Optional[uuid.UUID]:
    """Read the created/updated record id from a JSON response body."""
    if not body:
        return None
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    for key in ("id", "entity_id"):
        value = payload.get(key)
        if isinstance(value, str):
            try:
                return uuid.UUID(value)
            except ValueError:
                continue
    return None


def _auth_context(
    headers: dict[str, str],
) -> tuple[Optional[uuid.UUID], Optional[uuid.UUID]]:
    """Read (user_id, tenant_id) from the bearer token without failing the request."""
    header = headers.get("authorization") or ""
    if not header.startswith("Bearer "):
        return None, None
    payload = verify_token(header.split(" ", 1)[1], "access")
    if not payload:
        return None, None
    try:
        user_id = uuid.UUID(payload["sub"]) if payload.get("sub") else None
        tenant_id = uuid.UUID(payload["tenant_id"]) if payload.get("tenant_id") else None
    except (ValueError, TypeError):
        return None, None
    return user_id, tenant_id


async def write_audit_event(
    *,
    tenant_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID],
    method: str,
    path: str,
    status_code: int,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    correlation_id: Optional[uuid.UUID] = None,
    actor_type: Optional[str] = None,
    details: Optional[dict] = None,
) -> None:
    """Persist one audit row. Callers treat failures as non-fatal."""
    async with AsyncSessionLocal() as session:
        try:
            session.add(
                AuditEvent(
                    tenant_id=tenant_id,
                    organization_id=tenant_id,
                    actor_id=user_id,
                    actor_type=actor_type or ("user" if user_id else "system"),
                    action=action,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    new_values={
                        "method": method,
                        "path": path,
                        "status": status_code,
                        **(details or {}),
                    },
                    ip_address=ip_address,
                    user_agent=user_agent,
                    correlation_id=correlation_id,
                )
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("Failed to write audit event for %s %s", method, path)


class AuditMiddleware:
    """Record successful mutations in the audit trail.

    Implemented as a pure ASGI middleware (not ``BaseHTTPMiddleware``) so the
    response body can be inspected: the id of a freshly created record only
    exists in the response JSON.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or scope.get("method") not in MUTATING_METHODS:
            await self.app(scope, receive, send)
            return

        path: str = scope.get("path", "")
        method: str = scope.get("method", "")
        if not path.startswith("/api/v1") or path in SKIP_PATHS:
            await self.app(scope, receive, send)
            return

        response_start: dict = {}
        chunks: list[bytes] = []
        captured_size = 0
        capture_failed = False

        async def send_wrapper(message):
            nonlocal captured_size, capture_failed
            if message["type"] == "http.response.start":
                response_start.update(message)
            elif message["type"] == "http.response.body" and not capture_failed:
                body = message.get("body", b"")
                captured_size += len(body)
                if captured_size > MAX_CAPTURED_BODY:
                    capture_failed = True
                    chunks.clear()
                else:
                    chunks.append(body)
            await send(message)

        await self.app(scope, receive, send_wrapper)

        status_code = response_start.get("status", 0)
        if status_code >= 400:
            return

        headers = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope.get("headers", [])
        }
        user_id, tenant_id = _auth_context(headers)
        if not tenant_id:
            return

        entity_type, entity_id = _entity_from_path(path)
        if entity_id is None and not capture_failed:
            entity_id = _entity_id_from_body(b"".join(chunks))

        action = _action_for(method, path)

        correlation_id = None
        raw_correlation = headers.get("x-request-id")
        if raw_correlation:
            try:
                correlation_id = uuid.UUID(raw_correlation)
            except ValueError:
                correlation_id = None

        user_agent = headers.get("user-agent")
        if user_agent:
            user_agent = user_agent[:1000]

        client = scope.get("client")
        try:
            await write_audit_event(
                tenant_id=tenant_id,
                user_id=user_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                method=method,
                path=path,
                status_code=status_code,
                ip_address=client[0] if client else None,
                user_agent=user_agent,
                correlation_id=correlation_id,
            )
        except Exception:
            # Never break a successful business request because auditing failed.
            logger.exception("Audit middleware failed for %s %s", method, path)
