import time
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter()
START_TIME = time.time()


class HealthResponse(BaseModel):
    status: str
    uptime_seconds: float
    environment: str
    version: str


@router.get("/health", response_model=HealthResponse, tags=["System"])
@router.get("/ping", tags=["System"])
async def health_check():
    """Health check endpoint used by deployment platforms (Render, Railway, Fly.io, Kubernetes)."""
    return HealthResponse(
        status="healthy",
        uptime_seconds=round(time.time() - START_TIME, 2),
        environment=settings.ENVIRONMENT,
        version=settings.VERSION,
    )
