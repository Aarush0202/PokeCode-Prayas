from fastapi import APIRouter, HTTPException, status
from app.schemas.shared import (
    ZONE_BY_ID,
    Alert,
    AlertsResponse,
    RiskLiveResponse,
    RiskTier,
    ZoneRisk,
)
from app.services import fusion, store

router = APIRouter()


@router.get("/live", response_model=RiskLiveResponse, tags=["Risk"])
async def get_live_risk():
    """The primary CrowdGuard endpoint. Returns fused risk scores across all monitored zones.
    This endpoint never fails and gracefully handles missing sensor or forecast signals.
    """
    zones_risk = fusion.evaluate_all_zones()
    return RiskLiveResponse(
        generated_at=store.utcnow(),
        zones=zones_risk,
    )


@router.get("/live/{zone_id}", response_model=ZoneRisk, tags=["Risk"])
async def get_zone_live_risk(zone_id: str):
    """Returns the fused live risk score for a single zone, or 400 on unknown zone."""
    if zone_id not in ZONE_BY_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown zone_id '{zone_id}'. Monitored zones: {list(ZONE_BY_ID.keys())}",
        )

    try:
        return fusion.evaluate_zone_risk(zone_id)
    except Exception as exc:
        zone = ZONE_BY_ID[zone_id]
        return ZoneRisk(
            zone_id=zone.id,
            zone_name=zone.name,
            timestamp=store.utcnow(),
            risk_score=0.0,
            risk_tier=RiskTier.NORMAL,
            fused_estimate=0,
            capacity=zone.capacity,
            forecast_pressure=0.0,
            reasons=[f"evaluation failed: {exc}"],
        )


@router.get("/alerts", response_model=AlertsResponse, tags=["Risk"])
async def get_active_alerts():
    """Returns currently active alerts for any zones at ELEVATED, HIGH, or CRITICAL risk,
    sorted by risk score descending.
    """
    all_zones = fusion.evaluate_all_zones()
    now = store.utcnow()
    alerts = []

    for z in all_zones:
        if z.risk_tier in (RiskTier.ELEVATED, RiskTier.HIGH, RiskTier.CRITICAL):
            reasons_text = ". ".join(z.reasons) if z.reasons else ""
            if reasons_text and not reasons_text.endswith("."):
                reasons_text += "."
            alert_msg = (
                f"{z.zone_name} at {z.risk_tier.value} risk — "
                f"{z.fused_estimate} people estimated against a {z.capacity} capacity. "
                f"{reasons_text}".strip()
            )
            alerts.append(
                Alert(
                    id=f"alert-{z.zone_id}-{int(now.timestamp())}",
                    zone_id=z.zone_id,
                    zone_name=z.zone_name,
                    tier=z.risk_tier,
                    message=alert_msg,
                    raised_at=now,
                    risk_score=z.risk_score,
                )
            )

    # Sort alerts by risk score descending
    alerts.sort(key=lambda a: a.risk_score, reverse=True)

    return AlertsResponse(
        generated_at=now,
        alerts=alerts,
    )
