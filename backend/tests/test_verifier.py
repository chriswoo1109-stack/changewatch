"""변경 판단 테스트. C(AI 엔진 담당)가 문장을 계속 추가하면서 정확도를 측정합니다.

실행: pytest -v
"""

import json
from pathlib import Path

import pytest

from app.domains import item_labels
from app.schemas.analysis import Candidate
from app.services.llm_extractor import MockExtractor
from app.services.verifier import verify

CASES = json.loads((Path(__file__).parent / "fixtures" / "sentences.json").read_text(encoding="utf-8"))
KEYS = set(item_labels("hospital"))


def run(facts: dict, text: str) -> tuple[dict, dict]:
    candidates = MockExtractor().extract(text, "hospital", facts).candidates
    decisions = verify(candidates, facts, text, KEYS)
    after = dict(facts)
    statuses = {}
    for d in decisions:
        statuses[d.candidate.key] = d.status
        if d.status == "applied":
            if d.candidate.change_type == "cancel":
                after.pop(d.candidate.key, None)
            else:
                after[d.candidate.key] = d.candidate.value
    return statuses, after


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_sentence_cases(case):
    statuses, after = run(case["facts"], case["text"])
    for key, (status, value) in case["expect"].items():
        assert statuses.get(key) == status
        assert after.get(key) == value


def test_rejects_evidence_not_in_text():
    fake = Candidate(key="room", value="7번", change_type="change", evidence="진료실이 7번으로 바뀌었습니다", confidence=0.95)
    [d] = verify([fake], {"room": "3번"}, "진료실은 3번입니다.", KEYS)
    assert d.status == "pending"


def test_low_confidence_needs_confirmation():
    c = Candidate(key="room", value="5번", change_type="change", evidence="진료실이 5번입니다", confidence=0.4)
    [d] = verify([c], {"room": "3번"}, "진료실이 5번입니다", KEYS)
    assert d.status == "pending"
