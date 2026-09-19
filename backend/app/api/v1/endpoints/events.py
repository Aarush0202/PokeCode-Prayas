"""CrowdGuard Events API Endpoints.

Handles /api/v1/events/nearby and /api/v1/events/refresh.
"""
from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.shared import ZONE_BY_ID, EventsResponse
from app.services import event_fetcher, store

router = APIRouter()


@router.get("/nearby", response_model=EventsResponse)
def get_nearby_events(
    zone_id: Optional[str] = Query(None, description="Optional zone ID to filter by"),
    hours: int = Query(48, ge=1, le=168, description="Horizon in hours (1-168)"),
) -> EventsResponse:
    """Return all known events starting within the next `hours`, sorted by start_time.
    
    If zone_id is provided, validates zone_id and filters to that zone.
    Unknown zone_id returns HTTP 400.
    """
    if zone_id is not None and zone_id not in ZONE_BY_ID:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown zone_id: '{zone_id}'. Valid zones are: {list(ZONE_BY_ID.keys())}",
        )

    now = store.utcnow()
    max_time = now + timedelta(hours=hours)

    all_events = event_fetcher.ensure_events_loaded()

    matching = []
    for ev in all_events:
        # Check start_time is in the future and within horizon
        if now <= ev.start_time <= max_time:
            if zone_id is None or ev.zone_id == zone_id:
                matching.append(ev)

    matching.sort(key=lambda x: x.start_time)

    return EventsResponse(
        generated_at=now,
        count=len(matching),
        events=matching,
    )


@router.post("/refresh")
def refresh_events() -> Dict[str, Any]:
    """Re-run the fetch pipeline, update store, and return refresh summary.
    
    Guaranteed to return HTTP 200 even if network sources are unavailable.
    """
    result = event_fetcher.fetch_and_store_events()
    return result
