from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.shared import RiskTier, VisionSignal
from app.services import store

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_store():
    store.reset()
    yield
    store.reset()


def test_risk_live_empty_store():
    """Returns 200 with all 4 zones even when store has no live sensor data."""
    resp = client.get("/api/v1/risk/live")
    assert resp.status_code == 200
    data = resp.json()
    assert "zones" in data
    assert len(data["zones"]) == 4

    for z in data["zones"]:
        assert z["risk_tier"] == RiskTier.NORMAL.value
        assert "no live sensor data" in z["reasons"]


def test_risk_live_rises_after_beacon_surge():
    """After a surge in beacon devices, risk tier escalates above NORMAL."""
    # z3 (Market Street) capacity is 900
    # Ingest 500 devices * 1.6 multiplier = 800 estimated people (~88% occupancy)
    client.post(
        "/api/v1/beacons/ingest",
        json={"zone_id": "z3", "unique_devices": 500},
    )

    resp = client.get("/api/v1/risk/live/z3")
    assert resp.status_code == 200
    data = resp.json()
    assert data["zone_id"] == "z3"
    assert data["risk_tier"] in [RiskTier.HIGH.value, RiskTier.CRITICAL.value, RiskTier.ELEVATED.value]
    assert data["risk_tier"] != RiskTier.NORMAL.value
    assert data["fused_estimate"] > 500


def test_risk_disagreement_higher_estimate_wins():
    """When camera and Bluetooth disagree by > 0.25 occupancy, higher estimate is used."""
    # z2 (Metro Concourse) capacity is 600
    # Camera sees only 60 people (10% occupancy)
    # Bluetooth detects 300 devices * 1.6 = 480 people (80% occupancy)
    now = store.utcnow()
    store.add_vision(
        VisionSignal(
            zone_id="z2",
            timestamp=now,
            person_count=60,
            density_per_sqm=60 / 450.0,
            confidence=0.9,
        )
    )
    store.add_beacon(
        store.BeaconSignal(
            zone_id="z2",
            timestamp=now,
            unique_devices=300,
            scanner_id="test-scanner",
        )
    )

    resp = client.get("/api/v1/risk/live/z2")
    assert resp.status_code == 200
    data = resp.json()

    # The higher estimate (Bluetooth ~480) should win over camera (60)
    assert data["fused_estimate"] >= 450
    assert "camera and Bluetooth counts disagree, using the higher estimate" in data["reasons"]


def test_stale_vision_signal_ignored():
    """Vision signal older than 120s is treated as stale and ignored."""
    ten_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=10)
    store.add_vision(
        VisionSignal(
            zone_id="z1",
            timestamp=ten_minutes_ago,
            person_count=350,  # high occupancy
            density_per_sqm=350 / 500.0,
            confidence=0.95,
        )
    )

    resp = client.get("/api/v1/risk/live/z1")
    assert resp.status_code == 200
    data = resp.json()
    # Since vision signal is stale, it should be ignored and zone stays NORMAL with 'no live sensor data'
    assert data["vision"] is None
    assert data["risk_tier"] == RiskTier.NORMAL.value
    assert "no live sensor data" in data["reasons"]


def test_risk_alerts_empty_and_active():
    """Alerts list is empty when NORMAL, and populated when a zone is ELEVATED/HIGH."""
    # 1. Empty store -> 0 alerts
    res_empty = client.get("/api/v1/risk/alerts")
    assert res_empty.status_code == 200
    assert len(res_empty.json()["alerts"]) == 0

    # 2. Ingest large beacon reading in z1 (capacity 400)
    # 300 devices * 1.6 = 480 people -> > 100% occupancy
    client.post(
        "/api/v1/beacons/ingest",
        json={"zone_id": "z1", "unique_devices": 300},
    )

    res_alert = client.get("/api/v1/risk/alerts")
    assert res_alert.status_code == 200
    alerts = res_alert.json()["alerts"]
    assert len(alerts) >= 1
    alert = alerts[0]
    assert alert["zone_id"] == "z1"
    assert alert["tier"] in [RiskTier.HIGH.value, RiskTier.CRITICAL.value, RiskTier.ELEVATED.value]
    assert "Main Gate Plaza at" in alert["message"]


def test_risk_live_unknown_zone_returns_400():
    resp = client.get("/api/v1/risk/live/invalid_zone_xyz")
    assert resp.status_code == 400
    assert "unknown zone_id" in resp.json()["detail"].lower()
