"""Tests for the Event Planner assessment engine and API endpoints."""
import re
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_planner_assess_z3_and_ch01():
    """POST /api/v1/planner/assess works for both instrumented (z3) and held-out (ch01) zones."""
    for zone_id in ["z3", "ch01"]:
        payload = {
            "zone_id": zone_id,
            "start_time": "2026-09-26T18:00:00+05:30",
            "duration_hours": 4.0,
            "event_type": "concert",
            "expected_attendance": 2000,
            "draw_level": "normal",
        }
        resp = client.post("/api/v1/planner/assess", json=payload)
        assert resp.status_code == 200, resp.text
        data = resp.json()

        assert data["zone"]["id"] == zone_id
        assert data["verdict"] in ["feasible", "feasible_with_mitigations", "not_recommended"]
        assert "peak" in data
        assert data["peak"]["total_present"] > 0
        assert data["peak"]["occupancy_ratio"] > 0
        assert len(data["scenarios"]) == 3
        assert len(data["timeline"]) > 0
        assert "assumptions" in data and len(data["assumptions"]) > 0
        assert "disclaimer" in data and "Decision support only" in data["disclaimer"]


def test_planner_unknown_zone_returns_404():
    """Unknown zone ID returns 404."""
    payload = {
        "zone_id": "non_existent_zone_999",
        "start_time": "2026-09-26T18:00:00+05:30",
        "duration_hours": 3.0,
        "event_type": "rally",
        "expected_attendance": 1000,
    }
    resp = client.post("/api/v1/planner/assess", json=payload)
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_planner_attendance_monotonic_verdict():
    """For identical parameters, larger attendance never yields a better verdict."""
    verdict_rank = {"feasible": 3, "feasible_with_mitigations": 2, "not_recommended": 1}

    small_resp = client.post(
        "/api/v1/planner/assess",
        json={
            "zone_id": "z3",
            "start_time": "2026-09-26T18:00:00+05:30",
            "duration_hours": 3.0,
            "event_type": "concert",
            "expected_attendance": 200,
        },
    )
    large_resp = client.post(
        "/api/v1/planner/assess",
        json={
            "zone_id": "z3",
            "start_time": "2026-09-26T18:00:00+05:30",
            "duration_hours": 3.0,
            "event_type": "concert",
            "expected_attendance": 5000,
        },
    )

    small_rank = verdict_rank[small_resp.json()["verdict"]]
    large_rank = verdict_rank[large_resp.json()["verdict"]]
    assert small_rank >= large_rank
    assert small_resp.json()["peak"]["occupancy_ratio"] < large_resp.json()["peak"]["occupancy_ratio"]


def test_planner_scenarios_ordering():
    """Scenarios are strictly ordered: expected < +30% < +60% in attendance and peak ratio."""
    payload = {
        "zone_id": "z3",
        "start_time": "2026-09-26T18:00:00+05:30",
        "duration_hours": 2.5,
        "event_type": "festival",
        "expected_attendance": 1000,
    }
    resp = client.post("/api/v1/planner/assess", json=payload)
    assert resp.status_code == 200
    scenarios = resp.json()["scenarios"]

    labels = [s["label"] for s in scenarios]
    assert labels == ["expected", "+30%", "+60%"]

    att = [s["attendance"] for s in scenarios]
    assert att[0] < att[1] < att[2]

    ratios = [s["peak_ratio"] for s in scenarios]
    assert ratios[0] <= ratios[1] <= ratios[2]


def test_planner_alternatives_same_city_exclude_self():
    """Alternatives must reside in the same city and exclude the chosen zone."""
    payload = {
        "zone_id": "z1",  # Main Gate Plaza in Gurugram
        "start_time": "2026-09-26T18:00:00+05:30",
        "duration_hours": 4.0,
        "event_type": "concert",
        "expected_attendance": 800,
    }
    resp = client.post("/api/v1/planner/assess", json=payload)
    assert resp.status_code == 200
    alts = resp.json()["alternatives"]

    for alt in alts:
        assert alt["zone_id"] != "z1"
        assert not alt["zone_id"].startswith("syn")


def test_planner_suggested_cap_reassessment_is_safe():
    """When an event is not_recommended, the suggested attendance cap yields peak ratio <= 0.85 when re-assessed."""
    # Market Street (z3) capacity is 900. Send 3000 attendees -> not_recommended
    payload = {
        "zone_id": "z3",
        "start_time": "2026-09-26T18:00:00+05:30",
        "duration_hours": 4.0,
        "event_type": "concert",
        "expected_attendance": 3000,
    }
    resp = client.post("/api/v1/planner/assess", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["verdict"] == "not_recommended"

    # Find the mitigation containing suggested cap
    cap_mitigation = next((m for m in data["mitigations"] if "Cap attendance near" in m), None)
    assert cap_mitigation is not None

    match = re.search(r"Cap attendance near ([\d,]+) attendees", cap_mitigation)
    assert match is not None
    suggested_cap = int(match.group(1).replace(",", ""))

    # Re-assess with the suggested cap
    reassess_payload = dict(payload, expected_attendance=suggested_cap)
    reassess_resp = client.post("/api/v1/planner/assess", json=reassess_payload)
    assert reassess_resp.status_code == 200
    reassess_data = reassess_resp.json()

    # Peak ratio should be at or below ~0.85
    assert reassess_data["peak"]["occupancy_ratio"] <= 0.87
    assert reassess_data["verdict"] in ("feasible", "feasible_with_mitigations")
