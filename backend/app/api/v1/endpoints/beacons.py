from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.schemas.shared import ZONE_BY_ID, BeaconIngestResponse, BeaconSignal
from app.services import store

router = APIRouter()


class BeaconIngestRequest(BaseModel):
    zone_id: str
    unique_devices: int = Field(..., ge=0, description="Number of unique Bluetooth devices detected")
    scanner_id: str = "sim-1"
    timestamp: Optional[datetime] = None


class BeaconHistoryResponse(BaseModel):
    zone_id: str
    count: int
    readings: List[BeaconSignal]


@router.post("/ingest", response_model=BeaconIngestResponse, tags=["Beacons"])
async def ingest_beacon(payload: BeaconIngestRequest):
    """Accepts a Bluetooth device count for a zone."""
    if payload.zone_id not in ZONE_BY_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown zone_id '{payload.zone_id}'. Valid zones: {list(ZONE_BY_ID.keys())}",
        )

    ts = payload.timestamp or store.utcnow()
    signal = BeaconSignal(
        zone_id=payload.zone_id,
        timestamp=ts,
        unique_devices=payload.unique_devices,
        scanner_id=payload.scanner_id,
    )
    stored_count = store.add_beacon(signal)

    return BeaconIngestResponse(
        accepted=True,
        zone_id=payload.zone_id,
        stored_readings=stored_count,
    )


@router.get("/latest/{zone_id}", response_model=BeaconSignal, tags=["Beacons"])
async def get_latest_beacon(zone_id: str):
    """Returns the most recent BLE reading for a zone, or 404 if none yet."""
    signal = store.latest_beacon(zone_id)
    if not signal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No beacon readings found for zone '{zone_id}'",
        )
    return signal


@router.get("/history/{zone_id}", response_model=BeaconHistoryResponse, tags=["Beacons"])
async def get_beacon_history(
    zone_id: str,
    limit: int = Query(default=50, ge=1, le=500),
):
    """Returns historical BLE readings for a zone, oldest first."""
    readings = store.beacon_history(zone_id, limit=limit)
    return BeaconHistoryResponse(
        zone_id=zone_id,
        count=len(readings),
        readings=readings,
    )
