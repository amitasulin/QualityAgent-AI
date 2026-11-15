"""Audit trail middleware.

Every successful mutating API call writes one row to ``audit_events``. The
middleware runs after the response, uses its own database session, and never
lets an audit failure break the request.

This is intentionally request-level auditing: it records who changed what,
when, from where, and through which endpoint. It is the baseline required by
quality-management systems (ISO 9001/13485) and can later be enriched with
field-level diffs inside the services.
"""
import logging
import re
import uuid
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

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
        if UUID_RE.fullmatch(tail):
            return "create"
        return "create"
    return method.lower()


def _auth_context(request: Request) -> tuple[Optional[uuid.UUID], Optional[uuid.UUID]]:
    """Read (user_id, tenant_id) from the bearer token without failing the request."""
    header = request.headers.get("authorization") or ""
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


async def _write_event(
    *,
    tenant_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID],
    request: Request,
    status_code: int,
) -> None:
    correlation_id = None
    raw_correlation = request.headers.get("x-request-id")
    if raw_correlation:
        try:
            correlation_id = uuid.UUID(raw_correlation)
        except ValueError:
            correlation_id = None

    user_agent = request.headers.get("user-agent")
    if user_agent:
        user_agent = user_agent[:1000]

    async with AsyncSessionLocal() as session:
        try:
            session.add(
                AuditEvent(
                    tenant_id=tenant_id,
                    organization_id=tenant_id,
                    actor_id=user_id,
                    actor_type="user" if user_id else "system",
                    action=action,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    new_values={
                        "method": request.method,
                        "path": request.url.path,
                        "status": status_code,
                    },
                    ip_address=request.client.host if request.client else None,
                    user_agent=user_agent,
                    correlation_id=correlation_id,
                )
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("Failed to write audit event for %s %s", request.method, request.url.path)


class AuditMiddleware(BaseHTTPMiddleware):
    """Record successful mutations in the audit trail."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        if (
            request.method not in MUTATING_METHODS
            or not request.url.path.startswith("/api/v1")
            or request.url.path in SKIP_PATHS
            or response.status_code >= 400
        ):
            return response

        user_id, tenant_id = _auth_context(request)
        if not tenant_id:
            return response

        entity_type, entity_id = _entity_from_path(request.url.path)
        action = _action_for(request.method, request.url.path)

        try:
            await _write_event(
                tenant_id=tenant_id,
                user_id=user_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                request=request,
                status_code=response.status_code,
            )
        except Exception:
            # Never break a successful business request because auditing failed.
            logger.exception("Audit middleware failed for %s %s", request.method, request.url.path)

        return response
