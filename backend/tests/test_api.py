import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["LLM_PROVIDER"] = "mock"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def test_full_flow():
    s = client.post("/api/sessions", json={"title": "테스트 병원", "domain": "hospital"}).json()
    sid = s["id"]

    r1 = client.post(f"/api/sessions/{sid}/announcements", json={"text": "진료실은 3번입니다."}).json()
    assert r1["changes"][0]["status"] == "applied"

    r2 = client.post(f"/api/sessions/{sid}/announcements", json={"text": "아마 진료실이 5번일 거예요."}).json()
    assert r2["needs_confirmation"] is True
    change_id = r2["changes"][0]["id"]

    confirmed = client.post(f"/api/changes/{change_id}/confirm", json={"approve": True}).json()
    assert confirmed["status"] == "applied"

    session = client.get(f"/api/sessions/{sid}").json()
    assert session["facts"][0]["value"] == "5번"
    assert len(client.get(f"/api/sessions/{sid}/history").json()) == 2
