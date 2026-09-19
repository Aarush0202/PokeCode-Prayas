"""Synthetic footfall generator and model trainer for CrowdGuard.

Generates 90 days of realistic synthetic hourly footfall data across 4 zones,
accounting for diurnal patterns, transit surges, weekend market crowds,
lunch/dinner rushes, event lead-in & attendance bumps, and rain suppression.

Outputs:
1. backend/data/footfall_train.csv
2. backend/data/forecast_model.joblib
"""
from __future__ import annotations

import math
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split

# Hardcoded Indian holidays / festival dates (month, day)
INDIAN_HOLIDAYS = {
    (1, 26),  # Republic Day
    (3, 25),  # Holi
    (8, 15),  # Independence Day
    (10, 2),  # Gandhi Jayanti
    (10, 24), # Dussehra
    (11, 12), # Diwali
    (12, 25), # Christmas
}

ZONES_DATA = {
    "z1": {"name": "Main Gate Plaza", "capacity": 400, "area_sqm": 500.0, "base_scale": 0.35},
    "z2": {"name": "Metro Concourse", "capacity": 600, "area_sqm": 450.0, "base_scale": 0.45},
    "z3": {"name": "Market Street", "capacity": 900, "area_sqm": 1200.0, "base_scale": 0.40},
    "z4": {"name": "Food Court", "capacity": 300, "area_sqm": 350.0, "base_scale": 0.30},
}

FEATURE_COLS = [
    "sin_hour",
    "cos_hour",
    "day_of_week",
    "is_weekend",
    "is_holiday",
    "zone_capacity",
    "zone_area",
    "event_attendance_sum",
    "event_count",
    "hours_to_event_start",
    "temp_c",
    "rain_mm",
]


def is_holiday(dt: datetime) -> int:
    return 1 if (dt.month, dt.day) in INDIAN_HOLIDAYS else 0


def generate_baseline_shape(zone_id: str, hour: int, is_weekend: bool) -> float:
    """Return a baseline capacity fraction (0.0 to 1.0) based on zone patterns."""
    # Near-zero overnight
    if 1 <= hour <= 5:
        return 0.02 + random.uniform(0.0, 0.03)

    if zone_id == "z2":
        # Metro Concourse: heavy morning (8-10) and evening (17-20) commute peaks
        if not is_weekend:
            if 8 <= hour <= 10:
                return 0.70 + 0.15 * math.sin((hour - 8) / 2 * math.pi)
            elif 17 <= hour <= 20:
                return 0.75 + 0.15 * math.sin((hour - 17) / 3 * math.pi)
            elif 11 <= hour <= 16:
                return 0.35 + random.uniform(-0.05, 0.05)
            else:
                return 0.15
        else:
            # Weekend metro is more spread out in the afternoon
            if 12 <= hour <= 21:
                return 0.40 + 0.10 * math.sin((hour - 12) / 9 * math.pi)
            return 0.15

    elif zone_id == "z3":
        # Market Street: heavy evening traffic, massive on weekends
        if is_weekend:
            if 16 <= hour <= 22:
                return 0.80 + 0.12 * math.sin((hour - 16) / 6 * math.pi)
            elif 11 <= hour <= 15:
                return 0.45 + random.uniform(-0.05, 0.05)
            else:
                return 0.10
        else:
            if 17 <= hour <= 21:
                return 0.55 + 0.10 * math.sin((hour - 17) / 4 * math.pi)
            elif 12 <= hour <= 16:
                return 0.25 + random.uniform(-0.05, 0.05)
            else:
                return 0.08

    elif zone_id == "z4":
        # Food Court: sharp lunch (12-14) and dinner (19-21) spikes
        if 12 <= hour <= 14:
            return 0.75 + 0.10 * math.sin((hour - 12) / 2 * math.pi)
        elif 19 <= hour <= 21:
            return 0.80 + 0.10 * math.sin((hour - 19) / 2 * math.pi)
        elif 15 <= hour <= 18:
            return 0.20 + random.uniform(0.0, 0.08)
        else:
            return 0.05

    else:
        # z1: Main Gate Plaza: steady inflow during day, moderate evening peak
        if 9 <= hour <= 19:
            peak = 0.50 if not is_weekend else 0.65
            return peak + 0.15 * math.sin((hour - 9) / 10 * math.pi)
        elif 20 <= hour <= 23:
            return 0.25
        else:
            return 0.05


def generate_synthetic_dataset(days: int = 90) -> pd.DataFrame:
    """Generate 90 days x 24h x 4 zones synthetic rows."""
    random.seed(42)
    np.random.seed(42)

    start_date = datetime(2026, 6, 1, 0, 0, 0, tzinfo=timezone.utc)
    rows = []

    # Synthetic event pool generator
    # Scatter events across the 90 days
    scheduled_events = []
    total_hours = days * 24
    for _ in range(int(days * 2.5)):  # ~225 events over 90 days
        event_hour_offset = random.randint(10, total_hours - 10)
        event_start = start_date + timedelta(hours=event_hour_offset)
        duration = random.choice([2, 3, 4, 5])
        zone_id = random.choice(list(ZONES_DATA.keys()))
        attendance = random.randint(200, 1500)
        scheduled_events.append({
            "start": event_start,
            "end": event_start + timedelta(hours=duration),
            "zone_id": zone_id,
            "attendance": attendance,
        })

    for h_offset in range(total_hours):
        current_dt = start_date + timedelta(hours=h_offset)
        hour = current_dt.hour
        day_of_week = current_dt.weekday()
        weekend = 1 if day_of_week >= 5 else 0
        holiday = is_holiday(current_dt)

        # Weather simulation: diurnal temp curve + occasional rain
        base_temp = 28.0 + 8.0 * math.sin((hour - 9) / 24 * 2 * math.pi) + random.uniform(-2, 2)
        # 10% chance of rain, heavy rain reduces footfall
        is_raining = random.random() < 0.12
        rain_mm = round(random.uniform(2.0, 25.0), 1) if is_raining else 0.0

        sin_hour = math.sin(2 * math.pi * hour / 24)
        cos_hour = math.cos(2 * math.pi * hour / 24)

        for zone_id, zmeta in ZONES_DATA.items():
            capacity = zmeta["capacity"]
            area = zmeta["area_sqm"]

            # Events for this zone
            overlapping_att = 0
            event_count = 0
            hours_to_start = 99.0

            for ev in scheduled_events:
                if ev["zone_id"] == zone_id:
                    if ev["start"] <= current_dt < ev["end"]:
                        overlapping_att += ev["attendance"]
                        event_count += 1
                    elif current_dt < ev["start"]:
                        diff_h = (ev["start"] - current_dt).total_seconds() / 3600.0
                        if diff_h < hours_to_start:
                            hours_to_start = diff_h

            # Base capacity fraction
            base_frac = generate_baseline_shape(zone_id, hour, bool(weekend))

            # Holiday bonus
            if holiday:
                base_frac *= 1.25

            # Event bump: arrival lead-in (1h before) and during event
            event_bump = 0.0
            if hours_to_start <= 1.0:
                # Arrival surge
                event_bump += 0.25 * (overlapping_att if overlapping_att > 0 else 400)
            if overlapping_att > 0:
                # During event: proportion enters the zone based on zone capacity
                event_bump += min(capacity * 0.8, overlapping_att * 0.35)

            predicted_count = (base_frac * capacity) + event_bump

            # Rain suppression (suppresses outdoor zones z1, z3 more than covered z2, z4)
            if rain_mm > 0:
                suppress_factor = 0.55 if zone_id in ("z1", "z3") else 0.75
                predicted_count *= suppress_factor

            # Add gaussian noise
            noise = np.random.normal(0, max(2.0, capacity * 0.03))
            final_count = max(0, int(round(predicted_count + noise)))

            rows.append({
                "timestamp": current_dt.isoformat(),
                "zone_id": zone_id,
                "hour": hour,
                "sin_hour": sin_hour,
                "cos_hour": cos_hour,
                "day_of_week": day_of_week,
                "is_weekend": weekend,
                "is_holiday": holiday,
                "zone_capacity": capacity,
                "zone_area": area,
                "event_attendance_sum": overlapping_att,
                "event_count": event_count,
                "hours_to_event_start": min(99.0, hours_to_start),
                "temp_c": round(base_temp, 1),
                "rain_mm": rain_mm,
                "footfall": final_count,
            })

    df = pd.DataFrame(rows)
    return df


def train_and_save_model(df: pd.DataFrame, output_dir: Path) -> float:
    """Train GradientBoostingRegressor and save model artifact."""
    X = df[FEATURE_COLS]
    y = df["footfall"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42)

    model = GradientBoostingRegressor(
        n_estimators=120,
        max_depth=5,
        learning_rate=0.08,
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    print(f"Model Training Complete. MAE on held-out test data: {mae:.2f} people/hour")

    model_path = output_dir / "forecast_model.joblib"
    joblib.dump(model, model_path)
    print(f"Saved model to: {model_path}")
    return float(mae)


def main():
    root_dir = Path(__file__).resolve().parent.parent
    data_dir = root_dir / "backend" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    print("Generating synthetic footfall dataset (90 days x 24 hours x 4 zones)...")
    df = generate_synthetic_dataset(days=90)
    csv_path = data_dir / "footfall_train.csv"
    df.to_csv(csv_path, index=False)
    print(f"Saved dataset ({len(df)} rows) to: {csv_path}")

    mae = train_and_save_model(df, data_dir)
    print(f"SUCCESS: Dataset & model created with MAE: {mae:.2f}")


if __name__ == "__main__":
    main()
