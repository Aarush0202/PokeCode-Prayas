"""CrowdGuard Event Planner Free-Text Parse Endpoint."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.planner_parse import PlannerParseResponse, parse_event_text

router = APIRouter()


class PlannerParseRequest(BaseModel):
    text: str = Field(..., max_length=1000, description="Natural language description of proposed event")


@router.post("/planner/parse", response_model=PlannerParseResponse, summary="Parse event description into structured fields")
@router.post("/parse", response_model=PlannerParseResponse, summary="Parse event description into structured fields")
def parse_event_description(payload: PlannerParseRequest):
    """Parses a free-text event description into structured fields for feasibility assessment.
    This endpoint only assists in filling the assessment form; it never renders a safety verdict.
    """
    try:
        return parse_event_text(payload.text)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
