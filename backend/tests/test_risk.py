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
    """Returns 200 with all 4 zones in NO_DATA state when store has no live sensor data."""
    resp = client.get("/api/v1/risk/live")
    assert resp.status_code == 200
    data = resp.json()
    assert "zones" in data
    assert len(data["zones"]) == 4

    for z in data["zones"]:
        assert z["risk_tier"] == RiskTier.NO_DATA.value
        assert z["level"] == "no_data"


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
    """Vision signal older than 120s is treated as stale and gives no_data."""
    ten_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=10)
    store.add_vision(
        VisionSignal(
            zone_id="z1",
            timestamp=ten_minutes_ago,
            person_count=350,
            density_per_sqm=350 / 500.0,
            confidence=0.95,
        )
    )

    resp = client.get("/api/v1/risk/live/z1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["vision"] is None
    assert data["risk_tier"] == RiskTier.NO_DATA.value
    assert data["level"] == "no_data"
    assert data["signal_status"] == "stale"


def test_risk_alerts_empty_and_active():
    """Alerts list contains no elevated warnings on fresh start, and alerts when zone escalates."""
    # Ingest large beacon reading in z1 (capacity 400)
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


def test_named_place_live_risk_returns_no_data():
    """Named place ch01 has no sensors, returns 200 with level=no_data, has_live_signals=False."""
    resp = client.get("/api/v1/risk/live/ch01")
    assert resp.status_code == 200
    data = resp.json()
    assert data["zone_id"] == "ch01"
    assert data["level"] == "no_data"
    assert data["risk_tier"] == "no_data"
    assert data["has_live_signals"] is False
    assert data["signal_status"] == "none"
    assert "forecast_pressure" in data


def test_pure_fusion_function():
    """Verifies pure fuse() behavior across agreeing, diverging, and single-sensor conditions."""
    from app.schemas.shared import ZONES, Zone
    from app.services.fusion import fuse

    zone = ZONES[0]  # z1 capacity 400
    now = datetime(2026, 9, 19, 12, 0, 0, tzinfo=timezone.utc)

    # 1. Agreeing sensors: 0.60/0.40 blend
    cam = VisionSignal(zone_id="z1", timestamp=now, person_count=100, density_per_sqm=0.2)  # ratio 0.25
    ble = store.BeaconSignal(zone_id="z1", timestamp=now, unique_devices=60)  # 60*1.6 = 96, ratio 0.24
    risk = fuse(zone, cam, ble, forecast_pressure=0.0, now=now)
    assert risk.signal_status == "ok"
    assert risk.risk_tier == RiskTier.NORMAL

    # 2. Diverging sensors > 0.25 divergence takes max
    cam_low = VisionSignal(zone_id="z1", timestamp=now, person_count=40, density_per_sqm=0.08)  # 10%
    ble_high = store.BeaconSignal(zone_id="z1", timestamp=now, unique_devices=200)  # 320/400 = 80%
    risk_div = fuse(zone, cam_low, ble_high, forecast_pressure=0.0, now=now)
    assert risk_div.fused_estimate >= 320
    assert any("disagree" in r for r in risk_div.reasons)

    # 3. Single-sensor-offline camera only
    risk_cam_only = fuse(zone, cam, None, forecast_pressure=0.0, now=now)
    assert risk_cam_only.fused_estimate == 100
    assert any("Bluetooth scanner offline" in r for r in risk_cam_only.reasons)

    # 4. Single-sensor-offline BLE only
    risk_ble_only = fuse(zone, None, ble, forecast_pressure=0.0, now=now)
    assert risk_ble_only.fused_estimate == round(60 * 1.6)
    assert any("camera feed unavailable" in r for r in risk_ble_only.reasons)


def test_ble_calibration_updates_and_gates():
    """Calibration updates EWMA under agreement, clamps, and is gated against surge/divergence."""
    from app.schemas.shared import ZONES
    from app.services import fusion

    fusion.reset_calibration()
    now = datetime.now(timezone.utc)

    # 1. Agreeing signals above count 20 -> updates scale
    cam = VisionSignal(zone_id="z1", timestamp=now, person_count=100, density_per_sqm=0.2)
    # ble with 50 devices * 1.6 = 80. cam/ble_count = 100/80 = 1.25
    ble = store.BeaconSignal(zone_id="z1", timestamp=now, unique_devices=50)

    new_scale = fusion.update_calibration("z1", cam, ble, capacity=400, is_surging=False, now=now)
    assert new_scale > 1.0  # moved toward 1.25

    # 2. Gate: Surge in progress -> must NOT update
    prev_scale = new_scale
    fusion.update_calibration("z1", cam, ble, capacity=400, is_surging=True, now=now)
    assert fusion.get_ble_scale("z1") == prev_scale

    # 3. Gate: Divergence > 0.25 -> must NOT update
    ble_divergent = store.BeaconSignal(zone_id="z1", timestamp=now, unique_devices=220)  # >0.25 diff
    fusion.update_calibration("z1", cam, ble_divergent, capacity=400, is_surging=False, now=now)
    assert fusion.get_ble_scale("z1") == prev_scale

