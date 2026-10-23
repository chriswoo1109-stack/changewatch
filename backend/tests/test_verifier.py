"""변경 판단 테스트. C(AI 엔진 담당)가 문장을 계속 추가하면서 정확도를 측정합니다.

실행: pytest -v
"""

import json
from pathlib import Path

import pytest

from app.domains import item_labels
from app.schemas.analysis import Candidate, TodoCandidate
from app.services.llm_extractor import MockExtractor
from app.services.verifier import verify, verify_todos

CASES = json.loads((Path(__file__).parent / "fixtures" / "sentences.json").read_text(encoding="utf-8"))
KEYS = set(item_labels("hospital"))


def run(facts: dict, text: str, me: dict | None = None) -> tuple[dict, dict]:
    me = me or {}
    candidates = MockExtractor().extract(text, "hospital", facts, **me).candidates
    decisions = verify(candidates, facts, text, KEYS, domain="hospital", **me)
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
    statuses, after = run(case["facts"], case["text"], case.get("me"))
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


def test_called_patient_number_is_not_room():
    text = "12번 환자분 진료실로 들어오세요."
    c = Candidate(key="room", value="12번", change_type="new", evidence=text, confidence=1.0)
    [d] = verify([c], {}, text, KEYS, domain="hospital")
    assert d.status == "pending"


def test_room_after_my_number_call_is_ok():
    text = "12번 환자분 3번 진료실로 오세요."
    c = Candidate(key="room", value="3번", change_type="new", evidence=text, confidence=1.0)
    [d] = verify([c], {}, text, KEYS, domain="hospital", my_number="12")
    assert d.status == "applied"


@pytest.mark.parametrize("my_number, expected", [("37", "ignored"), (None, "pending")])
def test_other_or_unknown_audience(my_number, expected):
    # AI가 "다른 사람 안내"를 놓치고 change라고 해도 verifier가 막는다
    text = "12번 환자분 3번 진료실로 오세요."
    c = Candidate(key="room", value="3번", change_type="change", evidence=text, confidence=1.0)
    [d] = verify([c], {"room": "5번"}, text, KEYS, domain="hospital", my_number=my_number)
    assert d.status == expected


def test_audience_uses_whole_sentence_when_ai_trims_evidence():
    # AI가 근거를 "3번 진료실로 오세요."로 잘라 줘도 앞의 "12번 환자분"을 보고 막는다
    text = "12번 환자분 3번 진료실로 오세요."
    c = Candidate(key="room", value="3번", change_type="new", evidence="3번 진료실로 오세요.", confidence=1.0)
    [d] = verify([c], {}, text, KEYS, domain="hospital", my_number="37")
    assert d.status == "ignored"


@pytest.mark.parametrize("my_room, expected", [("3번", "applied"), ("7번", "ignored"), (None, "pending")])
def test_room_group_call(my_room, expected):
    text = "3번 진료실 환자분들은 5번 진료실로 이동해 주시기 바랍니다."
    c = Candidate(key="room", value="5번", change_type="change", evidence=text, confidence=1.0)
    facts = {"room": my_room} if my_room else {}
    [d] = verify([c], facts, text, KEYS, domain="hospital")
    assert d.status == expected


@pytest.mark.parametrize("value, text, expected", [
    ("5번", "5번 진료실은 지금 혼잡합니다.", "ignored"),          # 상태 설명 → 단순 언급
    ("7번", "7번 진료실이 지금 비어 있습니다.", "ignored"),
    ("5번", "5번 진료실로 변경되었습니다.", "applied"),            # 바뀜을 알림
    ("5번", "5번 진료실은 지금 비어 있으니 그쪽으로 가세요.", "applied"),  # 안내 말투
    ("5번", "오 번 진료실은 지금 혼잡합니다.", "ignored"),         # 한글 숫자도 같은 판단
])
def test_value_only_describes_item(value, text, expected):
    # AI가 change라고 해도, 값이 항목 이름을 꾸미기만 하면 verifier가 막는다
    c = Candidate(key="room", value=value, change_type="change", evidence=text, confidence=0.9)
    [d] = verify([c], {"room": "3번"}, text, KEYS, domain="hospital")
    assert d.status == expected


def test_korean_number_call_of_someone_else_is_ignored():
    text = "십이 번 환자분 5번 진료실로 오세요."
    c = Candidate(key="room", value="5번", change_type="change", evidence=text, confidence=1.0)
    [d] = verify([c], {"room": "7번"}, text, KEYS, domain="hospital", my_number="37")
    assert d.status == "ignored"
    assert "12번" in d.reason


def test_bare_number_gets_unit():
    text = "대기 번호 12번으로 접수되었습니다."
    c = Candidate(key="wait_number", value="12", change_type="new", evidence=text, confidence=1.0)
    [d] = verify([c], {}, text, KEYS, domain="hospital")
    assert (d.status, d.candidate.value) == ("applied", "12번")


@pytest.mark.parametrize("change_type", ["uncertain", "change", "new"])
def test_same_value_is_ignored_even_if_uncertain(change_type):
    text = "아마 진료실은 5번일 겁니다."
    c = Candidate(key="room", value="5번", change_type=change_type, evidence=text, confidence=0.5)
    [d] = verify([c], {"room": "5번"}, text, KEYS, domain="hospital")
    assert d.status == "ignored"


def test_uncertain_different_value_still_pending():
    text = "아마 진료실은 7번일 겁니다."
    c = Candidate(key="room", value="7번", change_type="uncertain", evidence=text, confidence=0.5)
    [d] = verify([c], {"room": "5번"}, text, KEYS, domain="hospital")
    assert d.status == "pending"


def test_cancel_with_same_value_still_applies():
    text = "오후 2시 검사는 취소되었습니다."
    c = Candidate(key="exam_time", value="오후 2시", change_type="cancel", evidence=text, confidence=0.9)
    [d] = verify([c], {"exam_time": "오후 2시"}, text, KEYS, domain="hospital")
    assert d.status == "applied"


@pytest.mark.parametrize("text, my_number, kept", [
    ("12번 환자분 7번 진료실로 오세요.", "37", False),  # 다른 사람 호출 → 남의 할 일
    ("12번 환자분 7번 진료실로 오세요.", None, False),  # 누구인지 모름 → 할 일은 확인 요청이 없어 버림
    ("37번 환자분 7번 진료실로 오세요.", "37", True),   # 내 호출
    ("처방전은 약국에 제출하세요.", "37", True),         # 대상 표현 없음
    ("처음 오신 분은 접수처로 가세요.", None, True),     # 특정인이 아닌 묶음 안내
])
def test_todo_for_someone_else_is_dropped(text, my_number, kept):
    todo = TodoCandidate(text="할 일", evidence=text)
    result = verify_todos([todo], text, set(), domain="hospital", facts={}, my_number=my_number)
    assert bool(result) is kept


def test_todo_check_uses_full_sentence_when_evidence_is_cut():
    text = "대기번호 12번 환자분 7번 진료실로 오세요."
    todo = TodoCandidate(text="7번 진료실로 가기", evidence="7번 진료실로 오세요")
    assert verify_todos([todo], text, set(), domain="hospital", facts={}, my_number="37") == []
