from fastapi import APIRouter
from app.api.v1.endpoints import health, demo

api_router = APIRouter()
api_router.include_router(health.router, prefix="", tags=["System"])
api_router.include_router(demo.router, prefix="", tags=["Demo"])
