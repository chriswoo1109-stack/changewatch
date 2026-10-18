"""대기 모드(/listen) 흐름 테스트. 음성 인식은 가짜 함수로 바꿔서 실제 OpenAI를 호출하지 않습니다."""

import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["LLM_PROVIDER"] = "mock"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import listen_service, stt_service  # noqa: E402

client = TestClient(app)
AUDIO = b"x" * 2048


def fake_stt(monkeypatch, text, calls=None):
    def _fake(filename, data, content_type, domain="hospital", prev_text=None):
        if calls is not None:
            calls.append(prev_text)
        return text

    monkeypatch.setattr(stt_service, "transcribe_raw", _fake)


def listen(sid, prev_text=None, audio=AUDIO):
    data = {"prev_text": prev_text} if prev_text else {}
    return client.post(f"/api/sessions/{sid}/listen", files={"file": ("a.webm", audio, "audio/webm")}, data=data).json()


def new_session(**kw):
    return client.post("/api/sessions", json={"title": "대기", **kw}).json()["id"]


def test_my_turn_without_ai_analysis(monkeypatch):
    fake_stt(monkeypatch, "37번 환자분 접수 창구로 와 주세요.")
    r = listen(new_session(my_number="37"))
    assert r["my_turn"]["matched"] == "37번"
    assert r["analysis"] is None  # 안내 키워드가 없으면 AI 분석 생략


def test_announcement_keyword_triggers_analysis(monkeypatch):
    fake_stt(monkeypatch, "진료실이 5번으로 변경되었습니다.")
    r = listen(new_session())
    assert r["analysis"]["changes"][0]["key"] == "room"


def test_hallucination_and_tiny_chunk_skipped(monkeypatch):
    sid = new_session()
    fake_stt(monkeypatch, "시청해 주셔서 감사합니다.")
    assert listen(sid)["skipped"] is True
    assert listen(sid, audio=b"x")["skipped"] is True


def test_overlap_with_previous_chunk_removed(monkeypatch):
    calls = []
    fake_stt(monkeypatch, "진료실은 3번입니다. 처방전은 약국에 제출하세요.", calls)
    r = listen(new_session(), prev_text="안녕하세요. 진료실은 3번입니다.")
    assert r["text"] == "처방전은 약국에 제출하세요."
    assert calls == ["안녕하세요. 진료실은 3번입니다."]  # 직전 텍스트를 음성 인식에 넘김


def test_clean_text_keeps_new_sentences():
    assert listen_service.clean_text("A입니다. B입니다.", None) == "A입니다. B입니다."
