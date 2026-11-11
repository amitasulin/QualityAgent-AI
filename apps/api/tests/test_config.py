"""Unit tests for settings normalization and CORS parsing (no database required)."""
from app.core.config import Settings


def test_plain_postgres_url_is_normalized_for_asyncpg():
    settings = Settings(DATABASE_URL="postgres://user:pass@localhost:5432/qualityagent")

    assert settings.DATABASE_URL == (
        "postgresql+asyncpg://user:pass@localhost:5432/qualityagent"
    )


def test_sslmode_is_mapped_and_channel_binding_removed():
    settings = Settings(
        DATABASE_URL=(
            "postgresql://user:pass@db.example.com/qualityagent"
            "?sslmode=require&channel_binding=require"
        )
    )

    assert "ssl=require" in settings.DATABASE_URL
    assert "channel_binding" not in settings.DATABASE_URL


def test_allowed_origins_accepts_a_json_array():
    settings = Settings(ALLOWED_ORIGINS='["https://app.example.com", "https://admin.example.com"]')

    assert settings.allowed_origins == [
        "https://app.example.com",
        "https://admin.example.com",
    ]


def test_allowed_origins_accepts_a_comma_separated_list():
    settings = Settings(ALLOWED_ORIGINS="https://a.example.com, https://b.example.com")

    assert settings.allowed_origins == ["https://a.example.com", "https://b.example.com"]


def test_allowed_origins_handles_empty_value():
    settings = Settings(ALLOWED_ORIGINS="   ")

    assert settings.allowed_origins == []


def test_defaults_are_safe_for_local_development():
    settings = Settings(_env_file=None)

    assert settings.ALGORITHM == "HS256"
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES > 0
    assert settings.DEMO_TENANT_ID == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
