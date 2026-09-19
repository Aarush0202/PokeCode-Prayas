"""Synthetic footfall generator and model trainer for CrowdGuard (Person B).

Generates 60 days of realistic synthetic hourly footfall data across ~100 synthetic venues
categorized into 6 distinct venue types, accounting for:
- Category diurnal and weekend footfall signatures
- Per-venue jitter (capacity, amplitude, peak-hour phase shifts ±1h, noise)
- Weather suppression (rain)
- Scheduled events (lead-in arrival surge, duration peak, decay)
- Occupancy ratio target (footfall / capacity) with zero leakage of place_id/city/lat/lon/capacity.

Outputs:
1. backend/data/footfall_train.csv (~100 synthetic venues)
2. backend/data/footfall_heldout.csv (z1-z4 + named places)
3. backend/data/forecast_model.joblib (trained model)
4. backend/data/model_features.json (ordered feature names)
5. backend/data/model_metrics.json (held-out MAE by category, baselines, ablation)
6. docs/forecast_mae_by_category.png (evaluation plot for pitch deck)
"""
from __future__ import annotations

import json
import math
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple
from zoneinfo import ZoneInfo

import joblib
import numpy as np
import pandas as pd
from PIL import Image, ImageDraw
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import GroupKFold

# Fixed IST timezone
IST = ZoneInfo("Asia/Kolkata")

# 6 Venue Categories defined in app.schemas.shared.VenueCategory
CATEGORIES = [
    "market",
    "transit_hub",
    "religious_site",
    "campus_ground",
    "food_street",
    "public_square",
]

# Capacity ranges per category (from brief P0-1)
CATEGORY_CAPACITY_RANGES: Dict[str, Tuple[int, int]] = {
    "market": (800, 3000),
    "transit_hub": (800, 2500),
    "religious_site": (500, 4000),
    "campus_ground": (2000, 8000),
    "food_street": (200, 1200),
    "public_square": (500, 3500),
}

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

# Feature columns used for ML (Category one-hot + time/weather/event signals)
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


def is_holiday(dt: datetime) -> int:
    return 1 if (dt.month, dt.day) in INDIAN_HOLIDAYS else 0


def generate_venue_baseline_shape(category: str, hour: int, is_weekend: bool, phase_shift: int = 0) -> float:
    """Calculate base diurnal occupancy ratio (0.0 to 1.0) with category signatures and phase shift."""
    # Apply phase shift to hour (wrapping around 24 hours)
    effective_hour = (hour - phase_shift) % 24

    if category == "market":
        # Rises through afternoon/evening (16:00 to 22:00 peak); Fri-Sun significantly higher
        if 1 <= effective_hour <= 6:
            return 0.03
        if is_weekend:
            if 16 <= effective_hour <= 22:
                return 0.78 + 0.12 * math.sin((effective_hour - 16) / 6 * math.pi)
            elif 11 <= effective_hour <= 15:
                return 0.45 + 0.10 * math.sin((effective_hour - 11) / 4 * math.pi)
            else:
                return 0.12
        else:
            if 17 <= effective_hour <= 21:
                return 0.55 + 0.10 * math.sin((effective_hour - 17) / 4 * math.pi)
            elif 12 <= effective_hour <= 16:
                return 0.28 + 0.08 * math.sin((effective_hour - 12) / 4 * math.pi)
            else:
                return 0.08

    elif category == "transit_hub":
        # Double peak: morning commute (8-10) and evening commute (17-20); low overnight
        if 1 <= effective_hour <= 5:
            return 0.02
        if not is_weekend:
            if 8 <= effective_hour <= 10:
                return 0.82 + 0.10 * math.sin((effective_hour - 8) / 2 * math.pi)
            elif 17 <= effective_hour <= 20:
                return 0.85 + 0.10 * math.sin((effective_hour - 17) / 3 * math.pi)
            elif 11 <= effective_hour <= 16:
                return 0.38 + 0.05 * math.sin((effective_hour - 11) / 5 * math.pi)
            else:
                return 0.15
        else:
            if 12 <= effective_hour <= 20:
                return 0.42 + 0.08 * math.sin((effective_hour - 12) / 8 * math.pi)
            return 0.14

    elif category == "religious_site":
        # Low baseline, morning prayer (6-8) & evening prayer/aarti (18-20); weekend evening boost
        if 0 <= effective_hour <= 4:
            return 0.01
        if 6 <= effective_hour <= 8:
            return 0.40 + 0.08 * math.sin((effective_hour - 6) / 2 * math.pi)
        elif 18 <= effective_hour <= 20:
            boost = 0.55 if is_weekend else 0.42
            return boost + 0.10 * math.sin((effective_hour - 18) / 2 * math.pi)
        elif 9 <= effective_hour <= 17:
            return 0.18 + (0.08 if is_weekend else 0.0)
        else:
            return 0.06

    elif category == "campus_ground":
        # Near zero baseline except during scheduled events
        if 8 <= effective_hour <= 18:
            return 0.08 + (0.05 if not is_weekend else 0.02)
        return 0.02

    elif category == "food_street":
        # Sharp lunch (12-14) and dinner (19-22) spikes; low overnight
        if 1 <= effective_hour <= 10:
            return 0.02
        if 12 <= effective_hour <= 14:
            return 0.72 + 0.10 * math.sin((effective_hour - 12) / 2 * math.pi)
        elif 19 <= effective_hour <= 22:
            boost = 0.82 if is_weekend else 0.75
            return boost + 0.10 * math.sin((effective_hour - 19) / 3 * math.pi)
        elif 15 <= effective_hour <= 18:
            return 0.18 + 0.04 * math.sin((effective_hour - 15) / 3 * math.pi)
        else:
            return 0.06

    else:  # public_square
        # Moderate and relatively flat during daytime with mild evening rise (17-21)
        if 1 <= effective_hour <= 6:
            return 0.03
        if 17 <= effective_hour <= 21:
            boost = 0.60 if is_weekend else 0.50
            return boost + 0.08 * math.sin((effective_hour - 17) / 4 * math.pi)
        elif 10 <= effective_hour <= 16:
            return 0.35 + 0.05 * math.sin((effective_hour - 10) / 6 * math.pi)
        else:
            return 0.12


def create_synthetic_venue_specs(num_venues: int = 100) -> List[Dict[str, Any]]:
    """Generate metadata for ~100 synthetic venues evenly distributed across 6 categories."""
    specs = []
    cities = ["Gurugram", "Delhi", "Noida", "Faridabad", "Ghaziabad"]

    # Evenly distribute 100 venues across 6 categories: 4 categories get 17, 2 get 16
    cat_distribution = []
    for i, cat in enumerate(CATEGORIES):
        count = 17 if i < 4 else 16
        cat_distribution.extend([cat] * count)

    random.seed(42)
    for idx, category in enumerate(cat_distribution, start=1):
        place_id = f"syn{idx:03d}"
        cap_min, cap_max = CATEGORY_CAPACITY_RANGES[category]
        capacity = int(round(random.randint(cap_min, cap_max) / 50) * 50)
        city = random.choice(cities)
        amp_jitter = round(random.uniform(0.90, 1.10), 3)
        phase_shift = random.choice([-1, 0, 1])

        specs.append({
            "place_id": place_id,
            "category": category,
            "city": city,
            "capacity": capacity,
            "amp_jitter": amp_jitter,
            "phase_shift": phase_shift,
        })
    return specs


def get_heldout_venue_specs() -> List[Dict[str, Any]]:
    """Return the held-out venues: z1-z4 and NAMED_PLACES."""
    heldout = [
        {"place_id": "z1", "category": "public_square", "city": "Gurugram", "capacity": 400, "amp_jitter": 1.0, "phase_shift": 0},
        {"place_id": "z2", "category": "transit_hub", "city": "Gurugram", "capacity": 600, "amp_jitter": 1.0, "phase_shift": 0},
        {"place_id": "z3", "category": "market", "city": "Gurugram", "capacity": 900, "amp_jitter": 1.0, "phase_shift": 0},
        {"place_id": "z4", "category": "food_street", "city": "Gurugram", "capacity": 300, "amp_jitter": 1.0, "phase_shift": 0},
        {"place_id": "ch01", "category": "market", "city": "Delhi", "capacity": 5000, "amp_jitter": 1.02, "phase_shift": 0},
        {"place_id": "ch02", "category": "public_square", "city": "Delhi", "capacity": 8000, "amp_jitter": 1.01, "phase_shift": 0},
        {"place_id": "ch03", "category": "market", "city": "Delhi", "capacity": 4000, "amp_jitter": 0.98, "phase_shift": 0},
        {"place_id": "gg01", "category": "campus_ground", "city": "Gurugram", "capacity": 2500, "amp_jitter": 1.05, "phase_shift": 0},
        {"place_id": "gg02", "category": "public_square", "city": "Gurugram", "capacity": 12000, "amp_jitter": 0.99, "phase_shift": 0},
        {"place_id": "gg03", "category": "religious_site", "city": "Gurugram", "capacity": 7000, "amp_jitter": 1.03, "phase_shift": 0},
    ]
    return heldout


def generate_venue_events(venues: List[Dict[str, Any]], start_dt: datetime, total_hours: int, seed: int = 42) -> List[Dict[str, Any]]:
    """Generate realistic scheduled events across the timeline for given venues."""
    random.seed(seed)
    scheduled_events = []
    
    # Generate ~2-4 events per venue over 60 days
    total_events = len(venues) * 3
    for _ in range(total_events):
        offset_h = random.randint(12, total_hours - 12)
        event_start = start_dt + timedelta(hours=offset_h)
        duration = random.choice([2, 3, 4, 5])
        venue = random.choice(venues)
        
        # Campus grounds get larger relative attendance; others get 30% to 110% of capacity
        if venue["category"] == "campus_ground":
            att_ratio = round(random.uniform(0.40, 1.20), 2)
        elif venue["category"] == "religious_site":
            att_ratio = round(random.uniform(0.50, 1.30), 2)
        else:
            att_ratio = round(random.uniform(0.25, 0.85), 2)

        scheduled_events.append({
            "place_id": venue["place_id"],
            "start": event_start,
            "end": event_start + timedelta(hours=duration),
            "att_ratio": att_ratio,
        })
    return scheduled_events


def generate_dataset_for_venues(venues: List[Dict[str, Any]], days: int = 60, seed: int = 42) -> pd.DataFrame:
    """Generate 60 days x 24h of synthetic rows for the given venues in IST."""
    random.seed(seed)
    np.random.seed(seed)

    # Start date in IST
    start_dt = datetime(2026, 7, 1, 0, 0, 0, tzinfo=IST)
    total_hours = days * 24

    events = generate_venue_events(venues, start_dt, total_hours, seed=seed)

    rows = []
    for h in range(total_hours):
        current_dt = start_dt + timedelta(hours=h)
        hour = current_dt.hour
        dow = current_dt.weekday()
        is_weekend = 1 if dow >= 5 else 0
        holiday = is_holiday(current_dt)

        # Weather in IST: diurnal temperature + rain probability (monsoon season in July/Aug)
        base_temp = 30.0 + 6.0 * math.sin((hour - 9) / 24 * 2 * math.pi) + random.uniform(-1.5, 1.5)
        # 14% rain probability in July/August
        is_raining = random.random() < 0.14
        rain_mm = round(random.uniform(3.0, 30.0), 1) if is_raining else 0.0

        for v in venues:
            place_id = v["place_id"]
            category = v["category"]
            city = v["city"]
            capacity = v["capacity"]
            amp_jitter = v["amp_jitter"]
            phase_shift = v["phase_shift"]

            # Baseline ratio from diurnal pattern
            base_ratio = generate_venue_baseline_shape(category, hour, bool(is_weekend), phase_shift)
            base_ratio *= amp_jitter

            # Religious site / festival spike on holidays
            if holiday:
                if category == "religious_site":
                    base_ratio = max(base_ratio, 0.75 + random.uniform(0.05, 0.15))
                elif category in ("market", "public_square"):
                    base_ratio *= 1.20

            # Events active or upcoming for this venue
            event_active = 0
            event_att_ratio = 0.0
            hours_to_event = 99.0
            event_boost = 0.0

            for ev in events:
                if ev["place_id"] == place_id:
                    if ev["start"] <= current_dt < ev["end"]:
                        event_active = 1
                        event_att_ratio = max(event_att_ratio, ev["att_ratio"])
                        hours_to_event = 0.0
                        # Active event plateau: scales occupancy
                        event_boost = max(event_boost, min(0.85, 0.65 * ev["att_ratio"]))
                    elif current_dt < ev["start"]:
                        diff_h = (ev["start"] - current_dt).total_seconds() / 3600.0
                        if diff_h < hours_to_event:
                            hours_to_event = diff_h
                            if diff_h <= 1.5:
                                # Lead-in arrival surge (1 to 1.5h prior)
                                event_boost = max(event_boost, 0.25 * ev["att_ratio"])

            # Rain suppression (outdoor places affected heavily, covered places less)
            if rain_mm > 0:
                if category in ("market", "campus_ground", "public_square", "religious_site"):
                    rain_suppression = 0.35 + min(0.25, rain_mm * 0.01)
                else:
                    rain_suppression = 0.15 + min(0.15, rain_mm * 0.005)
            else:
                rain_suppression = 0.0

            # Combine signals
            combined_ratio = (base_ratio + event_boost) * (1.0 - rain_suppression)

            # Gaussian noise proportional to baseline
            noise = np.random.normal(0, 0.02)
            occupancy_ratio = round(max(0.01, min(1.50, combined_ratio + noise)), 4)

            # Format ISO timestamp with IST offset
            ts_str = current_dt.strftime("%Y-%m-%dT%H:00:00+05:30")

            rows.append({
                "timestamp_ist": ts_str,
                "place_id": place_id,
                "category": category,
                "city": city,
                "capacity": capacity,
                "hour": hour,
                "dow": dow,
                "is_weekend": is_weekend,
                "rain": rain_mm,
                "temp": round(base_temp, 1),
                "event_attendance_ratio": round(event_att_ratio, 3),
                "hours_to_event": round(min(99.0, hours_to_event), 1),
                "event_active": event_active,
                "occupancy_ratio": occupancy_ratio,
            })

    df = pd.DataFrame(rows)
    return df


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build one-hot encoded category and input features for the model."""
    df_feat = pd.DataFrame()
    for cat in CATEGORIES:
        df_feat[f"cat_{cat}"] = (df["category"] == cat).astype(int)

    df_feat["hour"] = df["hour"].astype(int)
    df_feat["dow"] = df["dow"].astype(int)
    df_feat["is_weekend"] = df["is_weekend"].astype(int)
    df_feat["rain"] = df["rain"].astype(float)
    df_feat["temp"] = df["temp"].astype(float)
    df_feat["event_attendance_ratio"] = df["event_attendance_ratio"].astype(float)
    df_feat["hours_to_event"] = df["hours_to_event"].astype(float)
    df_feat["event_active"] = df["event_active"].astype(int)

    return df_feat[FEATURE_COLS]


def train_and_evaluate(
    df_train: pd.DataFrame,
    df_heldout: pd.DataFrame,
    output_dir: Path,
) -> Dict[str, Any]:
    """Train GradientBoostingRegressor and evaluate honestly on held-out venues."""
    X_train = prepare_features(df_train)
    y_train = df_train["occupancy_ratio"]
    groups = df_train["place_id"]

    X_heldout = prepare_features(df_heldout)
    y_heldout = df_heldout["occupancy_ratio"]

    # 1. GroupKFold (5 folds) by place_id on synthetic training venues
    gkf = GroupKFold(n_splits=5)
    cv_maes = []
    for fold, (t_idx, v_idx) in enumerate(gkf.split(X_train, y_train, groups)):
        model_fold = GradientBoostingRegressor(
            n_estimators=140,
            max_depth=5,
            learning_rate=0.07,
            random_state=42 + fold,
        )
        model_fold.fit(X_train.iloc[t_idx], y_train.iloc[t_idx])
        pred_fold = model_fold.predict(X_train.iloc[v_idx])
        fold_mae_pct = mean_absolute_error(y_train.iloc[v_idx], pred_fold) * 100.0
        cv_maes.append(fold_mae_pct)

    avg_cv_mae_pct = float(np.mean(cv_maes))
    print(f"5-Fold GroupKFold Cross-Validation MAE: {avg_cv_mae_pct:.2f}% capacity")

    # 2. Train final model on ALL 100 synthetic venues
    print("Training final model on all 100 synthetic venues...")
    final_model = GradientBoostingRegressor(
        n_estimators=140,
        max_depth=5,
        learning_rate=0.07,
        random_state=42,
    )
    final_model.fit(X_train, y_train)

    # 3. Evaluate on held-out places (z1-z4 + named places)
    pred_heldout = final_model.predict(X_heldout)
    overall_heldout_mae_pct = float(mean_absolute_error(y_heldout, pred_heldout) * 100.0)
    print(f"Held-out Overall MAE: {overall_heldout_mae_pct:.2f}% capacity")

    # 4. Baselines on held-out places
    # Global mean baseline
    global_mean = float(y_train.mean())
    pred_global_mean = np.full_like(y_heldout, global_mean)
    baseline_global_mae_pct = float(mean_absolute_error(y_heldout, pred_global_mean) * 100.0)

    # Category + Hour mean baseline
    cat_hour_means = df_train.groupby(["category", "hour"])["occupancy_ratio"].mean().to_dict()
    pred_cat_hour = df_heldout.apply(
        lambda row: cat_hour_means.get((row["category"], row["hour"]), global_mean),
        axis=1,
    ).values
    baseline_cat_hour_mae_pct = float(mean_absolute_error(y_heldout, pred_cat_hour) * 100.0)

    print(f"Baseline Global Mean MAE: {baseline_global_mae_pct:.2f}% capacity")
    print(f"Baseline Category+Hour Mean MAE: {baseline_cat_hour_mae_pct:.2f}% capacity")

    # 5. Category breakdown on held-out places
    by_category = {}
    df_heldout_eval = df_heldout.copy()
    df_heldout_eval["pred"] = pred_heldout
    df_heldout_eval["abs_err"] = np.abs(df_heldout_eval["occupancy_ratio"] - df_heldout_eval["pred"])

    for cat in CATEGORIES:
        sub = df_heldout_eval[df_heldout_eval["category"] == cat]
        n_places = int(sub["place_id"].nunique())
        cat_mae_pct = float(sub["abs_err"].mean() * 100.0) if len(sub) > 0 else 0.0
        by_category[cat] = {
            "mae_pct_capacity": round(cat_mae_pct, 2),
            "n_places": n_places,
        }
        print(f"  Category '{cat}' (n={n_places}): {cat_mae_pct:.2f}% capacity")

    # 6. Category-blind ablation: Train variant without category features
    print("Training category-blind ablation model...")
    non_cat_features = [c for c in FEATURE_COLS if not c.startswith("cat_")]
    X_train_ablation = X_train[non_cat_features]
    X_heldout_ablation = X_heldout[non_cat_features]

    ablation_model = GradientBoostingRegressor(
        n_estimators=140,
        max_depth=5,
        learning_rate=0.07,
        random_state=42,
    )
    ablation_model.fit(X_train_ablation, y_train)
    pred_ablation = ablation_model.predict(X_heldout_ablation)
    ablation_mae_pct = float(mean_absolute_error(y_heldout, pred_ablation) * 100.0)
    print(f"Ablation (No Category) MAE: {ablation_mae_pct:.2f}% capacity")

    # 7. Save model and metadata artifacts
    model_path = output_dir / "forecast_model.joblib"
    joblib.dump(final_model, model_path)
    print(f"Saved forecast model artifact to: {model_path}")

    features_path = output_dir / "model_features.json"
    with open(features_path, "w", encoding="utf-8") as f:
        json.dump(FEATURE_COLS, f, indent=2)
    print(f"Saved feature list to: {features_path}")

    metrics = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "n_train_venues": len(df_train["place_id"].unique()),
        "evaluation": "held-out places (group split) + held-out named places",
        "disclaimer": "Ground truth comes from the same synthetic generator; results show the pipeline recovers category behaviour, not real-world accuracy.",
        "overall_mae_pct_capacity": round(overall_heldout_mae_pct, 2),
        "cross_val_group_mae_pct_capacity": round(avg_cv_mae_pct, 2),
        "baseline_mae_pct_capacity": {
            "global_mean": round(baseline_global_mae_pct, 2),
            "category_hour_mean": round(baseline_cat_hour_mae_pct, 2),
        },
        "ablation_no_category_mae_pct_capacity": round(ablation_mae_pct, 2),
        "by_category": by_category,
    }

    metrics_path = output_dir / "model_metrics.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved model metrics to: {metrics_path}")

    return metrics


def render_evaluation_plot(metrics: Dict[str, Any], output_path: Path):
    """Render a clean presentation-ready bar chart of MAE by category using Pillow."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    width, height = 900, 520
    img = Image.new("RGB", (width, height), color=(15, 23, 42))  # Dark slate navy
    draw = ImageDraw.Draw(img)

    # Title & subtitle
    draw.text((40, 30), "CrowdGuard Category-Based Forecast: Held-out MAE (% Capacity)", fill=(248, 250, 252))
    sub_text = (
        f"Overall Held-out MAE: {metrics['overall_mae_pct_capacity']:.1f}%  |  "
        f"Category-blind Ablation: {metrics['ablation_no_category_mae_pct_capacity']:.1f}%  |  "
        f"Global Mean Baseline: {metrics['baseline_mae_pct_capacity']['global_mean']:.1f}%"
    )
    draw.text((40, 60), sub_text, fill=(148, 163, 184))

    # Grid / Axes area
    plot_x0, plot_y0 = 60, 110
    plot_x1, plot_y1 = 840, 430
    draw.rectangle([plot_x0, plot_y0, plot_x1, plot_y1], outline=(51, 65, 85), width=1)

    categories = list(metrics["by_category"].keys())
    maes = [metrics["by_category"][c]["mae_pct_capacity"] for c in categories]
    n_places = [metrics["by_category"][c]["n_places"] for c in categories]

    # Baseline line (Global Mean)
    global_baseline = metrics["baseline_mae_pct_capacity"]["global_mean"]
    max_val = max(max(maes), global_baseline, metrics["ablation_no_category_mae_pct_capacity"]) * 1.25

    def val_to_y(val: float) -> int:
        return int(plot_y1 - (val / max_val) * (plot_y1 - plot_y0))

    # Draw horizontal grid lines
    for grid_v in [5, 10, 15, 20, 25]:
        if grid_v < max_val:
            gy = val_to_y(grid_v)
            draw.line([(plot_x0, gy), (plot_x1, gy)], fill=(30, 41, 59), width=1)
            draw.text((plot_x0 - 30, gy - 7), f"{grid_v}%", fill=(100, 116, 139))

    # Draw global baseline dashed line
    base_y = val_to_y(global_baseline)
    for x_dash in range(plot_x0, plot_x1, 14):
        draw.line([(x_dash, base_y), (min(x_dash + 8, plot_x1), base_y)], fill=(239, 68, 68), width=2)
    draw.text((plot_x1 - 220, base_y - 18), f"Global Baseline ({global_baseline:.1f}%)", fill=(239, 68, 68))

    # Draw bars
    n_bars = len(categories)
    slot_width = (plot_x1 - plot_x0) / n_bars
    bar_width = slot_width * 0.55

    palette = [
        (56, 189, 248),  # Sky blue
        (129, 140, 248), # Indigo
        (244, 114, 182), # Pink
        (52, 211, 153),  # Emerald
        (251, 146, 60),  # Orange
        (167, 139, 250), # Violet
    ]

    for i, (cat, mae, np_count) in enumerate(zip(categories, maes, n_places)):
        bx0 = int(plot_x0 + i * slot_width + (slot_width - bar_width) / 2)
        bx1 = int(bx0 + bar_width)
        by1 = plot_y1
        by0 = val_to_y(mae)

        color = palette[i % len(palette)]
        draw.rectangle([bx0, by0, bx1, by1], fill=color)

        # Draw value on top of bar
        val_str = f"{mae:.1f}%"
        draw.text((bx0 + 8, by0 - 18), val_str, fill=(255, 255, 255))

        # Category label under axis
        clean_cat = cat.replace("_", " ").title()
        draw.text((bx0 - 5, plot_y1 + 10), clean_cat, fill=(226, 232, 240))
        draw.text((bx0 + 10, plot_y1 + 26), f"(n={np_count})", fill=(148, 163, 184))

    # Footer note
    footer = "Evaluated on held-out test venues (z1-z4, ch01-ch03, gg01-gg03). CrowdGuard ML pipeline recovers category diurnal patterns."
    draw.text((40, 480), footer, fill=(100, 116, 139))

    img.save(output_path)
    print(f"Saved evaluation chart to: {output_path}")


def main():
    root_dir = Path(__file__).resolve().parent.parent
    data_dir = root_dir / "backend" / "data"
    docs_dir = root_dir / "docs"
    data_dir.mkdir(parents=True, exist_ok=True)
    docs_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("CrowdGuard Synthetic Generator & Category Model Trainer")
    print("=" * 60)

    # 1. Generate 100 synthetic venues specs
    venue_specs = create_synthetic_venue_specs(num_venues=100)
    print(f"Created {len(venue_specs)} synthetic venues specs across {len(CATEGORIES)} categories.")

    # 2. Generate training dataset (60 days x 24h x 100 venues = 144,000 rows)
    print("Generating synthetic training dataset (60 days x 24h x 100 venues in IST)...")
    df_train = generate_dataset_for_venues(venue_specs, days=60, seed=42)
    csv_train_path = data_dir / "footfall_train.csv"
    df_train.to_csv(csv_train_path, index=False)
    print(f"Saved training dataset ({len(df_train)} rows) to: {csv_train_path}")

    # 3. Generate held-out dataset (z1-z4 + named places)
    heldout_specs = get_heldout_venue_specs()
    print(f"Generating held-out dataset for {len(heldout_specs)} venues (z1-z4 & named places)...")
    df_heldout = generate_dataset_for_venues(heldout_specs, days=60, seed=1337)
    csv_heldout_path = data_dir / "footfall_heldout.csv"
    df_heldout.to_csv(csv_heldout_path, index=False)
    print(f"Saved held-out dataset ({len(df_heldout)} rows) to: {csv_heldout_path}")

    # 4. Train and evaluate
    metrics = train_and_evaluate(df_train, df_heldout, data_dir)

    # 5. Render plot
    plot_path = docs_dir / "forecast_mae_by_category.png"
    render_evaluation_plot(metrics, plot_path)

    print("=" * 60)
    print("SUCCESS: Category-based model and datasets successfully generated!")
    print(f"Overall Held-out MAE: {metrics['overall_mae_pct_capacity']:.2f}% of capacity")
    print(f"Global Baseline MAE:  {metrics['baseline_mae_pct_capacity']['global_mean']:.2f}% of capacity")
    print(f"Category-Hour MAE:    {metrics['baseline_mae_pct_capacity']['category_hour_mean']:.2f}% of capacity")
    print(f"No-Category Ablation: {metrics['ablation_no_category_mae_pct_capacity']:.2f}% of capacity")
    print("=" * 60)


if __name__ == "__main__":
    main()
