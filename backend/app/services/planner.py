"""CrowdGuard Event Planner Assessment Engine.
Pure deterministic feasibility analysis and crowd surge risk assessment.
No LLM, no external network I/O.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.api.v1.endpoints.zones import get_all_zones_map
from app.schemas.shared import VenueCategory, Zone
from app.services import planner_config as cfg

IST = timezone(timedelta(hours=5, minutes=30))

VERDICT_RANKS = {
    "feasible": 3,
    "feasible_with_mitigations": 2,
    "not_recommended": 1,
}


def parse_and_ensure_ist(dt_input: str | datetime) -> datetime:
    """Parses input timestamp and ensures timezone awareness, defaulting naive inputs to IST (+05:30)."""
    if isinstance(dt_input, str):
        # Handle ISO strings
        dt = datetime.fromisoformat(dt_input)
    else:
        dt = dt_input

    if dt.tzinfo is None:
        return dt.replace(tzinfo=IST)
    return dt


def get_baseline_ratio_series(zone: Zone, timestamps: List[datetime]) -> Tuple[List[float], bool]:
    """Retrieves baseline footfall ratio series without special events.
    Tries forecaster.baseline_ratio_series first, then falls back to statistical model.
    """
    try:
        from app.services import forecaster
        if hasattr(forecaster, "baseline_ratio_series"):
            return forecaster.baseline_ratio_series(zone, timestamps), True
    except Exception as e:
        logger.warning(f"Failed to fetch forecaster baseline_ratio_series: {e}")

    # Statistical diurnal baseline fallback
    ratios: List[float] = []
    for dt in timestamps:
        hour = dt.hour + dt.minute / 60.0
        # Diurnal twin-peak curve (lunch peak ~13:00, evening peak ~19:30, nocturnal lull)
        if 6.0 <= hour <= 23.0:
            sin_term = math.sin(math.pi * (hour - 6.0) / 16.0) ** 2
            base = 0.10 + 0.25 * sin_term
        else:
            base = 0.03

        if dt.weekday() >= 5:  # Weekend shopping/recreation bump
            base *= 1.25

        ratios.append(round(max(0.02, min(0.60, base)), 4))

    return ratios, False


def compute_scenario_curve(
    zone: Zone,
    timestamps: List[datetime],
    baseline_ratios: List[float],
    start_time: datetime,
    end_time: datetime,
    attendance: float,
    profile: cfg.EventProfile,
) -> Tuple[List[Dict[str, Any]], float, float, datetime]:
    """Computes the 15-minute timestep breakdown and identifies peak metrics for a given scenario."""
    t_arr_start = start_time - timedelta(hours=profile.pre_h)
    t_egr_end = end_time + timedelta(hours=profile.post_h)
    peak_target = profile.on_site_fraction * attendance

    timeline: List[Dict[str, Any]] = []
    peak_total = 0
    peak_ratio = 0.0
    peak_time = start_time

    for dt, b_ratio in zip(timestamps, baseline_ratios):
        baseline_count = round(b_ratio * zone.capacity)

        # Trapezoidal arrival and egress curve
        if dt < t_arr_start or dt > t_egr_end:
            event_count = 0.0
        elif t_arr_start <= dt < start_time:
            ramp_duration = (start_time - t_arr_start).total_seconds()
            elapsed = (dt - t_arr_start).total_seconds()
            fraction = elapsed / max(ramp_duration, 1.0)
            event_count = fraction * peak_target
        elif start_time <= dt <= end_time:
            event_count = peak_target
        else:  # end_time < dt <= t_egr_end
            decay_duration = (t_egr_end - end_time).total_seconds()
            remaining = (t_egr_end - dt).total_seconds()
            fraction = remaining / max(decay_duration, 1.0)
            event_count = fraction * peak_target

        total_present = baseline_count + round(event_count)
        ratio = round(total_present / zone.capacity, 4)

        if total_present > peak_total:
            peak_total = total_present
            peak_ratio = ratio
            peak_time = dt

        timeline.append({
            "time": dt.isoformat(),
            "baseline": baseline_count,
            "event": round(event_count),
            "total": total_present,
            "ratio": ratio,
        })

    return timeline, peak_total, peak_ratio, peak_time


def evaluate_verdict(
    expected_peak_ratio: float,
    plus30_peak_ratio: float,
    plus60_peak_ratio: float,
    peak_density: float,
) -> Tuple[str, List[str]]:
    """Evaluates the event verdict and compiles explaining reasons."""
    reasons: List[str] = []

    # Primary verdict from expected peak ratio
    if expected_peak_ratio > cfg.RATIO_LIMIT:
        verdict = "not_recommended"
        reasons.append(f"Expected peak occupancy ({expected_peak_ratio * 100:.1f}%) exceeds venue design capacity.")
    elif expected_peak_ratio > cfg.RATIO_COMFORTABLE:
        verdict = "feasible_with_mitigations"
        reasons.append(f"Expected peak occupancy ({expected_peak_ratio * 100:.1f}%) requires crowd mitigation protocols.")
    else:
        verdict = "feasible"
        reasons.append(f"Expected peak occupancy ({expected_peak_ratio * 100:.1f}%) is within comfortable capacity.")

    # Downgrade if +30% surge scenario breaches safety overshoot tolerance
    if plus30_peak_ratio > cfg.OVERSHOOT_TOLERANCE:
        if verdict == "feasible":
            verdict = "feasible_with_mitigations"
            reasons.append(
                f"+30% surge scenario reaches {plus30_peak_ratio * 100:.1f}% capacity (overshoot > {cfg.OVERSHOOT_TOLERANCE * 100:.0f}%), downgrading to feasible_with_mitigations."
            )
        elif verdict == "feasible_with_mitigations":
            verdict = "not_recommended"
            reasons.append(
                f"+30% surge scenario severely overshoots capacity at {plus30_peak_ratio * 100:.1f}%, downgrading to not_recommended."
            )

    # Secondary warnings
    if plus60_peak_ratio > 1.20:
        reasons.append(f"High sensitivity to attendance spikes: +60% scenario reaches {plus60_peak_ratio * 100:.1f}% capacity.")

    if peak_density > cfg.DENSITY_WARN:
        reasons.append(
            f"Peak crowd density reaches {peak_density:.2f} persons/m², exceeding safety threshold of {cfg.DENSITY_WARN} persons/m² (area is estimated)."
        )

    return verdict, reasons


def compute_mitigations(
    zone: Zone,
    peak_ratio: float,
    expected_attendance: int,
    draw_multiplier: float,
    profile: cfg.EventProfile,
    peak_baseline: int,
    start_time: datetime,
) -> List[str]:
    """Generates concrete operational mitigations for safety officers and event managers."""
    mitigations: List[str] = []

    if peak_ratio > cfg.RATIO_COMFORTABLE:
        mitigations.append("Implement staggered entry time-slots and cap ticket sales with verified turnstiles.")

    if peak_ratio > cfg.RATIO_LIMIT:
        # Compute maximum attendance N so that expected peak ratio <= 0.85
        effective_scale = draw_multiplier * profile.on_site_fraction
        target_event_cap = max(0, int((0.85 * zone.capacity - peak_baseline) / max(effective_scale, 0.01)))
        mitigations.append(
            f"Cap attendance near {target_event_cap:,} attendees to maintain peak occupancy below 85% capacity, or relocate to a higher-capacity venue."
        )

    if zone.category == VenueCategory.TRANSIT_HUB or "metro" in zone.name.lower():
        mitigations.append("Coordinate train and metro dispatchers for express evacuation clearance and entry gate throttling.")

    # High baseline evening warning
    if start_time.hour in (17, 18, 19, 20) and peak_baseline > (0.30 * zone.capacity):
        mitigations.append(
            "Consider rescheduling event start outside evening pedestrian rush-hour (before 16:00 or after 20:30)."
        )

    return mitigations


def find_alternatives(
    zone: Zone,
    event_type: str,
    start_time: datetime,
    duration_hours: float,
    expected_attendance: int,
    draw_level: str,
    current_verdict: str,
) -> List[Dict[str, Any]]:
    """Identifies suitable alternative venues in the same city."""
    all_zones = get_all_zones_map()
    allowed_cats = cfg.ALLOWED_CATEGORIES.get(event_type, cfg.ALLOWED_CATEGORIES["other"])
    draw_mult = cfg.DRAW_MULTIPLIER.get(draw_level, 1.0)
    profile = cfg.EVENT_PROFILES.get(event_type, cfg.EVENT_PROFILES["other"])
    current_rank = VERDICT_RANKS.get(current_verdict, 1)

    candidates = []

    for other in all_zones.values():
        if other.id == zone.id or other.id.startswith("syn"):
            continue
        if other.city != zone.city:
            continue
        if other.category not in allowed_cats:
            continue

        # Evaluate candidate peak ratio
        end_time = start_time + timedelta(hours=duration_hours)
        t_start = start_time - timedelta(hours=profile.pre_h)
        t_end = end_time + timedelta(hours=profile.post_h)

        timestamps = []
        curr = t_start
        while curr <= t_end:
            timestamps.append(curr)
            curr += timedelta(minutes=15)

        base_ratios, _ = get_baseline_ratio_series(other, timestamps)
        att = expected_attendance * draw_mult
        _, _, cand_peak_ratio, _ = compute_scenario_curve(
            other, timestamps, base_ratios, start_time, end_time, att, profile
        )

        cand_verdict = (
            "not_recommended"
            if cand_peak_ratio > cfg.RATIO_LIMIT
            else ("feasible_with_mitigations" if cand_peak_ratio > cfg.RATIO_COMFORTABLE else "feasible")
        )
        cand_rank = VERDICT_RANKS.get(cand_verdict, 1)

        # Candidate verdict must be equal or better than current verdict
        if cand_rank >= current_rank:
            candidates.append({
                "zone_id": other.id,
                "name": other.name,
                "peak_ratio": cand_peak_ratio,
                "verdict": cand_verdict,
            })

    # Sort candidates by lowest peak ratio ascending, take top 3
    candidates.sort(key=lambda c: c["peak_ratio"])
    return candidates[:3]


def assess_event(
    zone_id: str,
    start_time_raw: str | datetime,
    duration_hours: float,
    event_type: str,
    expected_attendance: int,
    draw_level: str = "normal",
) -> Dict[str, Any]:
    """Main assessment function returning complete contract shape."""
    all_zones = get_all_zones_map()
    zone = all_zones.get(zone_id)
    if not zone or zone_id.startswith("syn"):
        raise KeyError(f"Zone '{zone_id}' not found")

    start_time = parse_and_ensure_ist(start_time_raw)
    end_time = start_time + timedelta(hours=duration_hours)
    draw_mult = cfg.DRAW_MULTIPLIER.get(draw_level, 1.0)
    profile = cfg.EVENT_PROFILES.get(event_type, cfg.EVENT_PROFILES["other"])

    # Timestep horizon: 3 hours before start to 2 hours after end
    t_start = start_time - timedelta(hours=3.0)
    t_end = end_time + timedelta(hours=2.0)

    timestamps: List[datetime] = []
    curr = t_start
    while curr <= t_end:
        timestamps.append(curr)
        curr += timedelta(minutes=15)

    baseline_ratios, used_forecaster = get_baseline_ratio_series(zone, timestamps)

    # Scenario 1: Expected (1.0x)
    exp_timeline, exp_peak_total, exp_peak_ratio, exp_peak_time = compute_scenario_curve(
        zone, timestamps, baseline_ratios, start_time, end_time, expected_attendance * draw_mult * 1.0, profile
    )

    # Scenario 2: +30% surge (1.3x)
    _, _, p30_peak_ratio, _ = compute_scenario_curve(
        zone, timestamps, baseline_ratios, start_time, end_time, expected_attendance * draw_mult * 1.3, profile
    )

    # Scenario 3: +60% surge (1.6x)
    _, _, p60_peak_ratio, _ = compute_scenario_curve(
        zone, timestamps, baseline_ratios, start_time, end_time, expected_attendance * draw_mult * 1.6, profile
    )

    peak_density = round(exp_peak_total / zone.area_sqm, 3)

    verdict, reasons = evaluate_verdict(exp_peak_ratio, p30_peak_ratio, p60_peak_ratio, peak_density)

    # Scenarios summary
    scenarios = [
        {
            "label": "expected",
            "attendance": expected_attendance,
            "peak_ratio": exp_peak_ratio,
            "verdict": verdict,
        },
        {
            "label": "+30%",
            "attendance": int(expected_attendance * 1.3),
            "peak_ratio": p30_peak_ratio,
            "verdict": "not_recommended" if p30_peak_ratio > cfg.RATIO_LIMIT else ("feasible_with_mitigations" if p30_peak_ratio > cfg.RATIO_COMFORTABLE else "feasible"),
        },
        {
            "label": "+60%",
            "attendance": int(expected_attendance * 1.6),
            "peak_ratio": p60_peak_ratio,
            "verdict": "not_recommended" if p60_peak_ratio > cfg.RATIO_LIMIT else ("feasible_with_mitigations" if p60_peak_ratio > cfg.RATIO_COMFORTABLE else "feasible"),
        },
    ]

    # Baseline footfall at peak time
    peak_step = next((s for s in exp_timeline if s["time"] == exp_peak_time.isoformat()), None)
    baseline_at_peak = peak_step["baseline"] if peak_step else round(0.20 * zone.capacity)

    mitigations = compute_mitigations(
        zone, exp_peak_ratio, expected_attendance, draw_mult, profile, baseline_at_peak, start_time
    )

    alternatives = find_alternatives(
        zone, event_type, start_time, duration_hours, expected_attendance, draw_level, verdict
    )

    assumptions = list(cfg.DEFAULT_ASSUMPTIONS)
    if not used_forecaster:
        assumptions.append("Baseline series computed via statistical diurnal pedestrian model (forecaster baseline_ratio_series pending).")

    return {
        "zone": {
            "id": zone.id,
            "name": zone.name,
            "city": zone.city,
            "category": zone.category.value,
            "capacity": zone.capacity,
            "area_sqm": zone.area_sqm,
        },
        "verdict": verdict,
        "peak": {
            "time": exp_peak_time.isoformat(),
            "total_present": exp_peak_total,
            "occupancy_ratio": exp_peak_ratio,
            "density_per_sqm": peak_density,
        },
        "scenarios": scenarios,
        "timeline": exp_timeline,
        "reasons": reasons,
        "mitigations": mitigations,
        "alternatives": alternatives,
        "assumptions": assumptions,
        "disclaimer": cfg.DISCLAIMER_TEXT,
    }
