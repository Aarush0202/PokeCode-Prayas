"""CrowdGuard Attention Panel Engine.

Responsible for:
1. Triaging monitored zones and named places into 3 actionable categories:
   - 'act_now': Immediate high/critical crowd risk or severe stampede hazard.
   - 'watch_soon': Elevated conditions or high incoming forecast pressure.
   - 'needs_checking': Telemetry dropout, stale sensors, sensor divergence, or unmonitored places.
2. Honest attribution of signals:
   - observed: True when backed by live physical sensors (cameras, BLE).
   - observed: False when derived purely from predictive ML models / scheduled events.
3. State management, debouncing, operator acknowledgements, and snoozing.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.data.named_places import NAMED_PLACES
from app.schemas.shared import ZONE_BY_ID, RiskTier, ZoneRisk
from app.services import fusion, store

logger = logging.getLogger("crowdguard.attention")


class AttentionCategory(str, Enum):
    ACT_NOW = "act_now"
    WATCH_SOON = "watch_soon"
    NEEDS_CHECKING = "needs_checking"


class AttentionItem(BaseModel):
    id: str
    zone_id: str
    zone_name: str
    category: AttentionCategory
    priority: int  # 1 (most urgent) to 5
    title: str
    summary: str
    risk_score: float
    risk_tier: RiskTier
    level: RiskTier
    occupancy: float
    observed: bool  # True = live IoT sensor observation; False = predictive forecast / scheduled
    signal_status: str  # "ok" | "stale" | "none"
    acknowledged: bool = False
    snoozed_until: Optional[datetime] = None
    created_at: datetime
    recommended_action: str
    drivers: List[str] = Field(default_factory=list)


class AttentionCounts(BaseModel):
    total: int
    act_now: int
    watch_soon: int
    needs_checking: int


class AttentionResponse(BaseModel):
    generated_at: datetime
    counts: AttentionCounts
    groups: Dict[str, List[AttentionItem]]
    items: List[AttentionItem]


class AcknowledgeRequest(BaseModel):
    item_id: Optional[str] = None
    zone_id: Optional[str] = None


class SnoozeRequest(BaseModel):
    item_id: Optional[str] = None
    zone_id: Optional[str] = None
    minutes: int = Field(default=15, ge=1, le=1440)


# In-memory mutable state for operator interactions (acknowledgements, snoozes, debouncing)
_attention_state: Dict[str, Dict[str, Any]] = {}


def reset_attention_state() -> None:
    """Clear all in-memory attention state (useful for test isolation)."""
    _attention_state.clear()


def _get_zone_state(zone_id: str) -> Dict[str, Any]:
    if zone_id not in _attention_state:
        _attention_state[zone_id] = {
            "acknowledged": False,
            "acknowledged_at": None,
            "snoozed_until": None,
            "last_tier": None,
            "last_category": None,
            "first_triggered": None,
            "last_evaluated": None,
        }
    return _attention_state[zone_id]


def acknowledge_item(item_id: Optional[str] = None, zone_id: Optional[str] = None) -> bool:
    """Acknowledge an active attention item by item_id or zone_id."""
    target_zone = zone_id
    if not target_zone and item_id:
        # IDs are formatted like 'att-{zone_id}-{category}'
        parts = item_id.split("-")
        if len(parts) >= 2:
            target_zone = parts[1]

    if not target_zone:
        return False

    st = _get_zone_state(target_zone)
    st["acknowledged"] = True
    st["acknowledged_at"] = store.utcnow()
    return True


def snooze_item(
    item_id: Optional[str] = None,
    zone_id: Optional[str] = None,
    minutes: int = 15,
) -> Optional[datetime]:
    """Snooze alerts for a zone for specified minutes unless critical escalation occurs."""
    target_zone = zone_id
    if not target_zone and item_id:
        parts = item_id.split("-")
        if len(parts) >= 2:
            target_zone = parts[1]

    if not target_zone:
        return None

    now = store.utcnow()
    snooze_expiry = now + timedelta(minutes=minutes)
    st = _get_zone_state(target_zone)
    st["snoozed_until"] = snooze_expiry
    return snooze_expiry


def evaluate_attention_items(now: Optional[datetime] = None) -> AttentionResponse:
    """Evaluates all monitored zones and held-out venues against attention ranking rules."""
    current_time = now or store.utcnow()

    # 1. Fetch live evaluated risk for all 4 primary monitored zones
    monitored_risks: List[ZoneRisk] = fusion.evaluate_all_zones()

    # 2. Also evaluate held-out named places (Chandni Chowk, Cyber Hub, etc.)
    all_evaluated: List[ZoneRisk] = list(monitored_risks)
    for np in NAMED_PLACES:
        try:
            place_risk = fusion.evaluate_zone_risk(np.id)
            all_evaluated.append(place_risk)
        except Exception:
            continue

    act_now_items: List[AttentionItem] = []
    watch_soon_items: List[AttentionItem] = []
    needs_checking_items: List[AttentionItem] = []

    for z in all_evaluated:
        z_state = _get_zone_state(z.zone_id)

        # Check if currently snoozed
        snoozed_until: Optional[datetime] = z_state.get("snoozed_until")
        is_snoozed = False
        if snoozed_until and current_time < snoozed_until:
            # Escalation override: if condition worsened to ACT_NOW (HIGH or CRITICAL), break snooze
            is_escalated = (
                z.level in (RiskTier.CRITICAL, RiskTier.HIGH)
                or z.risk_tier in (RiskTier.CRITICAL, RiskTier.HIGH)
                or z.risk_score >= 0.65
            )
            if is_escalated and z_state.get("last_tier") not in (RiskTier.CRITICAL, RiskTier.HIGH):
                z_state["snoozed_until"] = None
                is_snoozed = False
            else:
                is_snoozed = True

        if is_snoozed:
            continue

        item = _triage_zone(z, z_state, current_time)
        if not item:
            z_state["last_category"] = None
            z_state["last_tier"] = z.level
            continue

        # Record state tracking for debouncing
        z_state["last_category"] = item.category
        z_state["last_tier"] = z.level
        z_state["last_evaluated"] = current_time

        if item.category == AttentionCategory.ACT_NOW:
            act_now_items.append(item)
        elif item.category == AttentionCategory.WATCH_SOON:
            watch_soon_items.append(item)
        elif item.category == AttentionCategory.NEEDS_CHECKING:
            needs_checking_items.append(item)

    # Sort each category by priority ascending, then risk_score descending
    act_now_items.sort(key=lambda x: (x.priority, -x.risk_score))
    watch_soon_items.sort(key=lambda x: (x.priority, -x.risk_score))
    needs_checking_items.sort(key=lambda x: (x.priority, -x.occupancy))

    # Enforce strict 5-item cap per group (highest urgency / soonest first, drop the rest)
    GROUP_CAP = 5
    act_now_capped = act_now_items[:GROUP_CAP]
    watch_soon_capped = watch_soon_items[:GROUP_CAP]
    needs_checking_capped = needs_checking_items[:GROUP_CAP]

    all_items = act_now_capped + watch_soon_capped + needs_checking_capped

    return AttentionResponse(
        generated_at=current_time,
        counts=AttentionCounts(
            total=len(all_items),
            act_now=len(act_now_capped),
            watch_soon=len(watch_soon_capped),
            needs_checking=len(needs_checking_capped),
        ),
        groups={
            "act_now": act_now_capped,
            "watch_soon": watch_soon_capped,
            "needs_checking": needs_checking_capped,
        },
        items=all_items,
    )


def _triage_zone(
    z: ZoneRisk,
    z_state: Dict[str, Any],
    now: datetime,
) -> Optional[AttentionItem]:
    """Applies ranking and safety rules to map a ZoneRisk to an AttentionItem if warranted."""
    zone_id = z.zone_id
    zone_name = z.zone_name
    level = z.level
    tier = z.risk_tier
    score = z.risk_score
    occupancy = z.occupancy
    pressure = z.forecast_pressure
    status_str = z.signal_status
    has_live = z.has_live_signals
    is_ack = z_state.get("acknowledged", False)
    drivers = list(z.reasons)

    is_named_place = zone_id not in ZONE_BY_ID

    # Rule: Named/held-out places (anything not z1-z4) must NEVER appear in needs_checking.
    # They were never expected to have physical sensors, so lack of live data is normal.
    # They should only ever appear in watch_soon (if forecast crosses threshold) or not appear at all.
    if is_named_place:
        if pressure >= 0.50:
            return AttentionItem(
                id=f"att-{zone_id}-watch_soon",
                zone_id=zone_id,
                zone_name=zone_name,
                category=AttentionCategory.WATCH_SOON,
                priority=4,
                title=f"Forecast Surge Predicted: {zone_name}",
                summary=(
                    f"Predictive models forecast heavy pedestrian influx ({int(pressure * 100)}% capacity pressure) "
                    f"over the next 3 hours at this uninstrumented venue."
                ),
                risk_score=score,
                risk_tier=tier,
                level=level,
                occupancy=occupancy,
                observed=False,  # Unmonitored venue projection
                signal_status=status_str,
                acknowledged=is_ack,
                created_at=now,
                recommended_action="Review scheduled event calendar and pre-position crowd safety stewards.",
                drivers=drivers or ["Predictive model forecast surge"],
            )
        return None

    # --- Instrumented Zones (z1-z4) Only ---

    # 1. Check for NEEDS_CHECKING conditions
    is_no_data = (
        level == RiskTier.NO_DATA
        or tier == RiskTier.NO_DATA
        or str(level).lower() == "no_data"
        or str(tier).lower() == "no_data"
    )

    if is_no_data:
        return AttentionItem(
            id=f"att-{zone_id}-needs_checking",
            zone_id=zone_id,
            zone_name=zone_name,
            category=AttentionCategory.NEEDS_CHECKING,
            priority=5,
            title=f"Sensor Telemetry Lost: {zone_name}",
            summary="Primary sensors disconnected. Zone operating in unmonitored fail-safe mode.",
            risk_score=score,
            risk_tier=tier,
            level=level,
            occupancy=occupancy,
            observed=False,
            signal_status=status_str,
            acknowledged=is_ack,
            created_at=now,
            recommended_action="Inspect gateway connection or deploy portable BLE scanner unit.",
            drivers=drivers or ["No live IoT telemetry available"],
        )

    # Rule 1b: Stale sensors or signal lost
    if status_str in ("stale", "none") or not has_live:
        return AttentionItem(
            id=f"att-{zone_id}-needs_checking",
            zone_id=zone_id,
            zone_name=zone_name,
            category=AttentionCategory.NEEDS_CHECKING,
            priority=5,
            title=f"Sensor Stale / Stalled: {zone_name}",
            summary=f"Telemetry feed has stopped updating ({status_str}). " + ("; ".join(drivers) or "Check gateway."),
            risk_score=score,
            risk_tier=tier,
            level=level,
            occupancy=occupancy,
            observed=True,
            signal_status=status_str,
            acknowledged=is_ack,
            created_at=now,
            recommended_action="Inspect BLE sensor gateway and CCTV edge inference process.",
            drivers=drivers or ["Telemetry heartbeat timeout"],
        )

    # Rule 1c: Vision vs BLE sensor divergence > 50% capacity
    if z.vision and z.beacon and z.capacity > 0:
        discrepancy = abs(z.vision.person_count - z.beacon.unique_devices)
        if discrepancy > (0.50 * z.capacity):
            return AttentionItem(
                id=f"att-{zone_id}-needs_checking",
                zone_id=zone_id,
                zone_name=zone_name,
                category=AttentionCategory.NEEDS_CHECKING,
                priority=4,
                title=f"Sensor Divergence: {zone_name}",
                summary=(
                    f"Camera ({z.vision.person_count}) and BLE scanner ({z.beacon.unique_devices}) "
                    f"differ by {discrepancy} occupants (>50% capacity). Potential camera occlusion or RF bleed."
                ),
                risk_score=score,
                risk_tier=tier,
                level=level,
                occupancy=occupancy,
                observed=True,
                signal_status=status_str,
                acknowledged=is_ack,
                created_at=now,
                recommended_action="Recalibrate BLE sensitivity scale or inspect optical lens for occlusion.",
                drivers=drivers or ["High cross-modality sensor discrepancy"],
            )

    # 2. Check for ACT_NOW conditions (CRITICAL or HIGH risk)
    is_critical = level == RiskTier.CRITICAL or tier == RiskTier.CRITICAL or score >= 0.85
    if is_critical:
        return AttentionItem(
            id=f"att-{zone_id}-act_now",
            zone_id=zone_id,
            zone_name=zone_name,
            category=AttentionCategory.ACT_NOW,
            priority=1,
            title=f"CRITICAL STAMPEDE HAZARD: {zone_name}",
            summary=f"Severe crowd density (occupancy {int(occupancy * 100)}%, risk {score:.2f}). " + ("; ".join(drivers) or "Immediate action required."),
            risk_score=score,
            risk_tier=tier,
            level=level,
            occupancy=occupancy,
            observed=True,
            signal_status=status_str,
            acknowledged=is_ack,
            created_at=now,
            recommended_action="Deploy tactical crowd stewards, open emergency egress corridors, and halt incoming transit ingress.",
            drivers=drivers,
        )

    is_high = level == RiskTier.HIGH or tier == RiskTier.HIGH or score >= 0.65
    if is_high:
        return AttentionItem(
            id=f"att-{zone_id}-act_now",
            zone_id=zone_id,
            zone_name=zone_name,
            category=AttentionCategory.ACT_NOW,
            priority=2,
            title=f"High Crowd Surge: {zone_name}",
            summary=f"Dangerous crowd buildup detected (occupancy {int(occupancy * 100)}%, risk {score:.2f}). " + ("; ".join(drivers) or "Approaching capacity limit."),
            risk_score=score,
            risk_tier=tier,
            level=level,
            occupancy=occupancy,
            observed=True,
            signal_status=status_str,
            acknowledged=is_ack,
            created_at=now,
            recommended_action="Activate meter gating on access corridors and stage rapid-response security personnel.",
            drivers=drivers,
        )

    # 3. Check for WATCH_SOON conditions (ELEVATED risk or forecast spike)
    is_elevated_live = level == RiskTier.ELEVATED or tier == RiskTier.ELEVATED or (score >= 0.40 and score < 0.65)
    if is_elevated_live:
        return AttentionItem(
            id=f"att-{zone_id}-watch_soon",
            zone_id=zone_id,
            zone_name=zone_name,
            category=AttentionCategory.WATCH_SOON,
            priority=3,
            title=f"Elevated Density Building: {zone_name}",
            summary=f"Crowd volume steadily ascending (occupancy {int(occupancy * 100)}%, risk {score:.2f}). " + ("; ".join(drivers) or "Monitor for bottlenecking."),
            risk_score=score,
            risk_tier=tier,
            level=level,
            occupancy=occupancy,
            observed=True,
            signal_status=status_str,
            acknowledged=is_ack,
            created_at=now,
            recommended_action="Monitor camera feeds on choke points and prepare signage for crowd diversions.",
            drivers=drivers,
        )

    is_forecast_spike = pressure >= 0.50
    if is_forecast_spike:
        return AttentionItem(
            id=f"att-{zone_id}-watch_soon",
            zone_id=zone_id,
            zone_name=zone_name,
            category=AttentionCategory.WATCH_SOON,
            priority=4,
            title=f"Forecast Surge Predicted: {zone_name}",
            summary=f"Predictive models forecast heavy pedestrian influx ({int(pressure * 100)}% capacity pressure) over the next 3 hours. " + ("; ".join(drivers) or "Correlates with scheduled urban events."),
            risk_score=score,
            risk_tier=tier,
            level=level,
            occupancy=occupancy,
            observed=False,  # CRITICAL HONESTY: Forecast model projection, not live sensor reading
            signal_status=status_str,
            acknowledged=is_ack,
            created_at=now,
            recommended_action="Pre-position barriers and verify staffing ahead of incoming scheduled event surge.",
            drivers=drivers,
        )

    # Nominal conditions (NORMAL risk, healthy sensors, low forecast pressure) -> no attention item
    return None
