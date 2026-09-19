"""Tests for CrowdGuard Forecast module (Person B)."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints.forecast import router as forecast_router
from app.main import app
from app.schemas.shared import RiskTier, ZONE_BY_ID, Zone
from app.services import event_fetcher, forecaster, store

IST = ZoneInfo("Asia/Kolkata")

# Ensure forecast router is registered under /api/v1/forecast if router.py has not been merged yet
existing_paths = [getattr(r, "path", "") for r in app.routes]
if not any(p.startswith("/api/v1/forecast") for p in existing_paths):
    app.include_router(forecast_router, prefix="/api/v1/forecast")

client = TestClient(app)


def setup_function():
    """Ensure events are loaded before each test."""
    event_fetcher.ensure_events_loaded()


def test_forecast_horizon_and_ordering():
    """GET /api/v1/forecast/z1?hours=24 returns exactly 24 points, one hour apart, ascending."""
    response = client.get("/api/v1/forecast/z1?hours=24")
    assert response.status_code == 200
    data = response.json()
    assert data["zone_id"] == "z1"
    assert data["horizon_hours"] == 24
    points = data["points"]
    assert len(points) == 24

    for i in range(len(points) - 1):
        t1 = datetime.fromisoformat(points[i]["timestamp"])
        t2 = datetime.fromisoformat(points[i + 1]["timestamp"])
        diff = (t2 - t1).total_seconds()
        assert diff == 3600.0
        assert t2 > t1


def test_forecast_risk_tier_validity():
    """Every point's risk_tier is one of the valid values."""
    valid_tiers = {RiskTier.NORMAL.value, RiskTier.ELEVATED.value, RiskTier.HIGH.value, RiskTier.CRITICAL.value, RiskTier.NO_DATA.value}
    response = client.get("/api/v1/forecast/z2?hours=48")
    assert response.status_code == 200
    points = response.json()["points"]

    for pt in points:
        assert pt["risk_tier"] in valid_tiers
        assert isinstance(pt["drivers"], list)
        assert len(pt["drivers"]) >= 1


def test_forecast_density_matches_count_divided_by_area():
    """predicted_density equals predicted_count / area_sqm within a small tolerance."""
    zone = ZONE_BY_ID["z3"]
    response = client.get("/api/v1/forecast/z3?hours=12")
    assert response.status_code == 200
    points = response.json()["points"]

    for pt in points:
        expected_density = pt["predicted_count"] / zone.area_sqm
        assert abs(pt["predicted_density"] - expected_density) < 0.005


def test_forecast_unknown_zone_returns_400():
    """GET /api/v1/forecast/nope returns 400."""
    response = client.get("/api/v1/forecast/nope")
    assert response.status_code == 400
    assert "Unknown zone_id" in response.json()["detail"]


def test_forecast_pressure_returns_float_between_zero_and_one():
    """GET /api/v1/forecast/z1/pressure returns a float between 0 and 1 inclusive."""
    response = client.get("/api/v1/forecast/z1/pressure")
    assert response.status_code == 200
    data = response.json()
    assert data["zone_id"] == "z1"
    assert "pressure" in data
    assert 0.0 <= data["pressure"] <= 1.0
    assert "drivers" in data
    assert len(data["drivers"]) >= 1


def test_forecast_fallback_when_model_absent(monkeypatch):
    """With the model file deliberately absent, the endpoint still returns 200."""
    monkeypatch.setattr(forecaster, "load_model", lambda: None)

    response = client.get("/api/v1/forecast/z1?hours=12")
    assert response.status_code == 200
    data = response.json()
    assert len(data["points"]) == 12

    pres_resp = client.get("/api/v1/forecast/z1/pressure")
    assert pres_resp.status_code == 200
    assert 0.0 <= pres_resp.json()["pressure"] <= 1.0


# -------------------------------------------------------------------------
# New Additive Tests for Person B Brief (Category Model, Named Places, Baselines)
# -------------------------------------------------------------------------


def test_forecast_named_place_ch01_schema_parity():
    """GET /forecast/ch01?hours=24 returns 200 with 24 points and identical schema to /forecast/z3."""
    res_z3 = client.get("/api/v1/forecast/z3?hours=24")
    assert res_z3.status_code == 200
    z3_data = res_z3.json()

    res_ch01 = client.get("/api/v1/forecast/ch01?hours=24")
    assert res_ch01.status_code == 200
    ch01_data = res_ch01.json()

    assert ch01_data["zone_id"] == "ch01"
    assert ch01_data["zone_name"] == "Chandni Chowk"
    assert ch01_data["horizon_hours"] == 24
    assert len(ch01_data["points"]) == 24

    # Top-level keys match exactly
    assert set(ch01_data.keys()) == set(z3_data.keys())

    # Point structure matches exactly
    z3_pt_keys = set(z3_data["points"][0].keys())
    ch01_pt_keys = set(ch01_data["points"][0].keys())
    assert z3_pt_keys == ch01_pt_keys
    assert ch01_pt_keys == {"timestamp", "predicted_count", "predicted_density", "risk_tier", "drivers"}


def test_no_feature_leakage():
    """Feature list must NEVER contain place_id, city, lat, lon, or capacity."""
    features_path = Path(__file__).resolve().parent.parent / "data" / "model_features.json"
    assert features_path.is_file(), "model_features.json must exist"

    with open(features_path, "r", encoding="utf-8") as f:
        features = json.load(f)

    forbidden = {"place_id", "city", "lat", "lon", "capacity", "zone_capacity", "zone_area"}
    for feat in features:
        assert feat not in forbidden, f"Leaked forbidden feature: '{feat}'"
        assert not feat.startswith("place_"), f"Leaked place identifier: '{feat}'"

    # Also check forecaster.FEATURE_COLS
    for feat in forecaster.FEATURE_COLS:
        assert feat not in forbidden, f"Leaked forbidden feature in code: '{feat}'"


def test_forecast_metrics_endpoint():
    """GET /api/v1/forecast/metrics returns 200 with full by-category breakdown and beats baseline."""
    response = client.get("/api/v1/forecast/metrics")
    assert response.status_code == 200
    data = response.json()

    assert data["n_train_venues"] == 100
    assert "evaluation" in data
    assert "disclaimer" in data
    assert "overall_mae_pct_capacity" in data
    assert "baseline_mae_pct_capacity" in data
    assert "ablation_no_category_mae_pct_capacity" in data
    assert "by_category" in data

    # Evaluation honesty: overall MAE must beat global mean baseline
    overall_mae = data["overall_mae_pct_capacity"]
    global_baseline = data["baseline_mae_pct_capacity"]["global_mean"]
    assert overall_mae < global_baseline, f"Model MAE ({overall_mae}%) did not beat baseline ({global_baseline}%)"

    # Category ablation check: model with category must be better than ablation without category
    ablation_mae = data["ablation_no_category_mae_pct_capacity"]
    assert overall_mae < ablation_mae, f"Category features should improve accuracy: {overall_mae}% vs {ablation_mae}%"

    # All 6 categories present
    expected_categories = {"market", "transit_hub", "religious_site", "campus_ground", "food_street", "public_square"}
    assert set(data["by_category"].keys()) == expected_categories
    for cat, stats in data["by_category"].items():
        assert "mae_pct_capacity" in stats
        assert "n_places" in stats
        assert stats["mae_pct_capacity"] >= 0.0


def test_shape_generalization_ist():
    """Diurnal peak patterns generalize across venues in the same category in IST."""
    # 1. Market test: z3 and ch01 are both markets.
    # On Saturday evening (19:00 IST), market occupancy should be high compared to overnight (03:00 IST)
    sat_night_ist = datetime(2026, 9, 26, 19, 0, 0, tzinfo=IST)
    sat_late_ist = datetime(2026, 9, 27, 3, 0, 0, tzinfo=IST)

    z3 = forecaster.get_zone_by_id("z3")
    ch01 = forecaster.get_zone_by_id("ch01")

    r_z3 = forecaster.baseline_ratio_series(z3, [sat_night_ist, sat_late_ist])
    r_ch01 = forecaster.baseline_ratio_series(ch01, [sat_night_ist, sat_late_ist])

    # Weekend evening market rush must be significantly higher than late night
    assert r_z3[0] > r_z3[1] * 2.0
    assert r_ch01[0] > r_ch01[1] * 2.0

    # 2. Transit hub test: z2 (transit_hub) on a weekday
    # Morning commute peak (09:00 IST) vs early morning low (04:00 IST)
    mon_peak_ist = datetime(2026, 9, 28, 9, 0, 0, tzinfo=IST)
    mon_low_ist = datetime(2026, 9, 28, 4, 0, 0, tzinfo=IST)
    z2 = forecaster.get_zone_by_id("z2")

    r_z2 = forecaster.baseline_ratio_series(z2, [mon_peak_ist, mon_low_ist])
    assert r_z2[0] > r_z2[1] * 3.0


def test_baseline_ratio_series_contract():
    """baseline_ratio_series returns pure float ratios with both ML model and rule-based fallback."""
    timestamps = [
        datetime(2026, 9, 26, 12, 0, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 26, 18, 0, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 27, 2, 0, 0, tzinfo=timezone.utc),
    ]

    # Test with ML model loaded
    ratios_z3 = forecaster.baseline_ratio_series("z3", timestamps)
    assert len(ratios_z3) == 3
    for r in ratios_z3:
        assert isinstance(r, float)
        assert 0.0 <= r <= 1.5

    ratios_ch01 = forecaster.baseline_ratio_series("ch01", timestamps)
    assert len(ratios_ch01) == 3
    for r in ratios_ch01:
        assert isinstance(r, float)
        assert 0.0 <= r <= 1.5

    # Test with model absent (rule-based fallback path)
    forecaster_load = forecaster.load_model
    try:
        forecaster.load_model = lambda: None
        fb_z3 = forecaster.baseline_ratio_series("z3", timestamps)
        fb_ch01 = forecaster.baseline_ratio_series("ch01", timestamps)
        assert len(fb_z3) == 3
        assert len(fb_ch01) == 3
        for r in fb_z3 + fb_ch01:
            assert isinstance(r, float)
            assert 0.01 <= r <= 1.5
    finally:
        forecaster.load_model = forecaster_load


def test_zone_pressure_signature_and_bounds():
    """zone_pressure returns (pressure: float, drivers: list[str]) for Person C fusion."""
    p_z3, d_z3 = forecaster.zone_pressure("z3")
    assert isinstance(p_z3, float)
    assert 0.0 <= p_z3 <= 1.0
    assert isinstance(d_z3, list)
    assert len(d_z3) >= 1

    p_ch01, d_ch01 = forecaster.zone_pressure("ch01")
    assert isinstance(p_ch01, float)
    assert 0.0 <= p_ch01 <= 1.0
    assert isinstance(d_ch01, list)
