"""Unit tests for password hashing and JWT helpers (no database required)."""
from datetime import timedelta

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
    verify_token,
)


def test_password_hash_roundtrip():
    hashed = get_password_hash("demo123")

    assert hashed != "demo123"
    assert verify_password("demo123", hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_verify_password_rejects_invalid_hash():
    assert verify_password("demo123", "not-a-bcrypt-hash") is False


def test_long_passwords_use_the_same_first_72_bytes():
    base = "a" * 72
    hashed = get_password_hash(base + "suffix-one")

    # bcrypt only considers the first 72 bytes, so both suffixes must verify.
    assert verify_password(base + "suffix-two", hashed) is True


def test_access_token_roundtrip():
    token = create_access_token({"sub": "user-1", "tenant_id": "tenant-1"})
    payload = decode_token(token)

    assert payload["sub"] == "user-1"
    assert payload["tenant_id"] == "tenant-1"
    assert payload["type"] == "access"
    assert verify_token(token) is not None


def test_refresh_token_has_its_own_type():
    token = create_refresh_token({"sub": "user-1"})

    assert verify_token(token) is None
    assert verify_token(token, token_type="refresh")["sub"] == "user-1"


def test_expired_token_is_rejected():
    token = create_access_token({"sub": "user-1"}, expires_delta=timedelta(seconds=-1))

    assert decode_token(token) == {}
    assert verify_token(token) is None


def test_malformed_token_is_rejected():
    assert decode_token("this-is-not-a-jwt") == {}
    assert verify_token("this-is-not-a-jwt") is None
