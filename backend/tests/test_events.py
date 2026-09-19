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


def test_assumed_events_honesty_contract():
    """Every assumed event has is_illustrative=True, source='assumed', and title starting with [Illustrative]."""
    from app.data.assumed_events import get_assumed_events
    assumed = get_assumed_events()
    assert len(assumed) >= 6, "Expected at least 6 canonical assumed events"

    for ev in assumed:
        assert getattr(ev, "is_illustrative", False) is True, f"Event {ev.id} is not marked is_illustrative=True"
        assert ev.source == "assumed", f"Event {ev.id} source is {ev.source}, expected 'assumed'"
        assert ev.title.startswith("[Illustrative]"), f"Event {ev.id} title '{ev.title}' missing '[Illustrative]' prefix"
        assert ev.id.startswith("assume-"), f"Event {ev.id} id missing 'assume-' prefix"


def test_no_id_collision_between_seed_and_assumed():
    """Seed event IDs and assumed event IDs are completely disjoint."""
    from app.data.assumed_events import get_assumed_events
    seed_events = event_fetcher.generate_seed_events()
    assumed_events = get_assumed_events()

    seed_ids = {e.id for e in seed_events}
    assumed_ids = {e.id for e in assumed_events}

    collision = seed_ids & assumed_ids
    assert len(collision) == 0, f"Found colliding IDs between seed and assumed sets: {collision}"


def test_assumed_events_ist_anchoring():
    """Assumed events are anchored to intended IST times."""
    from zoneinfo import ZoneInfo
    from app.data.assumed_events import get_assumed_events
    ist = ZoneInfo("Asia/Kolkata")

    assumed = get_assumed_events()
    for ev in assumed:
        start_ist = ev.start_time.astimezone(ist)
        # Check that start minute is either 0 or 30
        assert start_ist.minute in (0, 30), f"Event {ev.id} starts at unexpected minute: {start_ist.minute}"
        # All events should have upcoming start times
        assert ev.end_time > ev.start_time


def test_events_refresh_includes_assumed_source():
    """POST /api/v1/events/refresh returns sources_used containing both seed and assumed."""
    resp = client.post("/api/v1/events/refresh")
    assert resp.status_code == 200
    data = resp.json()
    assert "seed" in data["sources_used"]
    assert "assumed" in data["sources_used"]
    assert data["count"] >= 15


def test_events_nearby_carries_source_and_is_illustrative():
    """GET /api/v1/events/nearby carries source and is_illustrative fields."""
    resp = client.get("/api/v1/events/nearby?hours=168")
    assert resp.status_code == 200
    events = resp.json()["events"]

    sources = {e.get("source") for e in events}
    assert "seed" in sources
    assert "assumed" in sources

    has_illustrative = any(e.get("is_illustrative") is True for e in events)
    assert has_illustrative is True

