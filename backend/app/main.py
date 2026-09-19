import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("pokecode")


def seed_initial_telemetry():
    """Seed initial vision and beacon signals so monitored zones (z1-z4) have active live telemetry on startup."""
    try:
        from app.schemas.shared import BeaconSignal, SignalStatus, VisionSignal
        from app.services import store

        now = store.utcnow()
        initial_signals = {
            "z1": {"cam": 135, "ble": 72},
            "z2": {"cam": 340, "ble": 180},
            "z3": {"cam": 480, "ble": 255},
            "z4": {"cam": 95, "ble": 52},
        }

        for zone_id, counts in initial_signals.items():
            store.add_vision(
                VisionSignal(
                    zone_id=zone_id,
                    count=counts["cam"],
                    timestamp=now,
                    occluded=False,
                    status=SignalStatus.OK,
                )
            )
            store.add_beacon(
                BeaconSignal(
                    zone_id=zone_id,
                    unique_devices=counts["ble"],
                    timestamp=now,
                    scanner_id=f"scanner-{zone_id}-boot",
                    status=SignalStatus.OK,
                )
            )
        logger.info("Successfully seeded initial live telemetry signals for zones z1-z4")
    except Exception as exc:
        logger.warning("Failed to seed initial telemetry: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT}]")
    seed_initial_telemetry()
    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}")



app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="PokeCode Prayas Hackathon Production-Ready API",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Top-level direct health check for Docker, Render, Railway
@app.get("/health", tags=["System"])
async def root_health():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to PokeCode Hackathon API",
        "docs": "/docs",
        "health": "/health",
        "api_v1": "/api/v1",
    }


# Include versioned API routers
app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router, prefix="/api")  # Convenience alias for /api/health etc.


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development",
    )
