"""변경 판단 테스트. C(AI 엔진 담당)가 문장을 계속 추가하면서 정확도를 측정합니다.

실행: pytest -v
"""

import json
from pathlib import Path

import pytest

from app.domains import am_hours, item_labels, time_keys
from app.schemas.analysis import Candidate
from app.services.llm_extractor import MockExtractor
from app.services.verifier import verify

CASES = json.loads((Path(__file__).parent / "fixtures" / "sentences.json").read_text(encoding="utf-8"))
KEYS = set(item_labels("hospital"))
TIME = {"time_keys": time_keys("hospital"), "am_hours": am_hours("hospital")}


def run(facts: dict, text: str) -> tuple[dict, dict]:
    candidates = MockExtractor().extract(text, "hospital", facts).candidates
    decisions = verify(candidates, facts, text, KEYS, **TIME)
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


def as_list(x) -> list:
    return x if isinstance(x, list) else [x]


# mock_xfail: 모의 분석기로는 못 맞히는 문장. 실제 AI 정확도는 scripts/evaluate.py로 측정합니다.
PARAMS = [
    pytest.param(c, id=c["name"],
                 marks=pytest.mark.xfail(reason="모의 분석기 한계") if c.get("mock_xfail") else ())
    for c in CASES
]


@pytest.mark.parametrize("case", PARAMS)
def test_sentence_cases(case):
    statuses, after = run(case["facts"], case["text"])
    for key, (status, value) in case["expect"].items():
        assert statuses.get(key) in as_list(status)
        if value == "*":
            assert after.get(key)
        else:
            assert after.get(key) in as_list(value)
    # 기대하지 않은 항목이 반영되면 안 된다
    assert not [k for k, s in statuses.items() if s == "applied" and k not in case["expect"]]


def test_rejects_evidence_not_in_text():
    fake = Candidate(key="room", value="7번", change_type="change", evidence="진료실이 7번으로 바뀌었습니다", confidence=0.95)
    [d] = verify([fake], {"room": "3번"}, "진료실은 3번입니다.", KEYS)
    assert d.status == "pending"


def test_low_confidence_needs_confirmation():
    c = Candidate(key="room", value="5번", change_type="change", evidence="진료실이 5번입니다", confidence=0.4)
    [d] = verify([c], {"room": "3번"}, "진료실이 5번입니다", KEYS)
    assert d.status == "pending"


@pytest.mark.parametrize("value", ["대기 번호를 잘못 안내드렸습니다", "진료실로 들어오세요", "가" * 31])
def test_sentence_value_needs_confirmation(value):
    c = Candidate(key="room", value=value, change_type="change", evidence="진료실", confidence=0.9)
    [d] = verify([c], {"room": "3번"}, "진료실", KEYS)
    assert d.status == "pending"


def test_long_medication_value_is_ok():
    value = "하루 2회 아침저녁 식후 30분에 1정씩"
    c = Candidate(key="medication", value=value, change_type="new", evidence="약", confidence=0.9)
    [d] = verify([c], {}, "약", KEYS)
    assert d.status == "applied"
