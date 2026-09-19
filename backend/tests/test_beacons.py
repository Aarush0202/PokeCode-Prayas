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
