"""발표용 비교표(scripts/report.py)의 판단 방식과 '잘못된 저장' 기준 테스트."""

import pytest

from app.domains import item_labels
from app.schemas.analysis import Candidate
from scripts.report import ai_only, basic_rules, full_verifier, same_info, wrong_saved

KEYS = set(item_labels("hospital"))


def cand(**kw) -> Candidate:
    base = {"key": "room", "value": "5번", "change_type": "change", "evidence": "진료실", "confidence": 0.9}
    return Candidate(**{**base, **kw})


def test_ai_only_follows_ai_change_type():
    text = "5번 진료실은 지금 혼잡합니다."
    [d] = ai_only([cand(evidence=text)], {"room": "3번"}, text, KEYS)
    assert d.status == "applied"  # 검증이 없으니 AI가 change라 하면 그대로 저장


def test_basic_rules_catch_fake_evidence_but_not_status_sentence():
    text = "5번 진료실은 지금 혼잡합니다."
    [fake] = basic_rules([cand(evidence="진료실이 5번으로 바뀌었습니다")], {"room": "3번"}, text, KEYS)
    assert fake.status == "pending"   # 기본 규칙 1: 근거가 원문에 없음
    [d] = basic_rules([cand(evidence=text)], {"room": "3번"}, text, KEYS)
    assert d.status == "applied"      # 상태 설명 문장은 기본 규칙으로 못 막음


def test_full_verifier_blocks_status_sentence():
    text = "5번 진료실은 지금 혼잡합니다."
    [d] = full_verifier([cand(evidence=text)], {"room": "3번"}, text, KEYS, me={})
    assert d.status == "ignored"


@pytest.mark.parametrize("key, a, b, same", [
    ("visit_time", "1시", "오후 1시", True),        # 오전/오후 보정
    ("exam_time", "오후 세 시", "오후 3시", True),  # 한글 숫자
    ("room", "5 번", "5번", True),                   # 공백
    ("room", "12번", "5번", False),
    ("room", None, None, True),
])
def test_same_info(key, a, b, same):
    assert same_info(key, a, b) is same


def test_wrong_saved_ignores_resaving_same_value():
    case = {"facts": {"room": "5번"}, "expect": {"room": [["ignored", None], "5번"]}}
    text = "진료실은 5번입니다."
    decisions = ai_only([cand(value="5번", change_type="new", evidence=text)], case["facts"], text, KEYS)
    assert not wrong_saved(case, decisions, {"room": "5번"})


def test_wrong_saved_detects_wrong_value_and_unexpected_key():
    case = {"facts": {"room": "3번"}, "expect": {"room": [["ignored", None], "3번"]}}
    text = "5번 진료실은 지금 혼잡합니다."
    decisions = ai_only([cand(evidence=text)], case["facts"], text, KEYS)
    assert wrong_saved(case, decisions, {"room": "5번"})

    case = {"facts": {}, "expect": {}}
    decisions = ai_only([cand(key="exam_time", value="오후 2시", evidence=text)], {}, text, KEYS)
    assert wrong_saved(case, decisions, {"exam_time": "오후 2시"})
