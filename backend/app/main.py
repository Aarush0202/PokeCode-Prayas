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
        from app.schemas.shared import BeaconSignal, Flow, VisionSignal, ZONE_BY_ID
        from app.services import store

        now = store.utcnow()
        initial_signals = {
            "z1": {"cam": 135, "ble": 72},
            "z2": {"cam": 340, "ble": 180},
            "z3": {"cam": 480, "ble": 255},
            "z4": {"cam": 95, "ble": 52},
        }

        for zone_id, counts in initial_signals.items():
            area = ZONE_BY_ID[zone_id].area_sqm if zone_id in ZONE_BY_ID else 400.0
            density = round(counts["cam"] / area, 3)
            store.add_vision(
                VisionSignal(
                    zone_id=zone_id,
                    timestamp=now,
                    person_count=counts["cam"],
                    density_per_sqm=density,
                    flow=Flow(dx=0.08, dy=0.08, magnitude=0.11),
                    confidence=0.92,
                )
            )
            store.add_beacon(
                BeaconSignal(
                    zone_id=zone_id,
                    timestamp=now,
                    unique_devices=counts["ble"],
                    scanner_id=f"scanner-{zone_id}-boot",
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
