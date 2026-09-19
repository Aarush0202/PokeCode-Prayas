"""CrowdGuard Forecast API Endpoints.

Handles /api/v1/forecast/{zone_id} and /api/v1/forecast/{zone_id}/pressure.
"""
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query

from app.schemas.shared import ZONE_BY_ID, ForecastResponse
from app.services import forecaster

router = APIRouter()


@router.get("/{zone_id}", response_model=ForecastResponse)
def get_zone_forecast(
    zone_id: str,
    hours: int = Query(48, ge=6, le=168, description="Forecast horizon in hours (6-168)"),
) -> ForecastResponse:
    """Return hourly predicted crowd density, counts, risk tiers, and driver strings.
    
    Unknown zone_id returns HTTP 400.
    """
    if zone_id not in ZONE_BY_ID:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown zone_id: '{zone_id}'. Valid zones are: {list(ZONE_BY_ID.keys())}",
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
    if zone_id not in ZONE_BY_ID:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown zone_id: '{zone_id}'. Valid zones are: {list(ZONE_BY_ID.keys())}",
        )

    try:
        return forecaster.get_forecast_pressure(zone_id=zone_id, window_hours=window_hours)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Pressure calculation error: {str(exc)}")
