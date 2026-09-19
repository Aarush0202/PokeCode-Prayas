"""Tests for CrowdGuard Attention Panel engine and endpoints (Person C)."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.shared import ZONE_BY_ID, RiskTier, Zone
from app.services import attention, forecaster, store

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_state():
    """Ensure clean store and attention state before every test."""
    store.reset()
    attention.reset_attention_state()
    yield
    store.reset()
    attention.reset_attention_state()


def test_attention_endpoint_structure():
    """GET /api/v1/attention returns correct envelope, counts, and groups."""
    resp = client.get("/api/v1/attention")
    assert resp.status_code == 200
    data = resp.json()

    assert "generated_at" in data
    assert "counts" in data
    assert "groups" in data
    assert "items" in data

    counts = data["counts"]
    assert "total" in counts
    assert "act_now" in counts
    assert "watch_soon" in counts
    assert "needs_checking" in counts

    groups = data["groups"]
    assert "act_now" in groups
    assert "watch_soon" in groups
    assert "needs_checking" in groups
    assert isinstance(groups["act_now"], list)
    assert isinstance(groups["watch_soon"], list)
    assert isinstance(groups["needs_checking"], list)


def test_needs_checking_empty_store_contains_only_instrumented_zones():
    """Empty store flags instrumented zones (z1-z4) in needs_checking, and never named places."""
    resp = client.get("/api/v1/attention")
    assert resp.status_code == 200
    data = resp.json()

    needs_checking = data["groups"]["needs_checking"]
    # Only instrumented zones z1-z4 should appear
    zone_ids = [item["zone_id"] for item in needs_checking]
    assert set(zone_ids) == {"z1", "z2", "z3", "z4"}
    assert len(needs_checking) <= 5

    for item in needs_checking:
        assert item["category"] == "needs_checking"
        assert item["level"] == "no_data" or item["signal_status"] in ("stale", "none")


def test_named_places_never_appear_in_needs_checking():
    """Named/held-out places (ch01, etc.) must NEVER appear in needs_checking under any store state."""
    from app.data.named_places import NAMED_PLACES
    named_place_ids = {np.id for np in NAMED_PLACES}

    resp = client.get("/api/v1/attention")
    assert resp.status_code == 200
    data = resp.json()

    needs_checking_ids = {item["zone_id"] for item in data["groups"]["needs_checking"]}
    # Intersection must be completely empty
    intersection = named_place_ids.intersection(needs_checking_ids)
    assert len(intersection) == 0, f"Named places appeared in needs_checking: {intersection}"


def test_group_cap_enforces_maximum_5_items(monkeypatch):
    """Even if >5 zones qualify for a category, only top 5 highest urgency items are returned."""
    from app.schemas.shared import ZoneRisk
    from app.services import fusion

    # Mock evaluate_all_zones returning 8 zones qualifying for act_now
    dummy_risks = [
        ZoneRisk(
            zone_id=f"z{i}",
            zone_name=f"Test Zone {i}",
            timestamp=datetime.now(timezone.utc),
            risk_score=0.70 + (i * 0.02),
            risk_tier=RiskTier.HIGH,
            level=RiskTier.HIGH,
            fused_estimate=700,
            occupancy=0.75,
            capacity=1000,
            reasons=["Surge test"],
            has_live_signals=True,
            signal_status="ok",
        )
        for i in range(1, 9)
    ]

    monkeypatch.setattr(fusion, "evaluate_all_zones", lambda: dummy_risks)
    monkeypatch.setattr(attention, "ZONE_BY_ID", {f"z{i}": None for i in range(1, 9)})

    resp = client.get("/api/v1/attention")
    assert resp.status_code == 200
    data = resp.json()

    act_now = data["groups"]["act_now"]
    assert len(act_now) == 5
    assert data["counts"]["act_now"] == 5

    # Confirm it kept the top 5 highest risk_score
    scores = [item["risk_score"] for item in act_now]
    assert scores == sorted(scores, reverse=True)


def test_act_now_on_critical_crowd_surge():
    """Live crowd surge breaching capacity triggers act_now with observed=True."""
    # z3 (Market Street) capacity is 900. Ingest 850 occupants (~94% occupancy)
    client.post("/api/v1/beacons/ingest", json={"zone_id": "z3", "unique_devices": 850})
    client.post("/api/v1/vision/simulate", json={"zone_id": "z3", "person_count": 850})

    resp = client.get("/api/v1/attention")
    assert resp.status_code == 200
    data = resp.json()

    act_now = data["groups"]["act_now"]
    z3_item = next((item for item in act_now if item["zone_id"] == "z3"), None)
    assert z3_item is not None
    assert z3_item["category"] == "act_now"
    assert z3_item["priority"] in (1, 2)
    assert z3_item["observed"] is True  # Live sensor observation
    assert z3_item["occupancy"] >= 0.85
    assert "CRITICAL" in z3_item["title"] or "High" in z3_item["title"]


def test_watch_soon_on_elevated_density():
    """Zone with elevated risk tier (40-65% occupancy) lands in watch_soon."""
    # z2 (Metro Concourse) capacity is 600. Ingest 300 occupants (50% occupancy)
    client.post("/api/v1/beacons/ingest", json={"zone_id": "z2", "unique_devices": 300})
    client.post("/api/v1/vision/simulate", json={"zone_id": "z2", "person_count": 300})

    resp = client.get("/api/v1/attention")
    assert resp.status_code == 200
    data = resp.json()

    watch_soon = data["groups"]["watch_soon"]
    z2_item = next((item for item in watch_soon if item["zone_id"] == "z2"), None)
    assert z2_item is not None
    assert z2_item["category"] == "watch_soon"
    assert z2_item["observed"] is True


def test_sensor_divergence_triggers_needs_checking():
    """Camera and BLE divergence exceeding 50% capacity flags needs_checking."""
    # z1 capacity is 400. Ingest 320 on camera but only 20 on BLE (discrepancy = 300 > 200)
    client.post("/api/v1/beacons/ingest", json={"zone_id": "z1", "unique_devices": 20})
    client.post("/api/v1/vision/simulate", json={"zone_id": "z1", "person_count": 320})

    resp = client.get("/api/v1/attention")
    assert resp.status_code == 200
    data = resp.json()

    needs_checking = data["groups"]["needs_checking"]
    z1_item = next((item for item in needs_checking if item["zone_id"] == "z1"), None)
    assert z1_item is not None
    assert "Divergence" in z1_item["title"]


def test_operator_acknowledge_flow():
    """Operator can acknowledge active attention item and have state persist."""
    client.post("/api/v1/beacons/ingest", json={"zone_id": "z3", "unique_devices": 850})
    client.post("/api/v1/vision/simulate", json={"zone_id": "z3", "person_count": 850})

    ack_resp = client.post("/api/v1/attention/acknowledge", json={"zone_id": "z3"})
    assert ack_resp.status_code == 200
    assert ack_resp.json()["success"] is True

    att = client.get("/api/v1/attention").json()
    z3_item = next(item for item in att["items"] if item["zone_id"] == "z3")
    assert z3_item["acknowledged"] is True


def test_operator_snooze_and_critical_escalation():
    """Snoozing suppresses an alert unless escalated to CRITICAL hazard."""
    # Step 1: Set z2 to elevated (300/600) -> watch_soon
    client.post("/api/v1/beacons/ingest", json={"zone_id": "z2", "unique_devices": 300})
    client.post("/api/v1/vision/simulate", json={"zone_id": "z2", "person_count": 300})

    att_pre = client.get("/api/v1/attention").json()
    assert any(i["zone_id"] == "z2" for i in att_pre["items"])

    # Step 2: Snooze z2 for 30 minutes
    snooze_resp = client.post("/api/v1/attention/snooze", json={"zone_id": "z2", "minutes": 30})
    assert snooze_resp.status_code == 200

    # Verify z2 is excluded while snoozed
    att_snoozed = client.get("/api/v1/attention").json()
    assert not any(i["zone_id"] == "z2" for i in att_snoozed["items"])

    # Step 3: Critical surge hits z2 (580/600 = 96%) -> should break snooze
    client.post("/api/v1/beacons/ingest", json={"zone_id": "z2", "unique_devices": 580})
    client.post("/api/v1/vision/simulate", json={"zone_id": "z2", "person_count": 580})

    att_post = client.get("/api/v1/attention").json()
    z2_escalated = next((i for i in att_post["groups"]["act_now"] if i["zone_id"] == "z2"), None)
    assert z2_escalated is not None
    assert z2_escalated["category"] == "act_now"


def test_baseline_ratio_series_exists_and_works():
    """Confirms forecaster.baseline_ratio_series exists and returns valid ratios."""
    assert hasattr(forecaster, "baseline_ratio_series")
    zone = ZONE_BY_ID["z1"]
    now = datetime.now(timezone.utc)
    timestamps = [now + timedelta(hours=i) for i in range(5)]
    ratios = forecaster.baseline_ratio_series(zone, timestamps)
    assert len(ratios) == 5
    for r in ratios:
        assert isinstance(r, float)
        assert 0.0 <= r <= 1.0
