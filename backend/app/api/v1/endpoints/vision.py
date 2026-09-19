"""CrowdGuard Vision API endpoints."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from app.schemas.shared import (
    Flow,
    VisionAnalyzeResponse,
    VisionSignal,
    ZONE_BY_ID,
)
from app.services import detector, store

router = APIRouter()


class VisionSimulateRequest(BaseModel):
    zone_id: str = Field(..., description="Target zone identifier (e.g. z1, z2, z3, z4)")
    count: Optional[int] = Field(None, ge=0, description="Simulated count of people in the zone")
    person_count: Optional[int] = Field(None, ge=0, description="Alias for count (backward compatibility)")
    occluded: bool = Field(default=False, description="Simulate camera blind spot / occlusion with low count")


class VisionHistoryResponse(BaseModel):
    zone_id: str
    count: int
    readings: List[VisionSignal]


@router.post("/analyze", response_model=VisionAnalyzeResponse, summary="Analyze crowd image")
async def analyze_crowd_image(
    file: UploadFile = File(..., description="Image file to analyze for crowd density"),
    zone_id: str = Form(..., description="Zone ID (z1, z2, z3, z4)"),
):
    """Run person detection on uploaded image and estimate crowd density and flow."""
    if zone_id not in ZONE_BY_ID:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown zone_id '{zone_id}'. Valid zones are: {list(ZONE_BY_ID.keys())}",
        )

    # Read image contents
    try:
        image_bytes = await file.read()
        if not image_bytes:
            raise ValueError("Uploaded file is empty")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {exc}")

    try:
        result = detector.analyze_image(image_bytes=image_bytes, zone_id=zone_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Persist vision reading to shared in-memory store
    store.add_vision(result)

    return result


@router.post("/simulate", response_model=VisionAnalyzeResponse, summary="Simulate vision reading")
def simulate_vision_reading(payload: VisionSimulateRequest):
    """Simulate a vision reading for testing, demo, or camera blind-spot scenarios."""
    if payload.zone_id not in ZONE_BY_ID:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown zone_id '{payload.zone_id}'. Valid zones are: {list(ZONE_BY_ID.keys())}",
        )

    # Resolve count from count or person_count
    if payload.count is not None:
        effective_count = payload.count
    elif payload.person_count is not None:
        effective_count = payload.person_count
    else:
        effective_count = 35 if payload.occluded else 100

    # If explicitly occluded and high count given, scale down to simulate blind spot
    if payload.occluded and effective_count > 60:
        effective_count = max(15, int(effective_count * 0.25))

    zone = ZONE_BY_ID[payload.zone_id]
    density_per_sqm = round(effective_count / zone.area_sqm, 4)
    timestamp = store.utcnow()

    response = VisionAnalyzeResponse(
        zone_id=payload.zone_id,
        timestamp=timestamp,
        person_count=effective_count,
        density_per_sqm=density_per_sqm,
        flow=Flow(dx=0.0, dy=0.0, magnitude=0.0),
        confidence=0.95 if not payload.occluded else 0.45,
        annotated_image_b64=None,
        model_name="mock",
        mocked=True,
    )

    store.add_vision(response)
    return response


@router.get("/latest/{zone_id}", response_model=VisionSignal, summary="Get latest vision reading")
def get_latest_vision(zone_id: str):
    """Retrieve the most recent camera vision reading for the specified zone."""
    if zone_id not in ZONE_BY_ID:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown zone_id '{zone_id}'. Valid zones are: {list(ZONE_BY_ID.keys())}",
        )

    signal = store.latest_vision(zone_id)
    if signal is None:
        raise HTTPException(
            status_code=404,
            detail=f"No vision readings found for zone '{zone_id}'.",
        )

    return signal


@router.get("/history/{zone_id}", response_model=VisionHistoryResponse, summary="Get vision history")
def get_vision_history(
    zone_id: str,
    limit: int = Query(default=50, ge=1, le=200, description="Max readings to return (1-200)"),
):
    """Retrieve historical vision readings for a zone, ordered oldest to newest."""
    if zone_id not in ZONE_BY_ID:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown zone_id '{zone_id}'. Valid zones are: {list(ZONE_BY_ID.keys())}",
        )

    readings = store.vision_history(zone_id, limit=limit)
    return VisionHistoryResponse(
        zone_id=zone_id,
        count=len(readings),
        readings=readings,
    )
