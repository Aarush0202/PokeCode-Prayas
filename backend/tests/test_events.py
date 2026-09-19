"""Tests for CrowdGuard Events module (Person B)."""
from __future__ import annotations

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints.events import router as events_router
from app.main import app
from app.schemas.shared import ZONE_BY_ID
from app.services import event_fetcher, store

# Ensure events router is registered under /api/v1/events if router.py has not been merged yet
existing_paths = [getattr(r, "path", "") for r in app.routes]
if not any(p.startswith("/api/v1/events") for p in existing_paths):
    app.include_router(events_router, prefix="/api/v1/events")

client = TestClient(app)


def setup_function():
    """Reset store and ensure clean state before each test."""
    store.reset()
    event_fetcher.fetch_and_store_events()


def test_get_nearby_events_success():
    """GET /api/v1/events/nearby returns 200 and at least one seed event."""
    response = client.get("/api/v1/events/nearby")
    assert response.status_code == 200
    data = response.json()
    assert "events" in data
    assert "count" in data
    assert data["count"] >= 1
    assert len(data["events"]) == data["count"]


def test_events_have_future_start_times():
    """Every returned event has start_time in the future."""
    response = client.get("/api/v1/events/nearby?hours=72")
    assert response.status_code == 200
    data = response.json()
    now = datetime.now(timezone.utc)

    for ev in data["events"]:
        start_dt = datetime.fromisoformat(ev["start_time"])
        assert start_dt >= now or (now - start_dt).total_seconds() < 60  # Allow tiny clock skew


def test_events_filtering_by_zone_and_unknown_zone():
    """?zone_id=z3 returns only z3 events; ?zone_id=nope returns 400."""
    # Test valid filter
    res_z3 = client.get("/api/v1/events/nearby?zone_id=z3")
    assert res_z3.status_code == 200
    data_z3 = res_z3.json()
    for ev in data_z3["events"]:
        assert ev["zone_id"] == "z3"

    # Test unknown zone returns 400
    res_bad = client.get("/api/v1/events/nearby?zone_id=nope")
    assert res_bad.status_code == 400
    assert "Unknown zone_id" in res_bad.json()["detail"]


def test_events_refresh_resilient_to_network_outage(monkeypatch):
    """POST /api/v1/events/refresh returns 200 with no network access and still reports seed events."""
    # Simulate network outage by making fetch_weather_open_meteo raise or fail
    def mock_fetch_weather_fail(zone_id: str):
        return event_fetcher.get_default_weather(), "Simulated offline network outage"

    monkeypatch.setattr(event_fetcher, "fetch_weather_open_meteo", mock_fetch_weather_fail)

    response = client.post("/api/v1/events/refresh")
    assert response.status_code == 200
    data = response.json()
    assert data["refreshed"] is True
    assert data["count"] >= 10
    assert "seed" in data["sources_used"]
    assert len(data["errors"]) > 0  # Captured failure gracefully without crashing
