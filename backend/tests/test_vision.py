"""Tests for CrowdGuard vision endpoints."""
import io
import os
import pytest
from PIL import Image

# Set mock vision environment variable before importing app
os.environ["CROWDGUARD_MOCK_VISION"] = "1"

from fastapi.testclient import TestClient
from app.main import app
from app.schemas.shared import ZONE_BY_ID
from app.services import store, detector
from app.api.v1.endpoints.vision import router as vision_router

# Ensure vision router is mounted on app for tests if Person C hasn't merged router.py yet
if not any(getattr(route, "path", "").startswith("/api/v1/vision") for route in app.routes):
    app.include_router(vision_router, prefix="/api/v1/vision", tags=["Vision"])

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_store():
    """Reset store and detector state before and after each test."""
    store.reset()
    detector.reset_detector_state()
    yield
    store.reset()
    detector.reset_detector_state()


def create_test_jpeg(width: int = 100, height: int = 100) -> bytes:
    """Helper to create valid JPEG bytes in-memory."""
    img = Image.new("RGB", (width, height), color=(128, 64, 32))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_simulate_success():
    """1. POST /api/v1/vision/simulate returns 200, echoes count, and checks density."""
    zone_id = "z1"
    person_count = 180
    expected_density = round(person_count / ZONE_BY_ID[zone_id].area_sqm, 4)

    response = client.post(
        "/api/v1/vision/simulate",
        json={"zone_id": zone_id, "person_count": person_count},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["zone_id"] == zone_id
    assert data["person_count"] == person_count
    assert data["density_per_sqm"] == expected_density
    assert data["mocked"] is True
    assert data["model_name"] == "mock"


def test_simulate_invalid_zone():
    """2. POST /api/v1/vision/simulate with zone_id='nope' returns 400."""
    response = client.post(
        "/api/v1/vision/simulate",
        json={"zone_id": "nope", "person_count": 50},
    )
    assert response.status_code == 400
    assert "Unknown zone_id" in response.json()["detail"]


def test_latest_vision_empty_then_after_simulate():
    """3. GET /api/v1/vision/latest/z1 returns 404 before anything is stored, then 200 after simulate."""
    # 404 before anything is stored
    empty_resp = client.get("/api/v1/vision/latest/z1")
    assert empty_resp.status_code == 404
    assert "No vision readings found" in empty_resp.json()["detail"]

    # Store a reading via simulate
    sim_resp = client.post(
        "/api/v1/vision/simulate",
        json={"zone_id": "z1", "person_count": 42},
    )
    assert sim_resp.status_code == 200

    # Now 200 returned
    latest_resp = client.get("/api/v1/vision/latest/z1")
    assert latest_resp.status_code == 200
    data = latest_resp.json()
    assert data["zone_id"] == "z1"
    assert data["person_count"] == 42


def test_analyze_image_mock():
    """4. POST /api/v1/vision/analyze with small generated JPEG returns 200 and mocked: true."""
    jpeg_bytes = create_test_jpeg(200, 200)

    response = client.post(
        "/api/v1/vision/analyze",
        data={"zone_id": "z1"},
        files={"file": ("test.jpg", jpeg_bytes, "image/jpeg")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["zone_id"] == "z1"
    assert data["mocked"] is True
    assert data["person_count"] > 0
    assert "density_per_sqm" in data
    assert "flow" in data
    assert data["confidence"] > 0.0


def test_analyze_invalid_file_upload():
    """5. POST /api/v1/vision/analyze with a text file returns 400."""
    text_content = b"This is a plain text file, not an image."

    response = client.post(
        "/api/v1/vision/analyze",
        data={"zone_id": "z1"},
        files={"file": ("notes.txt", text_content, "text/plain")},
    )
    assert response.status_code == 400
    assert "Invalid or undecodable image" in response.json()["detail"]


def test_vision_history_limit_and_order():
    """6. GET /api/v1/vision/history/z1?limit=5 returns at most 5 readings, oldest first."""
    # Insert 8 readings
    for count in range(10, 90, 10):
        client.post(
            "/api/v1/vision/simulate",
            json={"zone_id": "z1", "person_count": count},
        )

    response = client.get("/api/v1/vision/history/z1?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert data["zone_id"] == "z1"
    assert data["count"] == 5
    readings = data["readings"]
    assert len(readings) == 5

    # Check oldest-first ordering: 40, 50, 60, 70, 80
    counts = [r["person_count"] for r in readings]
    assert counts == [40, 50, 60, 70, 80]


def test_simulate_occluded_and_risk_live():
    """7. POST /api/v1/vision/simulate with occluded=True records camera reading and reflects in /risk/live/z3."""
    response = client.post(
        "/api/v1/vision/simulate",
        json={"zone_id": "z3", "count": 40, "occluded": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["zone_id"] == "z3"
    assert data["person_count"] == 40
    assert data["mocked"] is True

    # Confirm /risk/live/z3 reflects camera reading
    risk_resp = client.get("/api/v1/risk/live/z3")
    assert risk_resp.status_code == 200
    risk_data = risk_resp.json()
    assert risk_data["zone_id"] == "z3"
    assert risk_data["vision"] is not None
    assert risk_data["vision"]["person_count"] == 40

