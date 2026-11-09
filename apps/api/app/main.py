"""Main FastAPI application"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.database import init_db, close_db
from app.core.exceptions import register_exception_handlers
from app.api.router import api_router

logger = logging.getLogger("qualityagent")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    if settings.ENVIRONMENT.lower() == "production" and settings.SECRET_KEY.startswith(
        "dev-secret"
    ):
        logger.warning(
            "SECRET_KEY is still the development default. Set a strong SECRET_KEY "
            "before exposing this API publicly."
        )
    logger.info("Allowed CORS origins: %s", settings.allowed_origins)
    await init_db()
    yield
    # Shutdown
    await close_db()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI Quality Operations Platform for Manufacturing",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compress JSON responses (list/dashboard payloads) for slower connections.
app.add_middleware(GZipMiddleware, minimum_size=500)

# Exception handlers
register_exception_handlers(app)

# Include API router
app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }