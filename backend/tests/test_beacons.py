import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services import store

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_store():
    store.reset()
    yield
    store.reset()


def test_beacons_ingest_and_latest():
    # 1. Latest returns 404 before any ingest
    res_before = client.get("/api/v1/beacons/latest/z1")
    assert res_before.status_code == 404

    # 2. Ingest valid beacon reading
    payload = {
        "zone_id": "z1",
        "unique_devices": 57,
        "scanner_id": "pi-gate-1",
    }
    res_ingest = client.post("/api/v1/beacons/ingest", json=payload)
    assert res_ingest.status_code == 200
    data = res_ingest.json()
    assert data["accepted"] is True
    assert data["zone_id"] == "z1"
    assert data["stored_readings"] == 1

    # 3. Latest returns 200 after ingest
    res_after = client.get("/api/v1/beacons/latest/z1")
    assert res_after.status_code == 200
    after_data = res_after.json()
    assert after_data["zone_id"] == "z1"
    assert after_data["unique_devices"] == 57
    assert after_data["scanner_id"] == "pi-gate-1"


def test_beacons_ingest_unknown_zone():
    payload = {
        "zone_id": "z_unknown",
        "unique_devices": 10,
    }
    resp = client.post("/api/v1/beacons/ingest", json=payload)
    assert resp.status_code == 400
    assert "unknown zone_id" in resp.json()["detail"].lower()


def test_beacons_ingest_negative_devices_validation():
    payload = {
        "zone_id": "z1",
        "unique_devices": -5,
    }
    resp = client.post("/api/v1/beacons/ingest", json=payload)
    assert resp.status_code == 422


def test_beacons_history():
    for count in [10, 20, 30]:
        client.post(
            "/api/v1/beacons/ingest",
            json={"zone_id": "z2", "unique_devices": count},
        )

    resp = client.get("/api/v1/beacons/history/z2?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert data["zone_id"] == "z2"
    assert data["count"] == 3
    assert len(data["readings"]) == 3
    assert data["readings"][0]["unique_devices"] == 10
    assert data["readings"][-1]["unique_devices"] == 30


def test_beacons_ingest_rejects_raw_mac():
    """Ingest endpoint rejects payloads with raw hardware MAC addresses for privacy protection."""
    # Colon-separated MAC
    resp1 = client.post(
        "/api/v1/beacons/ingest",
        json={"zone_id": "z1", "unique_devices": 15, "device_id": "00:1A:2B:3C:4D:5E"},
    )
    assert resp1.status_code == 422
    assert "raw hardware mac address" in resp1.json()["detail"].lower()

    # Hyphen-separated MAC in scanner_id
    resp2 = client.post(
        "/api/v1/beacons/ingest",
        json={"zone_id": "z1", "unique_devices": 15, "scanner_id": "AA-BB-CC-DD-EE-FF"},
    )
    assert resp2.status_code == 422
    assert "raw hardware mac address" in resp2.json()["detail"].lower()


def test_hash_mac_properties():
    """Verifies pure hash_mac behavior: length 12, deterministic with same salt, distinct with different salt."""
    import sys
    from pathlib import Path
    root = Path(__file__).resolve().parent.parent.parent
    sys.path.insert(0, str(root))
    from tools.ble_scanner import hash_mac

    mac = "00:11:22:33:44:55"
    salt1 = b"salt_alpha_12345"
    salt2 = b"salt_beta_678901"

    h1a = hash_mac(mac, salt1)
    h1b = hash_mac(mac, salt1)
    h2 = hash_mac(mac, salt2)

    assert len(h1a) == 12
    assert h1a == h1b
    assert h1a != h2

