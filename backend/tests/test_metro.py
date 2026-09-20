"""Unit tests for Delhi Metro Operations endpoints."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_metro_status():
    response = client.get("/api/v1/metro/status")
    assert response.status_code == 200
    data = response.json()
    assert data["system_name"] == "Delhi Metro Rail Corporation (DMRC)"
    assert len(data["lines"]) >= 4
    assert len(data["stations"]) >= 6


def test_get_metro_lines():
    response = client.get("/api/v1/metro/lines")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert any(line["id"] == "yellow" for line in data)


def test_get_metro_stations():
    response = client.get("/api/v1/metro/stations")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert any(st["station_id"] == "dm_z1" for st in data)
