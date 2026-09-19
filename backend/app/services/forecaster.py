"""CrowdGuard Footfall Forecaster & Explainability Engine.

Responsible for:
1. Feature extraction for future hours (sin/cos hour, day of week, events, weather).
2. Resilient ML inference using GradientBoostingRegressor with pure rule-based fallback.
3. Plain-English driver strings generation for every prediction point.
4. 3-hour crowd pressure calculation for integration with Person C's fusion engine.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np

from app.schemas.shared import (
    ZONE_BY_ID,
    ForecastPoint,
    ForecastResponse,
    RiskTier,
    tier_from_score,
)
from app.services import event_fetcher, store

logger = logging.getLogger("crowdguard.forecaster")

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

_cached_model = None
_model_attempted = False
_model_mae: Optional[float] = None


def is_holiday(dt: datetime) -> int:
    return 1 if (dt.month, dt.day) in INDIAN_HOLIDAYS else 0


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


def rule_based_predict(
    zone_id: str,
    target_time: datetime,
    overlapping_att: int,
    hours_to_start: float,
    rain_mm: float,
) -> int:
    """Fallback rule-based footfall estimator if ML model is unavailable."""
    zone = ZONE_BY_ID[zone_id]
    capacity = zone.capacity
    hour = target_time.hour
    is_weekend = target_time.weekday() >= 5
    holiday = is_holiday(target_time)

    # Near-zero overnight
    if 1 <= hour <= 5:
        base_frac = 0.04
    elif zone_id == "z2":
        # Metro
        if not is_weekend:
            if 8 <= hour <= 10:
                base_frac = 0.72
            elif 17 <= hour <= 20:
                base_frac = 0.78
            elif 11 <= hour <= 16:
                base_frac = 0.35
            else:
                base_frac = 0.16
        else:
            base_frac = 0.42 if 12 <= hour <= 21 else 0.18
    elif zone_id == "z3":
        # Market Street
        if is_weekend:
            base_frac = 0.82 if 16 <= hour <= 22 else (0.45 if 11 <= hour <= 15 else 0.12)
        else:
            base_frac = 0.58 if 17 <= hour <= 21 else (0.28 if 12 <= hour <= 16 else 0.10)
    elif zone_id == "z4":
        # Food Court
        if 12 <= hour <= 14:
            base_frac = 0.78
        elif 19 <= hour <= 21:
            base_frac = 0.82
        elif 15 <= hour <= 18:
            base_frac = 0.22
        else:
            base_frac = 0.06
    else:
        # z1: Main Gate Plaza
        base_frac = 0.55 if 9 <= hour <= 19 else 0.20

    if holiday:
        base_frac *= 1.25

    event_bump = 0.0
    if hours_to_start <= 1.0:
        event_bump += 0.25 * (overlapping_att if overlapping_att > 0 else 400)
    if overlapping_att > 0:
        event_bump += min(capacity * 0.85, overlapping_att * 0.35)

    predicted_count = (base_frac * capacity) + event_bump
    if rain_mm > 0:
        suppress = 0.55 if zone_id in ("z1", "z3") else 0.75
        predicted_count *= suppress

    return max(0, int(round(predicted_count)))


def generate_drivers(
    zone_id: str,
    target_time: datetime,
    overlapping_events: List[Any],
    upcoming_events: List[Any],
    rain_mm: float,
    predicted_count: int,
) -> List[str]:
    """Assemble plain-English driver strings explaining why a crowd is predicted."""
    drivers: List[str] = []
    day_name = WEEKDAY_NAMES[target_time.weekday()]
    hour = target_time.hour
    is_weekend = target_time.weekday() >= 5
    holiday = is_holiday(target_time)

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

    # 4. Diurnal / Time-of-day pattern
    if 1 <= hour <= 5:
        drivers.append("overnight low")
    elif zone_id == "z2" and not is_weekend and (8 <= hour <= 10 or 17 <= hour <= 20):
        drivers.append(f"{day_name} commuter transit rush")
    elif zone_id == "z3" and is_weekend and (17 <= hour <= 22):
        drivers.append(f"{day_name} evening market rush")
    elif zone_id == "z4" and (12 <= hour <= 14):
        drivers.append("lunch hour peak")
    elif zone_id == "z4" and (19 <= hour <= 21):
        drivers.append("dinner rush")
    elif 17 <= hour <= 21:
        drivers.append(f"{day_name} evening peak")
    elif 12 <= hour <= 16:
        drivers.append(f"{day_name} afternoon baseline")
    else:
        drivers.append(f"{day_name} baseline")

    # 5. Public holiday
    if holiday:
        drivers.append("public holiday")

    # Return up to 4 prioritized drivers
    return drivers[:4]


def predict_zone_hour(zone_id: str, target_time: datetime) -> ForecastPoint:
    """Predict footfall, density, risk tier, and drivers for a specific zone and hour."""
    zone = ZONE_BY_ID[zone_id]
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

    event_count = len(overlapping_events)

    # Feature vector
    sin_hour = math.sin(2 * math.pi * target_time.hour / 24)
    cos_hour = math.cos(2 * math.pi * target_time.hour / 24)
    day_of_week = target_time.weekday()
    is_weekend = 1 if day_of_week >= 5 else 0
    holiday = is_holiday(target_time)

    model = load_model()
    if model is not None:
        try:
            import pandas as pd
            features_df = pd.DataFrame([{
                "sin_hour": sin_hour,
                "cos_hour": cos_hour,
                "day_of_week": day_of_week,
                "is_weekend": is_weekend,
                "is_holiday": holiday,
                "zone_capacity": zone.capacity,
                "zone_area": zone.area_sqm,
                "event_attendance_sum": overlapping_att,
                "event_count": event_count,
                "hours_to_event_start": min(99.0, hours_to_start),
                "temp_c": temp_c,
                "rain_mm": rain_mm,
            }])
            raw_pred = model.predict(features_df)[0]
            predicted_count = max(0, int(round(raw_pred)))
        except Exception as exc:
            logger.warning("ML prediction failed: %s. Falling back to rule-based.", exc)
            predicted_count = rule_based_predict(zone_id, target_time, overlapping_att, hours_to_start, rain_mm)
    else:
        predicted_count = rule_based_predict(zone_id, target_time, overlapping_att, hours_to_start, rain_mm)

    predicted_density = round(predicted_count / zone.area_sqm, 3)

    # Risk tier evaluation based on capacity pressure and density
    cap_ratio = predicted_count / zone.capacity
    density_ratio = predicted_density / 2.0  # 2.0 people / sqm is critical density
    risk_score = min(1.0, max(cap_ratio, density_ratio))
    tier = tier_from_score(risk_score)

    drivers = generate_drivers(
        zone_id=zone_id,
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
    if zone_id not in ZONE_BY_ID:
        raise ValueError(f"Unknown zone_id: '{zone_id}'")

    zone = ZONE_BY_ID[zone_id]
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
    if zone_id not in ZONE_BY_ID:
        raise ValueError(f"Unknown zone_id: '{zone_id}'")

    zone = ZONE_BY_ID[zone_id]
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
