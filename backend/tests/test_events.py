"""Tests for CrowdGuard Events module (Person B)."""
from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints.events import router as events_router
from app.data.assumed_events import get_assumed_events, next_weekday_at
from app.main import app
from app.schemas.shared import ZONE_BY_ID
from app.services import event_fetcher, store

IST = ZoneInfo("Asia/Kolkata")

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
    res_z3 = client.get("/api/v1/events/nearby?zone_id=z3")
    assert res_z3.status_code == 200
    data_z3 = res_z3.json()
    for ev in data_z3["events"]:
        assert ev["zone_id"] == "z3"

    res_bad = client.get("/api/v1/events/nearby?zone_id=nope")
    assert res_bad.status_code == 400
    assert "Unknown zone_id" in res_bad.json()["detail"]


def test_events_refresh_resilient_to_network_outage(monkeypatch):
    """POST /api/v1/events/refresh returns 200 with no network access and still reports seed events."""
    def mock_fetch_weather_fail(zone_id: str):
        return event_fetcher.get_default_weather(), "Simulated offline network outage"

    monkeypatch.setattr(event_fetcher, "fetch_weather_open_meteo", mock_fetch_weather_fail)

    response = client.post("/api/v1/events/refresh")
    assert response.status_code == 200
    data = response.json()
    assert data["refreshed"] is True
    assert data["count"] >= 10
    assert "seed" in data["sources_used"]
    assert len(data["errors"]) > 0


# -------------------------------------------------------------------------
# New Additive Tests for Person B Brief (Assumed Events, IST Anchoring, Honesty)
# -------------------------------------------------------------------------


def test_assumed_events_label_and_schema():
    """Every assumed event has is_illustrative=True, source='assumed', title starting '[Illustrative]'."""
    assumed = get_assumed_events()
    assert len(assumed) >= 6

    for ev in assumed:
        assert ev.is_illustrative is True, f"Event {ev.id} must have is_illustrative=True"
        assert ev.source == "assumed", f"Event {ev.id} must have source='assumed'"
        assert ev.title.startswith("[Illustrative]"), f"Event {ev.id} title must start with '[Illustrative]'"
        assert ev.id.startswith("assume-"), f"Event {ev.id} id must start with 'assume-'"
        assert ev.start_time is not None
        assert ev.end_time is not None
        assert ev.end_time > ev.start_time


def test_no_id_collisions_seed_and_assumed():
    """Seed event IDs and assumed event IDs must be strictly disjoint."""
    seed_events = event_fetcher.generate_seed_events()
    assumed_events = get_assumed_events()

    seed_ids = {e.id for e in seed_events}
    assumed_ids = {e.id for e in assumed_events}

    assert seed_ids.isdisjoint(assumed_ids), f"Overlapping IDs found: {seed_ids.intersection(assumed_ids)}"


def test_next_weekday_at_ist_anchoring():
    """next_weekday_at anchors accurately to future weekday and hour in IST."""
    # Given a reference time: Wednesday (weekday=2) 10:00 IST
    ref = datetime(2026, 9, 23, 10, 0, 0, tzinfo=IST)

    # Next Saturday (weekday=5) at 18:00 IST
    target = next_weekday_at(weekday=5, hour=18, reference_time=ref)
    target_ist = target.astimezone(IST)
    assert target_ist.weekday() == 5
    assert target_ist.hour == 18
    assert target_ist.minute == 0
    assert target_ist > ref

    # Next Wednesday at 15:00 IST (later today)
    target_same_day = next_weekday_at(weekday=2, hour=15, reference_time=ref)
    target_same_day_ist = target_same_day.astimezone(IST)
    assert target_same_day_ist.weekday() == 2
    assert target_same_day_ist.hour == 15
    assert (target_same_day_ist.date() - ref.date()).days == 0

    # Next Wednesday at 08:00 IST (already passed today -> next week)
    target_next_week = next_weekday_at(weekday=2, hour=8, reference_time=ref)
    target_next_week_ist = target_next_week.astimezone(IST)
    assert target_next_week_ist.weekday() == 2
    assert target_next_week_ist.hour == 8
    assert (target_next_week_ist.date() - ref.date()).days == 7


def test_nearby_events_contains_assumed_and_seed_sources():
    """GET /api/v1/events/nearby with horizon contains both seed and assumed events without blurring."""
    response = client.get("/api/v1/events/nearby?hours=168")
    assert response.status_code == 200
    data = response.json()

    events = data["events"]
    sources = {e["source"] for e in events}
    assert "seed" in sources, "Should contain seed events"
    assert "assumed" in sources, "Should contain assumed events"

    for e in events:
        if e["source"] == "assumed":
            assert e["is_illustrative"] is True
            assert e["title"].startswith("[Illustrative]")
        elif e["source"] == "seed":
            assert e["is_illustrative"] is False
