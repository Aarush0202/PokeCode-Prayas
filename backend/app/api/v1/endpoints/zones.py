from typing import List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.schemas.shared import ZONES, ZONE_BY_ID, Zone

router = APIRouter()


class ZonesListResponse(BaseModel):
    count: int
    zones: List[Zone]


@router.get("/zones", response_model=ZonesListResponse, tags=["Zones"])
async def list_zones():
    """Returns all 4 monitored crowd zones."""
    return ZonesListResponse(count=len(ZONES), zones=ZONES)


@router.get("/zones/{zone_id}", response_model=Zone, tags=["Zones"])
async def get_zone(zone_id: str):
    """Returns details for a single zone, or 404 if not found."""
    zone = ZONE_BY_ID.get(zone_id)
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone '{zone_id}' not found",
        )
    return zone
