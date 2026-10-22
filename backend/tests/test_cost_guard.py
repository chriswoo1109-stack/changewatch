"""OpenAI 요금 보호: 글자 수·접속당 호출 횟수·하루 AI 호출 총량. (실제 OpenAI는 호출하지 않음)"""

import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["LLM_PROVIDER"] = "mock"

import openai  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402
from app.services import llm_extractor  # noqa: E402

client = TestClient(app)


def new_session():
    return client.post("/api/sessions", json={"title": "요금 보호"}).json()["id"]


def analyze(sid, text="진료실은 3번입니다.", ip="1.1.1.1"):
    return client.post(f"/api/sessions/{sid}/announcements", json={"text": text}, headers={"X-Forwarded-For": ip})


def test_too_long_text_rejected(monkeypatch):
    monkeypatch.setattr(settings, "max_text_chars", 10)
    r = analyze(new_session(), text="진료실은 3번입니다. 검사는 오후 2시입니다.")
    assert r.status_code == 413
    assert "너무 길어요" in r.json()["detail"]


def test_rate_limit_per_ip(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_per_minute", 2)
    sid = new_session()
    assert analyze(sid).status_code == 200
    assert analyze(sid).status_code == 200
    r = analyze(sid)
    assert r.status_code == 429
    assert "1분 뒤" in r.json()["detail"]
    # 다른 접속은 영향 없음
    assert analyze(sid, ip="2.2.2.2").status_code == 200


def test_daily_ai_limit_falls_back_to_mock(monkeypatch):
    calls = []

    class FakeOpenAI(llm_extractor.OpenAIExtractor):
        def __init__(self):
            pass

        def extract(self, *args):
            calls.append(args)
            raise AssertionError("한도를 넘었는데 AI를 불렀습니다")

    monkeypatch.setattr(settings, "ai_daily_limit", 0)
    monkeypatch.setattr(llm_extractor, "get_extractor", lambda: FakeOpenAI())
    r = analyze(new_session())
    assert r.status_code == 200  # 모의 분석기로 대체되어 시연은 계속됨
    assert r.json()["changes"][0]["new_value"] == "3번"
    assert calls == []


def test_daily_ai_limit_blocks_transcribe(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "test-key")
    monkeypatch.setattr(settings, "ai_daily_limit", 0)
    monkeypatch.setattr(openai, "OpenAI", lambda **kw: (_ for _ in ()).throw(AssertionError("호출되면 안 됨")))
    r = client.post(f"/api/sessions/{new_session()}/transcribe", files={"file": ("a.webm", b"x", "audio/webm")})
    assert r.status_code == 429
    assert "텍스트로 입력" in r.json()["detail"]
