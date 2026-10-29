"""Core package initialization"""
from app.core.config import settings
from app.core.database import get_db, init_db, close_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token,
)
from app.core.exceptions import (
    AppException,
    NotFoundError,
    ValidationError,
    AuthorizationError,
    AuthenticationError,
    ConflictError,
    register_exception_handlers,
)

__all__ = [
    "settings",
    "get_db",
    "init_db",
    "close_db",
    "verify_password",
    "get_password_hash",
    "create_access_token",
    "create_refresh_token",
    "verify_token",
    "AppException",
    "NotFoundError",
    "ValidationError",
    "AuthorizationError",
    "AuthenticationError",
    "ConflictError",
    "register_exception_handlers",
]