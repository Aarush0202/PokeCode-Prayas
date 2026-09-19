"""CrowdGuard multi-signal fusion engine.
Pure functions combining Vision, Beacon, and Forecast signals into fused zone risk.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from app.schemas.shared import (
    ZONE_BY_ID,
    BeaconSignal,
    RiskTier,
    VisionSignal,
    Zone,
    ZoneRisk,
    tier_from_score,
)
from app.services import store

# ==============================================================================
# CONFIGURABLE TUNING CONSTANTS (Demo Rehearsal Parameters)
# ==============================================================================
BEACON_MULTIPLIER: float = float(os.getenv("BEACON_MULTIPLIER", "1.6"))
STALENESS_SECONDS: float = 120.0  # signals older than 2 minutes are ignored
RATE_WINDOW_SECONDS: float = 60.0
RATE_RISING_THRESHOLD: float = 0.10  # 10% occupancy increase per minute
RATE_BONUS: float = 0.15
FLOW_THRESHOLD: float = 0.40
FLOW_BONUS: float = 0.05

WEIGHT_OCCUPANCY: float = 0.70
WEIGHT_FORECAST: float = 0.20
# ==============================================================================


def clamp(val: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    return max(min_val, min(val, max_val))


def _ensure_utc(dt: datetime) -> datetime:
    """Ensures datetime is timezone-aware UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _forecast_pressure(zone_id: str) -> Tuple[float, List[str]]:
    """Lazy import of Person B's forecast engine. Degrades gracefully to (0.0, [])."""
    try:
        from app.services.forecaster import zone_pressure
        return zone_pressure(zone_id)
    except Exception:
        return 0.0, []


def _compute_rate_of_change(zone: Zone, now: datetime) -> Tuple[float, bool]:
    """Calculates occupancy rate of change over the last 60 seconds."""
    # Check vision history first, then beacon history
    vis_hist = store.vision_history(zone.id, limit=20)
    if len(vis_hist) >= 2:
        recent = [s for s in vis_hist if (now - _ensure_utc(s.timestamp)).total_seconds() <= RATE_WINDOW_SECONDS + 15]
        if len(recent) >= 2:
            dt = (_ensure_utc(recent[-1].timestamp) - _ensure_utc(recent[0].timestamp)).total_seconds()
            if dt >= 15.0:
                delta_occ = (recent[-1].person_count - recent[0].person_count) / zone.capacity
                rate_per_min = (delta_occ / dt) * 60.0
                if rate_per_min >= RATE_RISING_THRESHOLD:
                    return RATE_BONUS, True

    bcn_hist = store.beacon_history(zone.id, limit=20)
    if len(bcn_hist) >= 2:
        recent = [s for s in bcn_hist if (now - _ensure_utc(s.timestamp)).total_seconds() <= RATE_WINDOW_SECONDS + 15]
        if len(recent) >= 2:
            dt = (_ensure_utc(recent[-1].timestamp) - _ensure_utc(recent[0].timestamp)).total_seconds()
            if dt >= 15.0:
                delta_dev = (recent[-1].unique_devices - recent[0].unique_devices) * BEACON_MULTIPLIER
                delta_occ = delta_dev / zone.capacity
                rate_per_min = (delta_occ / dt) * 60.0
                if rate_per_min >= RATE_RISING_THRESHOLD:
                    return RATE_BONUS, True

    return 0.0, False


def evaluate_zone_risk(zone_id: str) -> ZoneRisk:
    """Computes the fused risk assessment for a single zone."""
    now = store.utcnow()
    zone = ZONE_BY_ID.get(zone_id)
    if not zone:
        # Fallback zone definition if unknown
        zone = Zone(id=zone_id, name=f"Zone {zone_id}", capacity=500, area_sqm=500.0, lat=0.0, lon=0.0)

    reasons: List[str] = []

    # 1. Read live sensor signals with staleness check (120s)
    raw_vision = store.latest_vision(zone_id)
    active_vision: Optional[VisionSignal] = None
    if raw_vision is not None:
        age = (now - _ensure_utc(raw_vision.timestamp)).total_seconds()
        if age <= STALENESS_SECONDS:
            active_vision = raw_vision

    raw_beacon = store.latest_beacon(zone_id)
    active_beacon: Optional[BeaconSignal] = None
    if raw_beacon is not None:
        age = (now - _ensure_utc(raw_beacon.timestamp)).total_seconds()
        if age <= STALENESS_SECONDS:
            active_beacon = raw_beacon

    # 2. Convert each signal to a 0-1 occupancy ratio
    vision_ratio: Optional[float] = None
    if active_vision is not None:
        vision_ratio = clamp(active_vision.person_count / zone.capacity)

    beacon_ratio: Optional[float] = None
    if active_beacon is not None:
        beacon_ratio = clamp((active_beacon.unique_devices * BEACON_MULTIPLIER) / zone.capacity)

    # 3. Fuse available live signals
    occupancy: float = 0.0
    if vision_ratio is not None and beacon_ratio is not None:
        # Both camera and Bluetooth present
        occupancy = 0.6 * vision_ratio + 0.4 * beacon_ratio
        # Disagreement bonus: if they differ by > 0.25, take higher estimate
        if abs(vision_ratio - beacon_ratio) > 0.25:
            occupancy = max(vision_ratio, beacon_ratio)
            reasons.append("camera and Bluetooth counts disagree, using the higher estimate")
    elif vision_ratio is not None:
        occupancy = vision_ratio
        reasons.append("Bluetooth scanner offline for this zone")
    elif beacon_ratio is not None:
        occupancy = beacon_ratio
        reasons.append("camera feed unavailable, estimate from Bluetooth only")
    else:
        occupancy = 0.0
        reasons.append("no live sensor data")

    # 4. Rate of change detection
    rate_bonus, is_surging = _compute_rate_of_change(zone, now)
    if is_surging:
        reasons.append("crowd building rapidly")

    # 5. Flow bottleneck detection (from camera flow vectors)
    flow_bonus: float = 0.0
    if active_vision is not None and active_vision.flow.magnitude > FLOW_THRESHOLD:
        flow_bonus = FLOW_BONUS
        reasons.append("strong directional flow into this zone")

    # 6. Read forecast pressure from Person B
    forecast_pressure, forecast_drivers = _forecast_pressure(zone_id)
    if forecast_pressure > 0.30 and forecast_drivers:
        reasons.extend(forecast_drivers)

    # 7. Final fused risk score calculation
    risk_score = clamp(
        (WEIGHT_OCCUPANCY * occupancy)
        + (WEIGHT_FORECAST * forecast_pressure)
        + rate_bonus
        + flow_bonus,
        0.0,
        1.0,
    )

    risk_tier = tier_from_score(risk_score)
    fused_estimate = round(occupancy * zone.capacity)

    return ZoneRisk(
        zone_id=zone.id,
        zone_name=zone.name,
        timestamp=now,
        risk_score=round(risk_score, 3),
        risk_tier=risk_tier,
        fused_estimate=fused_estimate,
        capacity=zone.capacity,
        vision=active_vision,
        beacon=active_beacon,
        forecast_pressure=round(forecast_pressure, 3),
        reasons=reasons,
    )


def evaluate_all_zones() -> List[ZoneRisk]:
    """Evaluates all registered zones, ensuring no unhandled exceptions."""
    results: List[ZoneRisk] = []
    now = store.utcnow()

    for zone in ZONE_BY_ID.values():
        try:
            results.append(evaluate_zone_risk(zone.id))
        except Exception:
            # Absolute defensive fallback: emit NORMAL zone with 'signal unavailable'
            results.append(
                ZoneRisk(
                    zone_id=zone.id,
                    zone_name=zone.name,
                    timestamp=now,
                    risk_score=0.0,
                    risk_tier=RiskTier.NORMAL,
                    fused_estimate=0,
                    capacity=zone.capacity,
                    forecast_pressure=0.0,
                    reasons=["signal unavailable"],
                )
            )
    return results
