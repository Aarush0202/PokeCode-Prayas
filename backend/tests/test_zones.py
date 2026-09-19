from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_list_zones():
    resp = client.get("/api/v1/zones")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 4
    assert len(data["zones"]) == data["count"]
    zone_ids = [z["id"] for z in data["zones"]]
    assert "z1" in zone_ids
    assert "z3" in zone_ids
    assert "ch01" in zone_ids
    for zid in zone_ids:
        assert not zid.startswith("syn")


def test_get_zone_by_id_success():
    resp = client.get("/api/v1/zones/z1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "z1"
    assert data["name"] == "Main Gate Plaza"
    assert data["capacity"] == 400


def test_get_named_place_success():
    resp = client.get("/api/v1/zones/ch01")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "ch01"
    assert data["name"] == "Chandni Chowk"
    assert data["capacity"] == 5000


def test_get_zone_by_id_not_found():
    resp = client.get("/api/v1/zones/nope")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()

