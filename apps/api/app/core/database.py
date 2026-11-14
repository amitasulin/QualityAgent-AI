"""Database connection and session management"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from app.core.config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    poolclass=NullPool if settings.ENVIRONMENT == "test" else None,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


@event.listens_for(Session, "after_flush")
def _mark_session_writes(session: Session, flush_context) -> None:
    """Remember that this session flushed writes, even after the identity map clears."""
    session.info["has_writes"] = True


def _has_pending_writes(session: AsyncSession) -> bool:
    """True when a request changed data and therefore needs a commit."""
    return bool(
        session.info.get("has_writes")
        or session.new
        or session.dirty
        or session.deleted
    )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting DB session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            # Read-only requests skip COMMIT, saving a full database round trip.
            if _has_pending_writes(session):
                await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """Context manager for getting DB session outside of FastAPI dependencies"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            if _has_pending_writes(session):
                await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database - create tables if they don't exist"""
    # Import all models to register them
    from app.models import (  # noqa: F401
        organization,
        site,
        user,
        product,
        customer,
        supplier,
        document,
        file_object,
        nonconformity,
        corrective_action,
        agent,
        task,
        audit,
    )

    async with engine.begin() as conn:
        # In production, use Alembic migrations instead
        # await conn.run_sync(Base.metadata.create_all)
        pass


async def close_db() -> None:
    """Close database connections"""
    await engine.dispose()