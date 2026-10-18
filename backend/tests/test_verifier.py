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
    decisions = verify(candidates, facts, text, KEYS, domain="hospital")
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


@pytest.mark.parametrize("text, my_number, my_name, expected", [
    ("대기번호 12번 환자분 7번 진료실로 오세요.", "37", None, "ignored"),  # 다른 번호 → 무시
    ("김철수님 2번 진료실로 들어오세요.", "37", "홍길동", "ignored"),     # 다른 이름 → 무시
    ("12번 환자분 7번 진료실로 오세요.", None, None, "pending"),          # 내 번호를 모름 → 확인 요청
    ("37번 환자분 7번 진료실로 오세요.", "37", None, "applied"),          # 내 번호
    ("홍길동님 7번 진료실로 오세요.", None, "홍길동", "applied"),          # 내 이름
    ("진료실이 7번으로 변경되었습니다.", "37", None, "applied"),          # 아무도 부르지 않음
    ("선생님이 7번 진료실로 오시래요.", "37", None, "applied"),            # 사람 이름이 아님
])
def test_call_to_someone_else(text, my_number, my_name, expected):
    c = Candidate(key="room", value="7번", change_type="change", evidence=text, confidence=0.9)
    [d] = verify([c], {"room": "5번"}, text, KEYS, my_number=my_number, my_name=my_name)
    assert d.status == expected


def test_call_check_uses_full_sentence_when_evidence_is_cut():
    # 실제 AI가 근거를 문장 일부만 잘라 준 사례
    text = "대기번호 12번 환자분 7번 진료실로 오세요."
    c = Candidate(key="room", value="7번", change_type="change", evidence="7번 진료실로 오세요", confidence=0.9)
    [d] = verify([c], {"room": "5번"}, text, KEYS, my_number="37")
    assert d.status == "ignored"


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


def test_uncertain_words_override_ai():
    # AI가 불확실 표현을 놓치고 정정이라고 해도 확인 요청
    c = Candidate(key="visit_time", value="11시", change_type="correction", evidence="진료는 11시쯤 될 것 같아요.", confidence=0.9)
    [d] = verify([c], {"visit_time": "오전 10시"}, "진료는 11시쯤 될 것 같아요.", KEYS, domain="hospital")
    assert d.status == "pending"


@pytest.mark.parametrize("key, value", [("room", "진료실"), ("exam_time", "정정 안내")])
def test_value_pattern_mismatch_needs_confirmation(key, value):
    c = Candidate(key=key, value=value, change_type="change", evidence="안내", confidence=0.9)
    [d] = verify([c], {}, "안내", KEYS, domain="hospital")
    assert d.status == "pending"


def test_candidates_follow_text_order():
    text = "오후 2시 검사는 취소되었습니다. 대신 내일 오전 9시에 검사가 있습니다."
    new = Candidate(key="exam_time", value="오전 9시", change_type="change", evidence="대신 내일 오전 9시에 검사가 있습니다.", confidence=1.0)
    cancel = Candidate(key="exam_time", value="오후 2시", change_type="cancel", evidence="오후 2시 검사는 취소되었습니다.", confidence=1.0)
    decisions = verify([new, cancel], {"exam_time": "오후 2시"}, text, KEYS, domain="hospital")
    assert [d.candidate.change_type for d in decisions] == ["cancel", "change"]
    assert decisions[-1].status == "applied"
