"""CrowdGuard Attention Panel Endpoints.

Exposes:
- GET  /api/v1/attention: Live ranked triage of Act Now / Watch Soon / Needs Checking items.
- POST /api/v1/attention/acknowledge: Operator acknowledgement of active issues.
- POST /api/v1/attention/snooze: Temporary snooze for alerts unless critical escalation occurs.
- POST /api/v1/attention/reset: Reset state (for demo / test isolation).
"""
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, status

from app.services import attention
from app.services.attention import (
    AcknowledgeRequest,
    AttentionResponse,
    SnoozeRequest,
)

router = APIRouter()


@router.get("", response_model=AttentionResponse, tags=["Attention"])
@router.get("/", response_model=AttentionResponse, include_in_schema=False)
def get_attention_feed() -> AttentionResponse:
    """Returns the prioritized attention triage feed across monitored zones and held-out venues.
    
    Items are categorized into:
    - act_now: Critical/High crowd densities demanding immediate tactical intervention.
    - watch_soon: Elevated volume or incoming forecast pressure spikes.
    - needs_checking: Stale telemetry, sensor divergence, or unmonitored named places.
    """
    try:
        return attention.evaluate_attention_items()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Attention evaluation error: {str(exc)}",
        )


@router.post("/acknowledge", tags=["Attention"])
def acknowledge_attention_item(req: AcknowledgeRequest) -> Dict[str, Any]:
    """Allows an operator to acknowledge an active attention issue."""
    success = attention.acknowledge_item(item_id=req.item_id, zone_id=req.zone_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either a valid 'item_id' or 'zone_id' to acknowledge.",
        )
    return {
        "success": True,
        "message": f"Attention item for {req.zone_id or req.item_id} successfully acknowledged.",
    }


@router.post("/snooze", tags=["Attention"])
def snooze_attention_item(req: SnoozeRequest) -> Dict[str, Any]:
    """Temporarily snoozes an alert for N minutes unless conditions escalate to CRITICAL."""
    snooze_until = attention.snooze_item(
        item_id=req.item_id,
        zone_id=req.zone_id,
        minutes=req.minutes,
    )
    if not snooze_until:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either a valid 'item_id' or 'zone_id' to snooze.",
        )
    return {
        "success": True,
        "snoozed_until": snooze_until.isoformat(),
        "message": f"Alerts for {req.zone_id or req.item_id} snoozed until {snooze_until.isoformat()}.",
    }


@router.post("/reset", tags=["Attention"])
def reset_attention() -> Dict[str, Any]:
    """Clears in-memory acknowledgements and snooze timers."""
    attention.reset_attention_state()
    return {"success": True, "message": "Attention state reset."}
