from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_sample_data():
    response = client.get("/api/v1/demo/sample")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "processed_message" in data[0]


def test_process_demo_message_success():
    payload = {"message": "PokeCode hackathon deployment test", "tag": "test"}
    response = client.post("/api/v1/demo/process", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["original_message"] == "PokeCode hackathon deployment test"
    assert data["processed_message"] == "POKECODE HACKATHON DEPLOYMENT TEST"
    assert data["word_count"] == 4
    assert data["tag"] == "test"


def test_process_demo_message_empty_fail():
    payload = {"message": "   "}
    response = client.post("/api/v1/demo/process", json=payload)
    assert response.status_code == 400
