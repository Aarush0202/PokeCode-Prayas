"""CrowdGuard Forecast API Endpoints.

Handles:
- GET /api/v1/forecast/metrics: Evaluated model metrics, held-out MAE, baselines, and ablation.
- GET /api/v1/forecast/{zone_id}: 48h hourly crowd density, counts, risk tiers, and driver strings.
- GET /api/v1/forecast/{zone_id}/pressure: Forward-looking crowd pressure over next 3 hours.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query

from app.schemas.shared import ForecastResponse
from app.services import forecaster

router = APIRouter()


@router.get("/metrics")
def get_forecast_metrics() -> Dict[str, Any]:
    """Return model evaluation metrics, held-out MAE by category, baselines, and ablation.

    Returns HTTP 404 if model_metrics.json has not been generated yet.
    """
    metrics_path = forecaster.get_model_path().parent / "model_metrics.json"
    if not metrics_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Model metrics not found. Run 'python3 tools/generate_training_data.py' to generate metrics.",
        )

    try:
        with open(metrics_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read model metrics: {str(exc)}")


@router.get("/{zone_id}", response_model=ForecastResponse)
def get_zone_forecast(
    zone_id: str,
    hours: int = Query(48, ge=6, le=168, description="Forecast horizon in hours (6-168)"),
) -> ForecastResponse:
    """Return hourly predicted crowd density, counts, risk tiers, and driver strings.

    Works for monitored zones (z1-z4) as well as named places (e.g. ch01, ch02).
    Unknown zone_id returns HTTP 400.
    """
    zone = forecaster.get_zone_by_id(zone_id)
    if not zone:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown zone_id: '{zone_id}'. Valid zones include monitored zones and named places.",
        )

    try:
        response = forecaster.get_forecast(zone_id=zone_id, hours=hours)
        return response
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {str(exc)}")


@router.get("/{zone_id}/pressure")
def get_zone_pressure(
    zone_id: str,
    window_hours: int = Query(3, ge=1, le=12, description="Lookahead window in hours"),
) -> Dict[str, Any]:
    """Return upward crowd pressure (0.0 to 1.0) relative to zone capacity over next 3 hours.

    This is consumed directly by Person C's fusion engine as `forecast_pressure`.
    Unknown zone_id returns HTTP 400.
    """
    zone = forecaster.get_zone_by_id(zone_id)
    if not zone:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown zone_id: '{zone_id}'. Valid zones include monitored zones and named places.",
        )

    try:
        return forecaster.get_forecast_pressure(zone_id=zone_id, window_hours=window_hours)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Pressure calculation error: {str(exc)}")
