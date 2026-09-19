"""Event Planner API endpoint.
Exposes POST /api/v1/planner/assess for deterministic event feasibility analysis.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services import planner

router = APIRouter()


class PlannerAssessRequest(BaseModel):
    zone_id: str = Field(..., description="Target zone ID (e.g. z3 or ch01)")
    start_time: str = Field(..., description="Event start timestamp (ISO format, defaults to IST if naive)")
    duration_hours: float = Field(..., ge=0.5, le=24.0, description="Duration in hours (0.5 to 24.0)")
    event_type: str = Field(
        ...,
        description="concert | sports_match | rally | festival | religious_gathering | other",
    )
    expected_attendance: int = Field(..., ge=1, le=1_000_000, description="Expected ticketed/registered attendance")
    draw_level: str = Field(default="normal", description="normal | high | very_high")


class ZoneDetail(BaseModel):
    id: str
    name: str
    city: str
    category: str
    capacity: int
    area_sqm: float


class PeakDetail(BaseModel):
    time: str
    total_present: int
    occupancy_ratio: float
    density_per_sqm: float


class ScenarioDetail(BaseModel):
    label: str
    attendance: int
    peak_ratio: float
    verdict: str


class TimelinePoint(BaseModel):
    time: str
    baseline: int
    event: int
    total: int
    ratio: float


class AlternativeDetail(BaseModel):
    zone_id: str
    name: str
    peak_ratio: float
    verdict: str


class PlannerAssessResponse(BaseModel):
    zone: ZoneDetail
    verdict: str
    peak: PeakDetail
    scenarios: List[ScenarioDetail]
    timeline: List[TimelinePoint]
    reasons: List[str]
    mitigations: List[str]
    alternatives: List[AlternativeDetail]
    assumptions: List[str]
    disclaimer: str


@router.post(
    "/planner/assess",
    response_model=PlannerAssessResponse,
    tags=["Planner"],
    summary="Assess event feasibility and crowd safety",
)
async def assess_event(payload: PlannerAssessRequest):
    """Computes a deterministic, multi-scenario crowd surge feasibility assessment for an upcoming public event."""
    try:
        result = planner.assess_event(
            zone_id=payload.zone_id,
            start_time_raw=payload.start_time,
            duration_hours=payload.duration_hours,
            event_type=payload.event_type,
            expected_attendance=payload.expected_attendance,
            draw_level=payload.draw_level,
        )
        return result
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Assessment computation failed: {exc}",
        )
