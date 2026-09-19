"""Tests for CrowdGuard Forecast module (Person B)."""
from __future__ import annotations

from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints.forecast import router as forecast_router
from app.main import app
from app.schemas.shared import RiskTier, ZONE_BY_ID
from app.services import event_fetcher, forecaster, store

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
        # Exactly one hour apart
        diff = (t2 - t1).total_seconds()
        assert diff == 3600.0
        assert t2 > t1


def test_forecast_risk_tier_validity():
    """Every point's risk_tier is one of the four valid values."""
    valid_tiers = {RiskTier.NORMAL.value, RiskTier.ELEVATED.value, RiskTier.HIGH.value, RiskTier.CRITICAL.value}
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
    # Force load_model to return None (simulating missing model file)
    monkeypatch.setattr(forecaster, "load_model", lambda: None)

    response = client.get("/api/v1/forecast/z1?hours=12")
    assert response.status_code == 200
    data = response.json()
    assert len(data["points"]) == 12

    # Verify pressure also works with fallback
    pres_resp = client.get("/api/v1/forecast/z1/pressure")
    assert pres_resp.status_code == 200
    assert 0.0 <= pres_resp.json()["pressure"] <= 1.0


def test_forecast_named_place_ch01_schema_parity():
    """GET /forecast/ch01?hours=24 returns 200 with 24 points and identical schema to /forecast/z3."""
    res_ch01 = client.get("/api/v1/forecast/ch01?hours=24")
    assert res_ch01.status_code == 200
    data_ch01 = res_ch01.json()
    assert data_ch01["zone_id"] == "ch01"
    assert data_ch01["horizon_hours"] == 24
    assert len(data_ch01["points"]) == 24

    res_z3 = client.get("/api/v1/forecast/z3?hours=24")
    assert res_z3.status_code == 200
    data_z3 = res_z3.json()

    # Top-level keys must match exactly
    assert set(data_ch01.keys()) == set(data_z3.keys())

    # Point fields must match exactly
    pt_ch01 = data_ch01["points"][0]
    pt_z3 = data_z3["points"][0]
    assert set(pt_ch01.keys()) == set(pt_z3.keys())
    assert {"timestamp", "predicted_count", "predicted_density", "risk_tier", "drivers"} <= set(pt_ch01.keys())


def test_feature_columns_no_data_leakage():
    """Feature list strictly excludes place_id, city, lat, lon, and capacity."""
    cols_path = forecaster.get_feature_columns_path()
    assert cols_path.is_file(), f"Missing feature columns file at {cols_path}"

    import json
    with open(cols_path, "r") as f:
        feature_cols = json.load(f)

    forbidden = {"place_id", "city", "lat", "lon", "capacity", "zone_capacity", "zone_area"}
    for f in feature_cols:
        assert f not in forbidden, f"Leaked feature '{f}' detected in training features!"

    model = forecaster.load_model()
    if model is not None and hasattr(model, "feature_names_in_"):
        for f in model.feature_names_in_:
            assert f not in forbidden, f"Leaked feature '{f}' in trained model artifact!"


def test_shape_generalization_ist_peaks():
    """Shape generalization: markets peak in evening weekend, transit hubs peak in commute hours."""
    from zoneinfo import ZoneInfo
    ist = ZoneInfo("Asia/Kolkata")

    # Pick an upcoming Saturday
    now = datetime.now(ist)
    days_to_sat = (5 - now.weekday()) % 7
    if days_to_sat == 0:
        days_to_sat = 7
    sat_date = (now + timedelta(days=days_to_sat)).date()

    # Compare weekend 19:00 IST vs 03:00 IST for two markets (z3 and ch01)
    for mkt_id in ["z3", "ch01"]:
        zone = forecaster.resolve_zone(mkt_id)
        assert zone is not None
        pt_eve = forecaster.predict_zone_hour(zone, datetime(sat_date.year, sat_date.month, sat_date.day, 19, 0, tzinfo=ist))
        pt_night = forecaster.predict_zone_hour(zone, datetime(sat_date.year, sat_date.month, sat_date.day, 3, 0, tzinfo=ist))
        assert pt_eve.predicted_count > pt_night.predicted_count * 3, f"Market {mkt_id} did not peak on weekend evening!"

    # Pick an upcoming Wednesday
    days_to_wed = (2 - now.weekday()) % 7
    if days_to_wed == 0:
        days_to_wed = 7
    wed_date = (now + timedelta(days=days_to_wed)).date()

    # Compare weekday 09:00 IST vs 03:00 IST for two transit hubs (z2 and ch02)
    for tr_id in ["z2", "ch02"]:
        zone = forecaster.resolve_zone(tr_id)
        assert zone is not None
        pt_rush = forecaster.predict_zone_hour(zone, datetime(wed_date.year, wed_date.month, wed_date.day, 9, 0, tzinfo=ist))
        pt_night = forecaster.predict_zone_hour(zone, datetime(wed_date.year, wed_date.month, wed_date.day, 3, 0, tzinfo=ist))
        assert pt_rush.predicted_count > pt_night.predicted_count * 2, f"Transit hub {tr_id} did not peak on weekday morning rush!"


def test_model_metrics_heldout_beats_baseline():
    """Overall held-out MAE is below the global-mean baseline MAE."""
    resp = client.get("/api/v1/forecast/metrics")
    assert resp.status_code == 200
    metrics = resp.json()

    assert "overall_mae_pct_capacity" in metrics
    assert "baseline_mae_pct_capacity" in metrics
    assert "by_category" in metrics

    overall_mae = metrics["overall_mae_pct_capacity"]
    global_baseline = metrics["baseline_mae_pct_capacity"]["global_mean"]

    assert overall_mae < global_baseline, f"Model MAE {overall_mae}% did not beat global baseline {global_baseline}%!"

    # Check that all 6 categories are represented
    expected_categories = {"market", "transit_hub", "religious_site", "campus_ground", "food_street", "public_square"}
    assert set(metrics["by_category"].keys()) == expected_categories


def test_fallback_for_named_place_when_model_absent(monkeypatch):
    """Fallback works for a named place with model file absent."""
    monkeypatch.setattr(forecaster, "load_model", lambda: None)

    resp = client.get("/api/v1/forecast/ch01?hours=12")
    assert resp.status_code == 200
    data = resp.json()
    assert data["zone_id"] == "ch01"
    assert len(data["points"]) == 12


def test_baseline_ratio_series_ml_and_fallback(monkeypatch):
    """baseline_ratio_series works for z3 and ch01 with model and with fallback."""
    from zoneinfo import ZoneInfo
    ist = ZoneInfo("Asia/Kolkata")
    test_times = [
        datetime(2026, 9, 26, 10, 0, tzinfo=ist),
        datetime(2026, 9, 26, 19, 0, tzinfo=ist),
        datetime(2026, 9, 27, 2, 0, tzinfo=ist),
    ]

    for zid in ["z3", "ch01"]:
        zone = forecaster.resolve_zone(zid)
        assert zone is not None

        # 1. With ML model loaded
        ratios_ml = forecaster.baseline_ratio_series(zone, test_times)
        assert len(ratios_ml) == len(test_times)
        for r in ratios_ml:
            assert isinstance(r, float)
            assert 0.0 <= r <= 1.0

        # Evening peak ratio should exceed 2 AM ratio
        assert ratios_ml[1] > ratios_ml[2]

        # 2. With fallback (model forced None)
        monkeypatch.setattr(forecaster, "load_model", lambda: None)
        ratios_fb = forecaster.baseline_ratio_series(zone, test_times)
        assert len(ratios_fb) == len(test_times)
        for r in ratios_fb:
            assert isinstance(r, float)
            assert 0.0 <= r <= 1.0
        assert ratios_fb[1] > ratios_fb[2]

