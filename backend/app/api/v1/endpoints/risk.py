from fastapi import APIRouter, HTTPException, status
from app.api.v1.endpoints.zones import get_all_zones_map
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
    """Returns the fused live risk score for a single zone or named place, or 400 on unknown zone."""
    all_zones = get_all_zones_map()
    if zone_id not in all_zones:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown zone_id '{zone_id}'. Valid zones: {list(all_zones.keys())}",
        )

    try:
        return fusion.evaluate_zone_risk(zone_id)
    except Exception as exc:
        zone = all_zones[zone_id]
        return ZoneRisk(
            zone_id=zone.id,
            zone_name=zone.name,
            timestamp=store.utcnow(),
            risk_score=0.0,
            risk_tier=RiskTier.NO_DATA,
            level=RiskTier.NO_DATA,
            fused_estimate=0,
            occupancy=0.0,
            capacity=zone.capacity,
            forecast_pressure=0.0,
            reasons=[f"evaluation failed: {exc}"],
            has_live_signals=zone_id in ZONE_BY_ID,
            signal_status="stale" if zone_id in ZONE_BY_ID else "none",
        )


@router.get("/alerts", response_model=AlertsResponse, tags=["Risk"])
async def get_active_alerts():
    """Returns currently active alerts for monitored zones at ELEVATED, HIGH, or CRITICAL risk,
    plus info alerts for instrumented zones going stale. Never alerts for named places.
    """
    all_zones = fusion.evaluate_all_zones()
    now = store.utcnow()
    alerts = []

    for z in all_zones:
        # Never alert for uninstrumented named places
        if z.zone_id not in ZONE_BY_ID:
            continue

        # Info alert for stale instrumented sensors
        if z.signal_status == "stale":
            alerts.append(
                Alert(
                    id=f"alert-{z.zone_id}-stale-{int(now.timestamp())}",
                    zone_id=z.zone_id,
                    zone_name=z.zone_name,
                    tier=RiskTier.NO_DATA,
                    message=f"{z.zone_name} sensor telemetry offline (>120s without live feed).",
                    raised_at=now,
                    risk_score=z.risk_score,
                )
            )
        elif z.risk_tier in (RiskTier.ELEVATED, RiskTier.HIGH, RiskTier.CRITICAL):
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
