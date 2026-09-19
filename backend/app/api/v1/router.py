from fastapi import APIRouter
from app.api.v1.endpoints import health, demo

api_router = APIRouter()
api_router.include_router(health.router, prefix="", tags=["System"])
api_router.include_router(demo.router, prefix="", tags=["Demo"])

# CrowdGuard Person B routers
try:
    from app.api.v1.endpoints import events
    api_router.include_router(events.router, prefix="/events", tags=["Events"])
except Exception:
    pass

try:
    from app.api.v1.endpoints import forecast
    api_router.include_router(forecast.router, prefix="/forecast", tags=["Forecast"])
except Exception:
    pass
