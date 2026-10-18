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


def test_todos_flow():
    sid = client.post("/api/sessions", json={"title": "할 일"}).json()["id"]
    text = "처방전은 1층 약국에 제출하세요."

    r = client.post(f"/api/sessions/{sid}/announcements", json={"text": text}).json()
    assert [t["text"] for t in r["todos"]] == ["처방전은 1층 약국에 제출하세요"]
    todo_id = r["todos"][0]["id"]

    # 같은 안내를 다시 들어도 할 일이 중복으로 생기지 않는다
    again = client.post(f"/api/sessions/{sid}/announcements", json={"text": text}).json()
    assert again["todos"] == []

    checked = client.patch(f"/api/todos/{todo_id}", json={"done": True}).json()
    assert checked["done"] is True
    assert client.get(f"/api/sessions/{sid}").json()["todos"][0]["done"] is True
    assert client.patch("/api/todos/999999", json={"done": True}).status_code == 404


def test_my_turn():
    sid = client.post("/api/sessions", json={"title": "내 차례", "my_number": "37"}).json()["id"]

    def call(text):
        return client.post(f"/api/sessions/{sid}/announcements", json={"text": text}).json()["my_turn"]

    assert call("137번 환자분 들어오세요.") is None
    assert call("370번 환자분 들어오세요.") is None
    assert call("37번 환자분 3번 진료실로 오세요.") == {"matched": "37번", "evidence": "37번 환자분 3번 진료실로 오세요."}

    # 방문 중에 번호를 바꾸거나 이름을 추가할 수 있다
    s = client.patch(f"/api/sessions/{sid}", json={"my_number": "", "my_name": "홍길동"}).json()
    assert (s["my_number"], s["my_name"]) == (None, "홍길동")
    assert call("37번 환자분 들어오세요.") is None
    assert call("홍길동님 2번 진료실로 오세요.")["matched"] == "홍길동"
