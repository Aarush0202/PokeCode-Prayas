"""CrowdGuard multi-signal fusion engine.
Pure functions combining Vision, Beacon, and Forecast signals into fused zone risk.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from app.schemas.shared import (
    ZONE_BY_ID,
    BeaconSignal,
    RiskTier,
    VisionSignal,
    Zone,
    ZoneRisk,
    tier_from_score,
)
from app.services import fusion_config as cfg
from app.services import store

# In-memory per-zone BLE calibration scale factors: zone_id -> float (default 1.0)
_ble_calibration: Dict[str, float] = {}


def clamp(val: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    return max(min_val, min(val, max_val))


def _ensure_utc(dt: datetime) -> datetime:
    """Ensures datetime is timezone-aware UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def get_ble_scale(zone_id: str) -> float:
    """Returns the current calibration scale for the given zone."""
    return _ble_calibration.get(zone_id, 1.0)


def reset_calibration() -> None:
    """Resets all calibration scales to 1.0 (for testing)."""
    _ble_calibration.clear()


def update_calibration(
    zone_id: str,
    cam_sample: Optional[VisionSignal],
    ble_sample: Optional[BeaconSignal],
    capacity: int,
    is_surging: bool,
    now: datetime,
) -> float:
    """Updates the per-zone BLE calibration scale via EWMA if gating conditions are met."""
    current_scale = _ble_calibration.get(zone_id, 1.0)
    if cam_sample is None or ble_sample is None:
        return current_scale

    # 1. Both samples must be fresh
    cam_age = (now - _ensure_utc(cam_sample.timestamp)).total_seconds()
    ble_age = (now - _ensure_utc(ble_sample.timestamp)).total_seconds()
    if cam_age > cfg.STALENESS_SECONDS or ble_age > cfg.STALENESS_SECONDS:
        return current_scale

    # 2. Both counts must be >= minimum threshold
    if cam_sample.person_count < cfg.CALIBRATION_MIN_COUNT or ble_sample.unique_devices < cfg.CALIBRATION_MIN_COUNT:
        return current_scale

    # 3. No surge in progress
    if is_surging:
        return current_scale

    # 4. Scaled divergence must be below threshold (gate stops learning during camera occlusion)
    cam_ratio = cam_sample.person_count / capacity
    ble_effective = ble_sample.unique_devices * cfg.BEACON_MULTIPLIER * current_scale
    ble_ratio = ble_effective / capacity
    if abs(cam_ratio - ble_ratio) > cfg.DIVERGENCE_THRESHOLD:
        return current_scale

    # Update EWMA
    raw_observed = cam_sample.person_count / (ble_sample.unique_devices * cfg.BEACON_MULTIPLIER)
    new_scale = (1.0 - cfg.CALIBRATION_ALPHA) * current_scale + cfg.CALIBRATION_ALPHA * raw_observed
    clamped_scale = clamp(new_scale, cfg.CALIBRATION_MIN_SCALE, cfg.CALIBRATION_MAX_SCALE)
    _ble_calibration[zone_id] = round(clamped_scale, 4)
    return _ble_calibration[zone_id]


def compute_rate_of_change_pure(
    zone: Zone,
    history: Optional[Tuple[List[VisionSignal], List[BeaconSignal]]],
    now: datetime,
) -> Tuple[float, bool]:
    """Pure calculation of occupancy rate of change over the last 60 seconds."""
    if not history:
        return 0.0, False

    vis_hist, bcn_hist = history
    if len(vis_hist) >= 2:
        recent = [s for s in vis_hist if (now - _ensure_utc(s.timestamp)).total_seconds() <= cfg.RATE_WINDOW_SECONDS + 15]
        if len(recent) >= 2:
            dt = (_ensure_utc(recent[-1].timestamp) - _ensure_utc(recent[0].timestamp)).total_seconds()
            if dt >= 15.0:
                delta_occ = (recent[-1].person_count - recent[0].person_count) / zone.capacity
                rate_per_min = (delta_occ / dt) * 60.0
                if rate_per_min >= cfg.RATE_RISING_THRESHOLD:
                    return cfg.RATE_BONUS, True

    if len(bcn_hist) >= 2:
        recent = [s for s in bcn_hist if (now - _ensure_utc(s.timestamp)).total_seconds() <= cfg.RATE_WINDOW_SECONDS + 15]
        if len(recent) >= 2:
            dt = (_ensure_utc(recent[-1].timestamp) - _ensure_utc(recent[0].timestamp)).total_seconds()
            if dt >= 15.0:
                delta_dev = (recent[-1].unique_devices - recent[0].unique_devices) * cfg.BEACON_MULTIPLIER
                delta_occ = delta_dev / zone.capacity
                rate_per_min = (delta_occ / dt) * 60.0
                if rate_per_min >= cfg.RATE_RISING_THRESHOLD:
                    return cfg.RATE_BONUS, True

    return 0.0, False


def fuse(
    zone: Zone,
    cam_sample: Optional[VisionSignal],
    ble_sample: Optional[BeaconSignal],
    forecast_pressure: float = 0.0,
    history: Optional[Tuple[List[VisionSignal], List[BeaconSignal]]] = None,
    now: Optional[datetime] = None,
    ble_scale: float = 1.0,
    has_signals_ever: bool = True,
) -> ZoneRisk:
    """I/O-free pure fusion function. Combines vision, BLE, and forecast into a ZoneRisk.
    Guarantees no I/O, deterministic output for unit testing and historical backtesting.
    """
    if now is None:
        now = store.utcnow()
    else:
        now = _ensure_utc(now)

    reasons: List[str] = []

    # 1. Staleness check (120s rule)
    active_vision: Optional[VisionSignal] = None
    if cam_sample is not None:
        age = (now - _ensure_utc(cam_sample.timestamp)).total_seconds()
        if age <= cfg.STALENESS_SECONDS:
            active_vision = cam_sample

    active_beacon: Optional[BeaconSignal] = None
    if ble_sample is not None:
        age = (now - _ensure_utc(ble_sample.timestamp)).total_seconds()
        if age <= cfg.STALENESS_SECONDS:
            active_beacon = ble_sample

    # 2. Determine signal_status: "ok" | "stale" | "none"
    if active_vision is not None or active_beacon is not None:
        signal_status = "ok"
    elif has_signals_ever:
        signal_status = "stale"
    else:
        signal_status = "none"

    has_live = signal_status != "none"

    # 3. Handle NO_DATA (stale or missing sensors)
    if signal_status != "ok":
        if signal_status == "stale":
            reasons.append("sensor feeds are stale (>120s without live update)")
        else:
            reasons.append("uninstrumented venue (forecast only)")

        # In no_data state, thresholds are NOT applied and risk_tier/level are NO_DATA
        return ZoneRisk(
            zone_id=zone.id,
            zone_name=zone.name,
            timestamp=now,
            risk_score=0.0,
            risk_tier=RiskTier.NO_DATA,
            level=RiskTier.NO_DATA,
            fused_estimate=0,
            occupancy=0.0,
            capacity=zone.capacity,
            vision=active_vision,
            beacon=active_beacon,
            forecast_pressure=round(forecast_pressure, 3),
            reasons=reasons,
            has_live_signals=has_live,
            signal_status=signal_status,
        )

    # 4. Convert live signals to occupancy ratios
    vision_ratio: Optional[float] = None
    if active_vision is not None:
        vision_ratio = clamp(active_vision.person_count / zone.capacity)

    beacon_ratio: Optional[float] = None
    if active_beacon is not None:
        calibrated_count = active_beacon.unique_devices * cfg.BEACON_MULTIPLIER * ble_scale
        beacon_ratio = clamp(calibrated_count / zone.capacity)

    # 5. Fuse available live signals
    occupancy: float = 0.0
    if vision_ratio is not None and beacon_ratio is not None:
        divergence = abs(vision_ratio - beacon_ratio)
        if divergence > cfg.DIVERGENCE_THRESHOLD:
            occupancy = max(vision_ratio, beacon_ratio)
            reasons.append("camera and Bluetooth counts disagree, using the higher estimate")
        else:
            occupancy = cfg.WEIGHT_CAMERA * vision_ratio + cfg.WEIGHT_BEACON * beacon_ratio
    elif vision_ratio is not None:
        occupancy = vision_ratio
        reasons.append("Bluetooth scanner offline for this zone")
    elif beacon_ratio is not None:
        occupancy = beacon_ratio
        reasons.append("camera feed unavailable, estimate from Bluetooth only")
    else:
        occupancy = 0.0
        reasons.append("no live sensor data")

    # 6. Rate of change detection
    rate_bonus, is_surging = compute_rate_of_change_pure(zone, history, now)
    if is_surging:
        reasons.append("crowd building rapidly")

    # 7. Directional flow bottleneck bonus
    flow_bonus: float = 0.0
    if active_vision is not None and active_vision.flow.magnitude > cfg.FLOW_THRESHOLD:
        flow_bonus = cfg.FLOW_BONUS
        reasons.append("strong directional flow into this zone")

    # 8. Compute final fused risk score
    risk_score = clamp(
        (cfg.WEIGHT_OCCUPANCY * occupancy)
        + (cfg.WEIGHT_FORECAST * forecast_pressure)
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
        level=risk_tier,
        fused_estimate=fused_estimate,
        occupancy=round(occupancy, 4),
        capacity=zone.capacity,
        vision=active_vision,
        beacon=active_beacon,
        forecast_pressure=round(forecast_pressure, 3),
        reasons=reasons,
        has_live_signals=True,
        signal_status="ok",
    )


def _forecast_pressure(zone_id: str) -> Tuple[float, List[str]]:
    """Lazy import of Person B's forecast engine. Degrades gracefully to (0.0, [])."""
    try:
        from app.services.forecaster import zone_pressure
        return zone_pressure(zone_id)
    except Exception:
        return 0.0, []


def evaluate_zone_risk(zone_id: str) -> ZoneRisk:
    """Evaluates the risk for a zone using live store state and the pure fuse() engine."""
    now = store.utcnow()
    from app.api.v1.endpoints.zones import get_all_zones_map
    all_zones = get_all_zones_map()
    zone = all_zones.get(zone_id)

    if not zone:
        zone = Zone(id=zone_id, name=f"Zone {zone_id}", capacity=500, area_sqm=500.0, lat=0.0, lon=0.0)

    # If it's a named place (not in ZONES), it has no IoT sensors installed
    is_instrumented = zone_id in ZONE_BY_ID
    forecast_pressure, forecast_drivers = _forecast_pressure(zone_id)

    if not is_instrumented:
        # Named places are forecast-only: signal_status="none", level="no_data", has_live_signals=False
        return fuse(
            zone=zone,
            cam_sample=None,
            ble_sample=None,
            forecast_pressure=forecast_pressure,
            history=None,
            now=now,
            ble_scale=1.0,
            has_signals_ever=False,
        )

    # Instrumented zone: read store signals
    raw_vision = store.latest_vision(zone_id)
    raw_beacon = store.latest_beacon(zone_id)
    vis_hist = store.vision_history(zone_id, limit=20)
    bcn_hist = store.beacon_history(zone_id, limit=20)
    has_signals_ever = (raw_vision is not None) or (raw_beacon is not None) or len(bcn_hist) > 0

    scale = get_ble_scale(zone_id)

    # Perform pure fusion
    risk = fuse(
        zone=zone,
        cam_sample=raw_vision,
        ble_sample=raw_beacon,
        forecast_pressure=forecast_pressure,
        history=(vis_hist, bcn_hist),
        now=now,
        ble_scale=scale,
        has_signals_ever=has_signals_ever,
    )

    if forecast_pressure > 0.30 and forecast_drivers:
        risk.reasons.extend(forecast_drivers)

    # If both sensors are active, update calibration
    if risk.signal_status == "ok":
        is_surging = "crowd building rapidly" in risk.reasons
        update_calibration(
            zone_id=zone_id,
            cam_sample=raw_vision,
            ble_sample=raw_beacon,
            capacity=zone.capacity,
            is_surging=is_surging,
            now=now,
        )

    return risk


def evaluate_all_zones() -> List[ZoneRisk]:
    """Evaluates all registered instrumented zones for live monitoring."""
    results: List[ZoneRisk] = []
    for zone in ZONE_BY_ID.values():
        try:
            results.append(evaluate_zone_risk(zone.id))
        except Exception:
            results.append(
                ZoneRisk(
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
                    reasons=["sensor telemetry unavailable"],
                    has_live_signals=True,
                    signal_status="stale",
                )
            )
    return results
