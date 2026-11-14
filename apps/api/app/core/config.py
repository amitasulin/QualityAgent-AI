"""Application configuration using Pydantic Settings"""
import json
from functools import lru_cache
from typing import List
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_NAME: str = "QualityAgent"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://qualityagent:qualityagent_dev@localhost:5432/qualityagent"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    # Accepts either a comma separated list or a JSON array:
    #   https://app.vercel.app,https://app-git-main.vercel.app
    #   ["https://app.vercel.app"]
    FRONTEND_URL: str = "http://localhost:3000"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # File Storage (S3-compatible)
    S3_ENDPOINT_URL: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_BUCKET: str = "qualityagent"
    S3_REGION: str = "us-east-1"

    # Uploads (stored in Postgres by default; move to S3 when configured)
    MAX_UPLOAD_SIZE_MB: int = 15

    # AI (OpenAI)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # Demo tenant for development
    DEMO_TENANT_ID: str = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

    # Public demo login (POST /auth/demo-login). Disable for a locked-down install.
    ALLOW_DEMO_LOGIN: bool = True

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        """Accept the URL formats handed out by managed Postgres providers.

        Render/Railway/Heroku hand out ``postgres://`` URLs and Neon/Supabase
        append ``sslmode=require`` / ``channel_binding=require`` which the
        asyncpg driver does not understand. Normalize them to the SQLAlchemy
        asyncpg form so a copied connection string works as-is.
        """
        if value.startswith("postgres://"):
            value = "postgresql+asyncpg://" + value[len("postgres://") :]
        elif value.startswith("postgresql://"):
            value = "postgresql+asyncpg://" + value[len("postgresql://") :]

        parts = urlsplit(value)
        if not parts.query:
            return value

        params = []
        for key, val in parse_qsl(parts.query, keep_blank_values=True):
            if key == "channel_binding":
                continue
            if key == "sslmode":
                key = "ssl"
            params.append((key, val))

        return urlunsplit(
            (parts.scheme, parts.netloc, parts.path, urlencode(params), parts.fragment)
        )

    @property
    def allowed_origins(self) -> List[str]:
        """CORS origins, parsed from a comma separated list or a JSON array."""
        raw = (self.ALLOWED_ORIGINS or "").strip()
        if not raw:
            return []
        if raw.startswith("["):
            try:
                values = json.loads(raw)
                if isinstance(values, list):
                    return [str(item).strip() for item in values if str(item).strip()]
            except json.JSONDecodeError:
                pass
        return [origin.strip() for origin in raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
