"""CrowdGuard Footfall Forecaster & Explainability Engine.

Responsible for:
1. Category-aware feature extraction (one-hot category, IST hour/dow, events, weather).
2. Resilient ML inference using GradientBoostingRegressor predicting occupancy ratio, with pure rule-based fallback.
3. Zone resolution across instrumented zones (z1-z4) and held-out canonical named places.
4. Plain-English driver strings generation for every prediction point.
5. 3-hour crowd pressure calculation for Person C's fusion engine.
6. baseline_ratio_series calculation for Person C's deterministic Event Planner.
"""
from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from zoneinfo import ZoneInfo

import joblib
import numpy as np
import pandas as pd

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

IST = ZoneInfo("Asia/Kolkata")

# Indian national and cultural holidays (month, day)
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

CATEGORIES = [
    "market",
    "transit_hub",
    "religious_site",
    "campus_ground",
    "food_street",
    "public_square",
]

FEATURE_COLUMNS = [
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

# Canonical named places held out from synthetic training
CANONICAL_NAMED_PLACES: Dict[str, Zone] = {
    "ch01": Zone(
        id="ch01",
        name="Chandni Chowk",
        capacity=2500,
        area_sqm=3000.0,
        lat=28.6562,
        lon=77.2309,
        category=VenueCategory.MARKET,
        city="Delhi",
    ),
    "ch02": Zone(
        id="ch02",
        name="Rajiv Chowk Metro",
        capacity=3500,
        area_sqm=2500.0,
        lat=28.6328,
        lon=77.2195,
        category=VenueCategory.TRANSIT_HUB,
        city="Delhi",
    ),
    "ch03": Zone(
        id="ch03",
        name="Lajpat Nagar Central Market",
        capacity=4000,
        area_sqm=4500.0,
        lat=28.5700,
        lon=77.2400,
        category=VenueCategory.MARKET,
        city="Delhi",
    ),
    "ch04": Zone(
        id="ch04",
        name="CP Central Park",
        capacity=2000,
        area_sqm=2500.0,
        lat=28.6315,
        lon=77.2167,
        category=VenueCategory.PUBLIC_SQUARE,
        city="Delhi",
    ),
    "mo03": Zone(
        id="mo03",
        name="DU Arts Faculty Ground",
        capacity=1500,
        area_sqm=2000.0,
        lat=28.6892,
        lon=77.2104,
        category=VenueCategory.CAMPUS_GROUND,
        city="Delhi",
    ),
    "rl01": Zone(
        id="rl01",
        name="Akshardham Complex",
        capacity=4000,
        area_sqm=5000.0,
        lat=28.6127,
        lon=77.2773,
        category=VenueCategory.RELIGIOUS_SITE,
        city="Delhi",
    ),
    "fs01": Zone(
        id="fs01",
        name="Matia Mahal Food Lane",
        capacity=1200,
        area_sqm=1000.0,
        lat=28.6517,
        lon=77.2341,
        category=VenueCategory.FOOD_STREET,
        city="Delhi",
    ),
    "gg01": Zone(
        id="gg01",
        name="Cyber Hub Amphitheatre",
        capacity=2500,
        area_sqm=3000.0,
        lat=28.4950,
        lon=77.0890,
        category=VenueCategory.CAMPUS_GROUND,
        city="Gurugram",
    ),
    "gg02": Zone(
        id="gg02",
        name="Leisure Valley Park Ground",
        capacity=12000,
        area_sqm=15000.0,
        lat=28.4680,
        lon=77.0650,
        category=VenueCategory.PUBLIC_SQUARE,
        city="Gurugram",
    ),
    "gg03": Zone(
        id="gg03",
        name="Sheetla Mata Mandir Complex",
        capacity=7000,
        area_sqm=8000.0,
        lat=28.4720,
        lon=77.0250,
        category=VenueCategory.RELIGIOUS_SITE,
        city="Gurugram",
    ),
}

_cached_model = None
_model_attempted = False


def is_holiday(dt: datetime) -> int:
    return 1 if (dt.month, dt.day) in INDIAN_HOLIDAYS else 0


def get_model_path() -> Path:
    base_dir = Path(__file__).resolve().parent.parent.parent
    return base_dir / "data" / "forecast_model.joblib"


def get_metrics_path() -> Path:
    base_dir = Path(__file__).resolve().parent.parent.parent
    return base_dir / "data" / "model_metrics.json"


def get_feature_columns_path() -> Path:
    base_dir = Path(__file__).resolve().parent.parent.parent
    return base_dir / "data" / "feature_columns.json"


def resolve_zone(zone_id: str) -> Optional[Zone]:
    """Resolve a zone by ID from live instrumented zones or canonical named places."""
    if zone_id in ZONE_BY_ID:
        return ZONE_BY_ID[zone_id]

    try:
        from app.data.named_places import NAMED_PLACES
        for np_zone in NAMED_PLACES:
            if np_zone.id == zone_id:
                return np_zone
    except ImportError:
        pass

    return CANONICAL_NAMED_PLACES.get(zone_id)


def get_all_valid_zone_ids() -> List[str]:
    """Return all known zone IDs across instrumented and canonical named venues."""
    ids = list(ZONE_BY_ID.keys())
    try:
        from app.data.named_places import NAMED_PLACES
        for np_zone in NAMED_PLACES:
            if np_zone.id not in ids:
                ids.append(np_zone.id)
    except ImportError:
        pass

    for cid in CANONICAL_NAMED_PLACES:
        if cid not in ids:
            ids.append(cid)
    return ids


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


def get_zone_category_str(zone: Zone) -> str:
    """Safely extract lowercase category string from a Zone."""
    cat = getattr(zone, "category", "public_square")
    if hasattr(cat, "value"):
        return str(cat.value).lower()
    return str(cat).lower()


def compute_category_baseline_fraction(category: str, hour_ist: int, is_weekend: bool, is_holiday_flag: bool) -> float:
    """Compute baseline occupancy fraction [0.0, 1.0] by venue category."""
    if 1 <= hour_ist <= 5:
        base_frac = 0.03
    elif category == "transit_hub":
        # Calibrated against official DMRC passenger journey data (50.65 Lakh daily journeys peak)
        if not is_weekend:
            if 8 <= hour_ist <= 10:
                base_frac = 0.74
            elif 17 <= hour_ist <= 20:
                base_frac = 0.80
            elif 11 <= hour_ist <= 16:
                base_frac = 0.35
            else:
                base_frac = 0.14
        else:
            base_frac = 0.38 if 11 <= hour_ist <= 20 else 0.15
    elif category == "market":
        if is_weekend:
            base_frac = 0.82 if 16 <= hour_ist <= 22 else (0.45 if 11 <= hour_ist <= 15 else 0.12)
        else:
            base_frac = 0.58 if 17 <= hour_ist <= 21 else (0.28 if 12 <= hour_ist <= 16 else 0.10)
    elif category == "food_street":
        if 12 <= hour_ist <= 14:
            base_frac = 0.76
        elif 19 <= hour_ist <= 22:
            base_frac = 0.84
        elif 15 <= hour_ist <= 18:
            base_frac = 0.22
        else:
            base_frac = 0.07
    elif category == "religious_site":
        if 6 <= hour_ist <= 9:
            base_frac = 0.60 if is_weekend else 0.45
        elif 18 <= hour_ist <= 20:
            base_frac = 0.65 if is_weekend else 0.50
        elif 11 <= hour_ist <= 14:
            base_frac = 0.25
        else:
            base_frac = 0.10
    elif category == "campus_ground":
        if not is_weekend and 9 <= hour_ist <= 17:
            base_frac = 0.15
        else:
            base_frac = 0.04
    else:  # public_square & default
        if 17 <= hour_ist <= 21:
            base_frac = 0.62 if is_weekend else 0.46
        elif 10 <= hour_ist <= 16:
            base_frac = 0.30
        else:
            base_frac = 0.15

    if is_holiday_flag:
        base_frac *= 1.25

    return round(min(1.0, max(0.01, base_frac)), 4)


def rule_based_predict(
    zone_or_id: Union[Zone, str],
    target_time: datetime,
    overlapping_att: int = 0,
    hours_to_start: float = 99.0,
    rain_mm: float = 0.0,
) -> int:
    """Fallback rule-based footfall estimator if ML model is unavailable."""
    if isinstance(zone_or_id, str):
        zone = resolve_zone(zone_or_id)
        if not zone:
            zone = Zone(id=zone_or_id, name=zone_or_id, capacity=500, area_sqm=500.0, lat=28.5, lon=77.1)
    else:
        zone = zone_or_id

    capacity = zone.capacity
    cat_str = get_zone_category_str(zone)

    # Calculate IST time components
    dt_ist = target_time.astimezone(IST) if target_time.tzinfo else target_time.replace(tzinfo=timezone.utc).astimezone(IST)
    hour = dt_ist.hour
    is_weekend = dt_ist.weekday() >= 5
    holiday = bool(is_holiday(dt_ist))

    base_frac = compute_category_baseline_fraction(cat_str, hour, is_weekend, holiday)

    event_bump = 0.0
    if hours_to_start <= 1.0:
        event_bump += 0.25 * (overlapping_att if overlapping_att > 0 else 400)
    if overlapping_att > 0:
        event_bump += min(capacity * 0.85, overlapping_att * 0.35)

    predicted_count = (base_frac * capacity) + event_bump
    if rain_mm > 0:
        suppress = 0.55 if cat_str in ("market", "public_square", "campus_ground", "food_street") else 0.75
        predicted_count *= suppress

    return max(0, int(round(predicted_count)))


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
    dt_ist = target_time.astimezone(IST) if target_time.tzinfo else target_time.replace(tzinfo=timezone.utc).astimezone(IST)
    day_name = WEEKDAY_NAMES[dt_ist.weekday()]
    hour = dt_ist.hour
    is_weekend = dt_ist.weekday() >= 5
    holiday = is_holiday(dt_ist)
    cat_str = get_zone_category_str(zone)

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

    # 4. Diurnal / Category pattern
    if 1 <= hour <= 5:
        drivers.append("overnight low")
    elif cat_str == "transit_hub" and not is_weekend and (8 <= hour <= 10 or 17 <= hour <= 20):
        drivers.append(f"{day_name} commuter transit rush")
    elif cat_str == "market" and is_weekend and (17 <= hour <= 22):
        drivers.append(f"{day_name} evening market rush")
    elif cat_str == "food_street" and (12 <= hour <= 14):
        drivers.append("lunch hour peak")
    elif cat_str == "food_street" and (19 <= hour <= 21):
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

    return drivers[:4]


def predict_zone_hour(zone_or_id: Union[str, Zone], target_time: datetime) -> ForecastPoint:
    """Predict footfall, density, risk tier, and drivers for a specific zone and hour."""
    if isinstance(zone_or_id, str):
        zone = resolve_zone(zone_or_id)
        if not zone:
            raise ValueError(f"Unknown zone_id: '{zone_or_id}'")
    else:
        zone = zone_or_id

    all_events = event_fetcher.ensure_events_loaded()
    temp_c, rain_mm = event_fetcher.get_weather_for_zone_hour(zone.id, target_time)

    # Overlapping & upcoming events for this zone
    overlapping_events = []
    upcoming_events = []
    overlapping_att = 0
    hours_to_start = 99.0

    for ev in all_events:
        if ev.zone_id == zone.id:
            end_time = ev.end_time or (ev.start_time + timedelta(hours=3))
            if ev.start_time <= target_time < end_time:
                overlapping_events.append(ev)
                overlapping_att += ev.expected_attendance
            elif target_time < ev.start_time:
                upcoming_events.append(ev)
                diff_h = (ev.start_time - target_time).total_seconds() / 3600.0
                if diff_h < hours_to_start:
                    hours_to_start = diff_h

    event_att_ratio = min(2.0, overlapping_att / max(1, zone.capacity))
    hours_to_event = min(99.0, hours_to_start)
    event_active = 1 if overlapping_att > 0 else 0

    # Calculate IST features
    dt_ist = target_time.astimezone(IST) if target_time.tzinfo else target_time.replace(tzinfo=timezone.utc).astimezone(IST)
    hour = dt_ist.hour
    dow = dt_ist.weekday()
    is_weekend = 1 if dow >= 5 else 0
    cat_str = get_zone_category_str(zone)

    model = load_model()
    predicted_count = None

    if model is not None:
        try:
            # Build 14-feature row matching trained model schema
            feature_dict = {
                "cat_market": 1 if cat_str == "market" else 0,
                "cat_transit_hub": 1 if cat_str == "transit_hub" else 0,
                "cat_religious_site": 1 if cat_str == "religious_site" else 0,
                "cat_campus_ground": 1 if cat_str == "campus_ground" else 0,
                "cat_food_street": 1 if cat_str == "food_street" else 0,
                "cat_public_square": 1 if cat_str == "public_square" else 0,
                "hour": hour,
                "dow": dow,
                "is_weekend": is_weekend,
                "rain": rain_mm,
                "temp": temp_c,
                "event_attendance_ratio": event_att_ratio,
                "hours_to_event": hours_to_event,
                "event_active": event_active,
            }
            features_df = pd.DataFrame([feature_dict])[FEATURE_COLUMNS]
            pred_ratio = max(0.0, float(model.predict(features_df)[0]))
            predicted_count = max(0, int(round(pred_ratio * zone.capacity)))
        except Exception as exc:
            logger.warning("ML prediction failed for zone %s: %s. Using rule-based fallback.", zone.id, exc)
            predicted_count = None

    if predicted_count is None:
        predicted_count = rule_based_predict(zone, target_time, overlapping_att, hours_to_start, rain_mm)

    predicted_density = round(predicted_count / max(1.0, zone.area_sqm), 3)

    # Risk tier evaluation based on capacity pressure and density
    cap_ratio = predicted_count / max(1, zone.capacity)
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
    zone = resolve_zone(zone_id)
    if not zone:
        raise ValueError(f"Unknown zone_id: '{zone_id}'")

    now = store.utcnow()
    base_time = now.replace(minute=0, second=0, microsecond=0)

    points: List[ForecastPoint] = []
    for h in range(1, hours + 1):
        target_time = base_time + timedelta(hours=h)
        pt = predict_zone_hour(zone, target_time)
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
    zone = resolve_zone(zone_id)
    if not zone:
        raise ValueError(f"Unknown zone_id: '{zone_id}'")

    now = store.utcnow()
    base_time = now.replace(minute=0, second=0, microsecond=0)

    window_points: List[ForecastPoint] = []
    for h in range(1, window_hours + 1):
        target_time = base_time + timedelta(hours=h)
        window_points.append(predict_zone_hour(zone, target_time))

    max_count = max((pt.predicted_count for pt in window_points), default=0)
    raw_pressure = max_count / max(1, zone.capacity)
    clamped_pressure = round(min(1.0, max(0.0, raw_pressure)), 2)

    peak_point = max(window_points, key=lambda pt: pt.predicted_count, default=window_points[0])

    return {
        "zone_id": zone.id,
        "pressure": clamped_pressure,
        "window_hours": window_hours,
        "drivers": peak_point.drivers,
    }


def baseline_ratio_series(zone: Zone, timestamps: List[datetime]) -> List[float]:
    """Return the baseline occupancy ratio series [0.0, 1.0] across given timestamps with no special events.
    
    This fulfills the cross-team contract required by Person C's Event Planner.
    Works with both the trained ML category model and the rule-based fallback.
    """
    model = load_model()
    cat_str = get_zone_category_str(zone)
    ratios: List[float] = []

    for ts in timestamps:
        # Convert any timezone-aware datetime to IST; naive datetimes assume IST
        if ts.tzinfo is None:
            ts_ist = ts.replace(tzinfo=IST)
        else:
            ts_ist = ts.astimezone(IST)

        hour = ts_ist.hour
        dow = ts_ist.weekday()
        is_weekend = 1 if dow >= 5 else 0
        holiday = bool(is_holiday(ts_ist))

        # Weather: neutral defaults (28°C, 0mm rain) unless zone forecast exists
        temp_c, rain_mm = 28.0, 0.0
        try:
            temp_c, rain_mm = event_fetcher.get_weather_for_zone_hour(zone.id, ts)
        except Exception:
            pass

        ratio: Optional[float] = None
        if model is not None:
            try:
                feature_dict = {
                    "cat_market": 1 if cat_str == "market" else 0,
                    "cat_transit_hub": 1 if cat_str == "transit_hub" else 0,
                    "cat_religious_site": 1 if cat_str == "religious_site" else 0,
                    "cat_campus_ground": 1 if cat_str == "campus_ground" else 0,
                    "cat_food_street": 1 if cat_str == "food_street" else 0,
                    "cat_public_square": 1 if cat_str == "public_square" else 0,
                    "hour": hour,
                    "dow": dow,
                    "is_weekend": is_weekend,
                    "rain": rain_mm,
                    "temp": temp_c,
                    "event_attendance_ratio": 0.0,
                    "hours_to_event": 99.0,
                    "event_active": 0,
                }
                features_df = pd.DataFrame([feature_dict])[FEATURE_COLUMNS]
                pred = float(model.predict(features_df)[0])
                ratio = round(max(0.01, min(1.0, pred)), 4)
            except Exception as exc:
                logger.debug("Baseline series model predict error: %s. Using rule-based fallback.", exc)
                ratio = None

        if ratio is None:
            base_frac = compute_category_baseline_fraction(cat_str, hour, bool(is_weekend), holiday)
            if rain_mm > 0:
                suppress = 0.55 if cat_str in ("market", "public_square", "campus_ground", "food_street") else 0.75
                base_frac *= suppress
            ratio = round(max(0.01, min(1.0, base_frac)), 4)

        ratios.append(ratio)

    return ratios
