"""CrowdGuard Footfall Forecaster & Explainability Engine.

Responsible for:
1. Category-based occupancy ratio prediction using GradientBoostingRegressor.
2. Resilient ML inference with pure rule-based fallback branching on VenueCategory.
3. Feature extraction in IST (Asia/Kolkata) with zero leakage of place_id, city, lat, lon, capacity.
4. Plain-English driver strings generation for every prediction point.
5. 3-hour crowd pressure calculation for Person C's fusion engine.
6. Baseline ratio series computation for Person C's Event Planner.
"""
from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import joblib
import numpy as np

from app.schemas.shared import (
    ZONE_BY_ID,
    ForecastPoint,
    ForecastResponse,
    RiskTier,
    VenueCategory,
    Zone,
    tier_from_score,
)
from app.services import event_fetcher, store

logger = logging.getLogger("crowdguard.forecaster")

# Fixed IST timezone
IST = ZoneInfo("Asia/Kolkata")

# Indian holidays (month, day)
INDIAN_HOLIDAYS = {
    (1, 26),  # Republic Day
    (3, 25),  # Holi
    (8, 15),  # Independence Day
    (10, 2),  # Gandhi Jayanti
    (10, 24), # Dussehra
    (11, 12), # Diwali
    (12, 25), # Christmas
}

WEEKDAY_NAMES = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]

FEATURE_COLS = [
    "cat_market",
    "cat_transit_hub",
    "cat_religious_site",
    "cat_campus_ground",
    "cat_food_street",
    "cat_public_square",
    "hour",
    "dow",
    "is_weekend",
    "rain",
    "temp",
    "event_attendance_ratio",
    "hours_to_event",
    "event_active",
]

_cached_model = None
_model_attempted = False


def is_holiday(dt: datetime) -> int:
    return 1 if (dt.month, dt.day) in INDIAN_HOLIDAYS else 0


def get_zone_by_id(zone_id: str) -> Optional[Zone]:
    """Retrieve Zone by ID, searching monitored ZONES and held-out NAMED_PLACES."""
    if zone_id in ZONE_BY_ID:
        return ZONE_BY_ID[zone_id]
    try:
        from app.data.named_places import NAMED_PLACES
        for p in NAMED_PLACES:
            if p.id == zone_id:
                return p
    except Exception:
        pass
    return None


def get_model_path() -> Path:
    base_dir = Path(__file__).resolve().parent.parent.parent
    return base_dir / "data" / "forecast_model.joblib"


def load_model():
    """Lazily load persisted model with exception safety."""
    global _cached_model, _model_attempted
    if _cached_model is not None:
        return _cached_model

    _model_attempted = True
    model_path = get_model_path()
    if not model_path.is_file():
        logger.warning("Forecast model file %s not found. Using rule-based fallback.", model_path)
        return None

    try:
        model = joblib.load(model_path)
        _cached_model = model
        logger.info("Successfully loaded GradientBoostingRegressor from %s", model_path)
        return _cached_model
    except Exception as exc:
        logger.warning("Failed to load forecast model from %s: %s. Using rule-based fallback.", model_path, exc)
        return None


def rule_based_predict_ratio(
    category: str,
    target_time: datetime,
    overlapping_att: int,
    capacity: int,
    hours_to_start: float,
    rain_mm: float,
) -> float:
    """Fallback rule-based occupancy ratio estimator (0.0 to 1.5) branching on VenueCategory."""
    target_ist = target_time.astimezone(IST) if target_time.tzinfo else target_time.replace(tzinfo=timezone.utc).astimezone(IST)
    hour = target_ist.hour
    dow = target_ist.weekday()
    is_weekend = dow >= 5
    holiday = is_holiday(target_ist)

    cat_clean = category.lower() if isinstance(category, str) else str(category.value).lower()

    if cat_clean == "market":
        # Evening rise, massive on weekends
        if 1 <= hour <= 6:
            base_frac = 0.03
        elif is_weekend:
            base_frac = 0.82 if 16 <= hour <= 22 else (0.45 if 11 <= hour <= 15 else 0.12)
        else:
            base_frac = 0.58 if 17 <= hour <= 21 else (0.28 if 12 <= hour <= 16 else 0.08)

    elif cat_clean == "transit_hub":
        # Heavy morning (8-10) and evening (17-20) commute rushes
        if 1 <= hour <= 5:
            base_frac = 0.02
        elif not is_weekend:
            if 8 <= hour <= 10:
                base_frac = 0.82
            elif 17 <= hour <= 20:
                base_frac = 0.85
            elif 11 <= hour <= 16:
                base_frac = 0.38
            else:
                base_frac = 0.15
        else:
            base_frac = 0.42 if 12 <= hour <= 20 else 0.15

    elif cat_clean == "religious_site":
        # Morning & evening prayer peaks
        if 0 <= hour <= 4:
            base_frac = 0.01
        elif 6 <= hour <= 8:
            base_frac = 0.40
        elif 18 <= hour <= 20:
            base_frac = 0.52 if is_weekend else 0.42
        elif 9 <= hour <= 17:
            base_frac = 0.20 if is_weekend else 0.16
        else:
            base_frac = 0.06

    elif cat_clean == "campus_ground":
        # Near zero except during scheduled events
        base_frac = 0.08 if (8 <= hour <= 18 and not is_weekend) else 0.03

    elif cat_clean == "food_street":
        # Lunch and dinner rushes
        if 1 <= hour <= 10:
            base_frac = 0.02
        elif 12 <= hour <= 14:
            base_frac = 0.74
        elif 19 <= hour <= 22:
            base_frac = 0.82 if is_weekend else 0.76
        elif 15 <= hour <= 18:
            base_frac = 0.18
        else:
            base_frac = 0.06

    else:  # public_square
        # Moderate flat day with mild evening rise
        if 1 <= hour <= 6:
            base_frac = 0.03
        elif 17 <= hour <= 21:
            base_frac = 0.60 if is_weekend else 0.50
        elif 10 <= hour <= 16:
            base_frac = 0.35
        else:
            base_frac = 0.12

    # Holiday bonus
    if holiday:
        if cat_clean == "religious_site":
            base_frac = max(base_frac, 0.80)
        else:
            base_frac *= 1.20

    # Event bump: arrival lead-in and duration plateau
    cap = max(1, capacity)
    event_ratio = overlapping_att / cap
    event_bump = 0.0
    if hours_to_start <= 1.5:
        event_bump += 0.25 * event_ratio
    if overlapping_att > 0:
        event_bump += min(0.85, 0.65 * event_ratio)

    combined = base_frac + event_bump
    if rain_mm > 0:
        suppress = 0.55 if cat_clean in ("market", "campus_ground", "public_square", "religious_site") else 0.75
        combined *= suppress

    return max(0.01, min(1.50, combined))


def rule_based_predict(
    zone: Zone,
    target_time: datetime,
    overlapping_att: int,
    hours_to_start: float,
    rain_mm: float,
) -> int:
    """Fallback rule-based footfall count estimator."""
    ratio = rule_based_predict_ratio(
        category=zone.category,
        target_time=target_time,
        overlapping_att=overlapping_att,
        capacity=zone.capacity,
        hours_to_start=hours_to_start,
        rain_mm=rain_mm,
    )
    return max(0, int(round(ratio * zone.capacity)))


def generate_drivers(
    zone: Zone,
    target_time: datetime,
    overlapping_events: List[Any],
    upcoming_events: List[Any],
    rain_mm: float,
    predicted_count: int,
) -> List[str]:
    """Assemble plain-English driver strings explaining why a crowd is predicted."""
    drivers: List[str] = []
    target_ist = target_time.astimezone(IST) if target_time.tzinfo else target_time.replace(tzinfo=timezone.utc).astimezone(IST)
    day_name = WEEKDAY_NAMES[target_ist.weekday()]
    hour = target_ist.hour
    is_weekend = target_ist.weekday() >= 5
    holiday = is_holiday(target_ist)

    cat_clean = zone.category.lower() if isinstance(zone.category, str) else str(zone.category.value).lower()

    # 1. Active overlapping events (highest priority)
    for ev in overlapping_events:
        drivers.append(f"{ev.title} ({ev.expected_attendance} expected)")

    # 2. Arrival surge for imminent events starting within 1.5 hours
    for ev in upcoming_events:
        diff_h = (ev.start_time - target_time).total_seconds() / 3600.0
        if 0 < diff_h <= 1.5:
            drivers.append(f"arrival surge before {ev.title}")

    # 3. Weather impact
    if rain_mm > 2.0:
        drivers.append("rain expected, footfall suppressed")
    else:
        drivers.append("clear weather")

    # 4. Category-specific Diurnal / Time-of-day pattern
    if 1 <= hour <= 5:
        drivers.append("overnight low")
    elif cat_clean == "transit_hub" and not is_weekend and (8 <= hour <= 10 or 17 <= hour <= 20):
        drivers.append(f"{day_name} commuter transit rush")
    elif cat_clean == "market" and is_weekend and (16 <= hour <= 22):
        drivers.append(f"{day_name} evening market rush")
    elif cat_clean == "religious_site" and (6 <= hour <= 8 or 18 <= hour <= 20):
        drivers.append(f"{day_name} devotional prayer rush")
    elif cat_clean == "food_street" and (12 <= hour <= 14):
        drivers.append("lunch hour peak")
    elif cat_clean == "food_street" and (19 <= hour <= 22):
        drivers.append("dinner rush")
    elif cat_clean == "campus_ground" and not overlapping_events:
        drivers.append("campus grounds quiet")
    elif 17 <= hour <= 21:
        drivers.append(f"{day_name} evening peak")
    elif 12 <= hour <= 16:
        drivers.append(f"{day_name} afternoon baseline")
    else:
        drivers.append(f"{day_name} baseline")

    # 5. Public holiday
    if holiday:
        drivers.append("public holiday")

    return drivers[:4]


def predict_zone_hour(zone_id: str, target_time: datetime) -> ForecastPoint:
    """Predict footfall, density, risk tier, and drivers for a specific zone and hour."""
    zone = get_zone_by_id(zone_id)
    if not zone:
        raise ValueError(f"Unknown zone_id: '{zone_id}'")

    all_events = event_fetcher.ensure_events_loaded()

    # Weather
    temp_c, rain_mm = event_fetcher.get_weather_for_zone_hour(zone_id, target_time)

    # Overlapping & upcoming events for this zone
    overlapping_events = []
    upcoming_events = []
    overlapping_att = 0
    hours_to_start = 99.0

    for ev in all_events:
        if ev.zone_id == zone_id:
            if ev.start_time <= target_time < (ev.end_time or ev.start_time + timedelta(hours=3)):
                overlapping_events.append(ev)
                overlapping_att += ev.expected_attendance
            elif target_time < ev.start_time:
                upcoming_events.append(ev)
                diff_h = (ev.start_time - target_time).total_seconds() / 3600.0
                if diff_h < hours_to_start:
                    hours_to_start = diff_h

    # Time features computed in IST
    target_ist = target_time.astimezone(IST) if target_time.tzinfo else target_time.replace(tzinfo=timezone.utc).astimezone(IST)
    hour = target_ist.hour
    dow = target_ist.weekday()
    is_weekend = 1 if dow >= 5 else 0

    cat_clean = zone.category.lower() if isinstance(zone.category, str) else str(zone.category.value).lower()
    att_ratio = round(overlapping_att / max(1, zone.capacity), 3)

    model = load_model()
    if model is not None:
        try:
            import pandas as pd
            feat_dict = {
                "cat_market": 1 if cat_clean == "market" else 0,
                "cat_transit_hub": 1 if cat_clean == "transit_hub" else 0,
                "cat_religious_site": 1 if cat_clean == "religious_site" else 0,
                "cat_campus_ground": 1 if cat_clean == "campus_ground" else 0,
                "cat_food_street": 1 if cat_clean == "food_street" else 0,
                "cat_public_square": 1 if cat_clean == "public_square" else 0,
                "hour": hour,
                "dow": dow,
                "is_weekend": is_weekend,
                "rain": rain_mm,
                "temp": temp_c,
                "event_attendance_ratio": att_ratio,
                "hours_to_event": min(99.0, hours_to_start),
                "event_active": 1 if overlapping_att > 0 else 0,
            }
            features_df = pd.DataFrame([feat_dict])[FEATURE_COLS]
            pred_ratio = float(model.predict(features_df)[0])
            predicted_count = max(0, int(round(pred_ratio * zone.capacity)))
        except Exception as exc:
            logger.warning("ML prediction failed: %s. Falling back to rule-based.", exc)
            predicted_count = rule_based_predict(zone, target_time, overlapping_att, hours_to_start, rain_mm)
    else:
        predicted_count = rule_based_predict(zone, target_time, overlapping_att, hours_to_start, rain_mm)

    predicted_density = round(predicted_count / zone.area_sqm, 3)

    # Risk tier evaluation based on capacity pressure and density
    cap_ratio = predicted_count / zone.capacity
    density_ratio = predicted_density / 2.0  # 2.0 people / sqm is critical density
    risk_score = min(1.0, max(cap_ratio, density_ratio))
    tier = tier_from_score(risk_score)

    drivers = generate_drivers(
        zone=zone,
        target_time=target_time,
        overlapping_events=overlapping_events,
        upcoming_events=upcoming_events,
        rain_mm=rain_mm,
        predicted_count=predicted_count,
    )

    return ForecastPoint(
        timestamp=target_time,
        predicted_count=predicted_count,
        predicted_density=predicted_density,
        risk_tier=tier,
        drivers=drivers,
    )


def get_forecast(zone_id: str, hours: int = 48) -> ForecastResponse:
    """Generate hourly ForecastPoint items for the specified horizon."""
    zone = get_zone_by_id(zone_id)
    if not zone:
        raise ValueError(f"Unknown zone_id: '{zone_id}'")

    now = store.utcnow()
    # Align to top of next hour
    base_time = now.replace(minute=0, second=0, microsecond=0)

    points: List[ForecastPoint] = []
    for h in range(1, hours + 1):
        target_time = base_time + timedelta(hours=h)
        pt = predict_zone_hour(zone_id, target_time)
        points.append(pt)

    return ForecastResponse(
        zone_id=zone.id,
        zone_name=zone.name,
        generated_at=now,
        horizon_hours=hours,
        points=points,
    )


def get_forecast_pressure(zone_id: str, window_hours: int = 3) -> Dict[str, Any]:
    """Calculate forward-looking crowd pressure (0.0 to 1.0) over next 3 hours for Person C's fusion engine."""
    zone = get_zone_by_id(zone_id)
    if not zone:
        raise ValueError(f"Unknown zone_id: '{zone_id}'")

    now = store.utcnow()
    base_time = now.replace(minute=0, second=0, microsecond=0)

    window_points: List[ForecastPoint] = []
    for h in range(1, window_hours + 1):
        target_time = base_time + timedelta(hours=h)
        window_points.append(predict_zone_hour(zone_id, target_time))

    # Pressure is the max ratio of predicted count to capacity in the window
    max_count = max((pt.predicted_count for pt in window_points), default=0)
    raw_pressure = max_count / max(1, zone.capacity)
    clamped_pressure = round(min(1.0, max(0.0, raw_pressure)), 2)

    # Pick drivers from the point with highest predicted count
    peak_point = max(window_points, key=lambda pt: pt.predicted_count, default=window_points[0])

    return {
        "zone_id": zone.id,
        "pressure": clamped_pressure,
        "window_hours": window_hours,
        "drivers": peak_point.drivers,
    }


def zone_pressure(zone_id: str) -> Tuple[float, List[str]]:
    """Return forward-looking crowd pressure and drivers for Person C's fusion engine.
    Matches the call signature in fusion.py:266.
    """
    res = get_forecast_pressure(zone_id=zone_id, window_hours=3)
    return float(res["pressure"]), list(res["drivers"])


def baseline_ratio_series(zone: Any, timestamps: List[datetime]) -> List[float]:
    """Calculate normal baseline occupancy ratio series with zero event interference.
    Contract for Person C's Event Planner:
    - Normal diurnal pattern across given timestamps (converted to IST).
    - event_active=0, event_attendance_ratio=0, hours_to_event=99.0.
    - Weather from forecast where available, neutral (28C, 0mm) otherwise.
    - Works with trained ML model and pure rule-based fallback when model is absent.
    """
    if isinstance(zone, str):
        zone_obj = get_zone_by_id(zone)
        if not zone_obj:
            zone_obj = Zone(
                id=zone,
                name=f"Zone {zone}",
                capacity=1000,
                area_sqm=1000.0,
                category=VenueCategory.PUBLIC_SQUARE,
                city="Gurugram",
            )
    else:
        zone_obj = zone

    cat_clean = zone_obj.category.lower() if isinstance(zone_obj.category, str) else str(zone_obj.category.value).lower()
    model = load_model()
    ratios: List[float] = []

    for dt in timestamps:
        dt_ist = dt.astimezone(IST) if dt.tzinfo else dt.replace(tzinfo=timezone.utc).astimezone(IST)
        hour = dt_ist.hour
        dow = dt_ist.weekday()
        is_weekend = 1 if dow >= 5 else 0

        # Weather lookup
        try:
            temp_c, rain_mm = event_fetcher.get_weather_for_zone_hour(zone_obj.id, dt)
        except Exception:
            temp_c, rain_mm = 28.0, 0.0

        if model is not None:
            try:
                import pandas as pd
                feat = {
                    "cat_market": 1 if cat_clean == "market" else 0,
                    "cat_transit_hub": 1 if cat_clean == "transit_hub" else 0,
                    "cat_religious_site": 1 if cat_clean == "religious_site" else 0,
                    "cat_campus_ground": 1 if cat_clean == "campus_ground" else 0,
                    "cat_food_street": 1 if cat_clean == "food_street" else 0,
                    "cat_public_square": 1 if cat_clean == "public_square" else 0,
                    "hour": hour,
                    "dow": dow,
                    "is_weekend": is_weekend,
                    "rain": rain_mm,
                    "temp": temp_c,
                    "event_attendance_ratio": 0.0,
                    "hours_to_event": 99.0,
                    "event_active": 0,
                }
                df_feat = pd.DataFrame([feat])[FEATURE_COLS]
                raw_ratio = float(model.predict(df_feat)[0])
                ratios.append(round(max(0.01, min(1.20, raw_ratio)), 4))
                continue
            except Exception as exc:
                logger.warning("ML prediction failed for baseline series: %s. Using rule fallback.", exc)

        # Rule-based fallback
        fb_ratio = rule_based_predict_ratio(
            category=cat_clean,
            target_time=dt_ist,
            overlapping_att=0,
            capacity=zone_obj.capacity,
            hours_to_start=99.0,
            rain_mm=rain_mm,
        )
        ratios.append(round(max(0.01, min(1.20, fb_ratio)), 4))

    return ratios
