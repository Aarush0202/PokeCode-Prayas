from typing import Dict, List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.schemas.shared import ZONES, ZONE_BY_ID, Zone

try:
    from app.data.named_places import NAMED_PLACES
except ImportError:
    NAMED_PLACES = []

router = APIRouter()


class ZonesListResponse(BaseModel):
    count: int
    zones: List[Zone]


def get_all_available_zones() -> List[Zone]:
    """Combines original instrumented ZONES and held-out NAMED_PLACES, excluding synthetic training venues."""
    combined = list(ZONES)
    for place in NAMED_PLACES:
        if not place.id.startswith("syn") and place.id not in ZONE_BY_ID:
            combined.append(place)
    return combined


def get_all_zones_map() -> Dict[str, Zone]:
    """Mapping of all valid zone IDs to Zone objects."""
    all_map = dict(ZONE_BY_ID)
    for place in NAMED_PLACES:
        if not place.id.startswith("syn"):
            all_map[place.id] = place
    return all_map


@router.get("/zones", response_model=ZonesListResponse, tags=["Zones"])
async def list_zones():
    """Returns all monitored zones and held-out named places (synthetic syn* excluded)."""
    zones = get_all_available_zones()
    return ZonesListResponse(count=len(zones), zones=zones)


@router.get("/zones/{zone_id}", response_model=Zone, tags=["Zones"])
async def get_zone(zone_id: str):
    """Returns details for a single zone or named place, or 404 if not found."""
    all_zones = get_all_zones_map()
    zone = all_zones.get(zone_id)
    if not zone or zone_id.startswith("syn"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone '{zone_id}' not found",
        )
    return zone

