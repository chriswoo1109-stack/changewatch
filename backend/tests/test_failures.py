"""AI·음성 인식이 실패해도 시연이 멈추지 않는지 확인합니다. (실제 OpenAI는 호출하지 않음)"""

import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["LLM_PROVIDER"] = "mock"

import openai  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402
from app.services import llm_extractor  # noqa: E402

client = TestClient(app)


class BrokenExtractor:
    def extract(self, text, domain, facts):
        raise RuntimeError("AI 서버 응답 없음")


class BrokenOpenAI:
    def __init__(self, **kwargs):
        self.audio = self

    @property
    def transcriptions(self):
        return self

    def create(self, **kwargs):
        raise RuntimeError("한도 초과")


def new_session():
    return client.post("/api/sessions", json={"title": "실패 테스트"}).json()["id"]


def test_ai_failure_falls_back_to_mock(monkeypatch):
    monkeypatch.setattr(llm_extractor, "get_extractor", lambda: BrokenExtractor())
    r = client.post(f"/api/sessions/{new_session()}/announcements", json={"text": "진료실은 3번입니다."})
    assert r.status_code == 200
    assert r.json()["changes"][0]["new_value"] == "3번"


def test_stt_failure_returns_korean_message(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "test-key")
    monkeypatch.setattr(openai, "OpenAI", BrokenOpenAI)
    r = client.post(f"/api/sessions/{new_session()}/transcribe", files={"file": ("a.webm", b"x", "audio/webm")})
    assert r.status_code == 502
    assert "음성 인식에 실패" in r.json()["detail"]


def test_stt_empty_file(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "test-key")
    r = client.post(f"/api/sessions/{new_session()}/transcribe", files={"file": ("a.webm", b"", "audio/webm")})
    assert r.status_code == 400
