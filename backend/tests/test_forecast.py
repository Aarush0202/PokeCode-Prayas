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
