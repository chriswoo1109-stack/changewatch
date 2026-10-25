"""여러 문장을 문장마다 따로 AI에 물어보는지 확인합니다. (실제 OpenAI는 호출하지 않음)

한꺼번에 주면 AI가 항목마다 최종 결과 하나로 묶어 단순 언급·다른 사람 호출·불확실 판단이 사라졌습니다.
"""

import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["LLM_PROVIDER"] = "mock"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.schemas.analysis import Candidate, ExtractionResult  # noqa: E402
from app.services import llm_extractor  # noqa: E402

client = TestClient(app)

ANSWERS = {  # 판단할 문장 → 가짜 AI 답
    "진료실은 3번입니다.": ("new", "3번"),
    "5번 진료실은 지금 사람이 많습니다.": ("mention", "5번"),
    "12번 환자분 5번 진료실로 오세요.": ("mention", "5번"),
    "삼십칠 번 환자분, 진료실이 7번으로 변경되었습니다.": ("change", "7번"),
    "아마 진료실이 9번일 거예요.": ("uncertain", "9번"),
}


class FakeOpenAI(llm_extractor.OpenAIExtractor):
    def __init__(self):
        self.prompts = []

    def extract(self, text, domain, facts, my_number=None, my_name=None):
        self.prompts.append(text)
        marker = "[이번에 판단할 문장]\n"
        target = text.split(marker)[1].split("\n")[0] if marker in text else text
        kind, value = ANSWERS[target]
        # 실제 AI처럼 다른 문장 후보를 섞어 줘도 버려지는지 확인
        noise = Candidate(key="room", value="1번", change_type="change", evidence="진료실은 3번입니다.", confidence=0.9)
        own = Candidate(key="room", value=value, change_type=kind, evidence=target, confidence=0.9)
        return ExtractionResult(candidates=[noise, own] if target != "진료실은 3번입니다." else [own])


def test_each_sentence_is_judged_separately(monkeypatch):
    fake = FakeOpenAI()
    monkeypatch.setattr(llm_extractor, "get_extractor", lambda: fake)
    sid = client.post("/api/sessions", json={"title": "한 번에 듣기", "my_number": "37"}).json()["id"]

    r = client.post(f"/api/sessions/{sid}/announcements", json={"text": "\n".join(ANSWERS)}).json()

    assert len(fake.prompts) == len(ANSWERS)  # 문장마다 한 번씩
    assert [(c["change_type"], c["status"]) for c in r["changes"]] == [
        ("new", "applied"), ("mention", "ignored"), ("mention", "ignored"),
        ("change", "applied"), ("uncertain", "pending"),
    ]
    assert r["needs_confirmation"] is True
    room = [f["value"] for f in client.get(f"/api/sessions/{sid}").json()["facts"] if f["key"] == "room"]
    assert room == ["7번"]


def test_single_sentence_is_one_call(monkeypatch):
    fake = FakeOpenAI()
    monkeypatch.setattr(llm_extractor, "get_extractor", lambda: fake)
    sid = client.post("/api/sessions", json={"title": "한 문장"}).json()["id"]
    client.post(f"/api/sessions/{sid}/announcements", json={"text": "진료실은 3번입니다."})
    assert len(fake.prompts) == 1 and "[이번에 판단할 문장]" not in fake.prompts[0]
