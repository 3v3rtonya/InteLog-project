from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_health_reports_database_status(monkeypatch):
    monkeypatch.setattr("backend.main.get_db_status", lambda: {"available": False, "error": "database missing"})

    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "degraded"
    assert payload["database"]["available"] is False
    assert payload["database"]["error"] == "database missing"
