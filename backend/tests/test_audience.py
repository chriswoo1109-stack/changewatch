"""안내 대상 판별 테스트: 나에게 하는 안내인지, 다른 사람에게 하는 안내인지."""

import pytest

from app.services.audience import find_audience


@pytest.mark.parametrize("evidence, my_number, my_name, my_times, expected", [
    # 번호로 부름
    ("12번 환자분 3번 진료실로 오세요.", "37", None, None, "other"),
    ("37번 환자분 3번 진료실로 오세요.", "37", None, None, "me"),
    ("037번 환자분 들어오세요.", "37", None, None, "me"),
    ("137번 환자분 들어오세요.", "37", None, None, "other"),      # 숫자 경계
    ("37번 환자분 3번 진료실로 오세요.", None, None, None, "unknown"),  # 내 번호 모름
    # 이름으로 부름
    ("김철수님 2번 진료실로 오세요.", None, "홍길동", None, "other"),
    ("홍길동님 2번 진료실로 오세요.", None, "홍길동", None, "me"),
    ("홍길동 환자분 들어오세요.", None, None, None, "unknown"),
    # 예약 시간대로 부름 (내 진료·검사 시각과 비교, 오전/오후 보정 포함)
    ("오전 11시 예약 환자분들은 접수처로 와 주세요.", None, None, ["오전 10시"], "other"),
    ("오전 11시 예약 환자분들은 5번 진료실로 가 주세요.", None, None, ["오전 11시"], "me"),
    ("11시 예약 환자분들은 5번 진료실로 가 주세요.", None, None, ["오전 11시"], "me"),
    ("오후 2시 예약 환자분들은 7번 진료실로 가 주세요.", None, None, None, "unknown"),
    # 대상을 규칙으로 알 수 없음
    ("처음 오신 분은 1번 진료실로 가 주세요.", None, None, None, "unknown"),
    # 한 문장에 여러 대상: 나를 부른 게 있으면 나
    ("12번, 37번 환자분 들어오세요.", "37", None, None, "me"),
    ("12번, 13번 환자분 들어오세요.", "37", None, None, "other"),
    ("12번 환자분과 37번 환자분 들어오세요.", "37", None, None, "me"),
])
def test_find_audience(evidence, my_number, my_name, my_times, expected):
    assert find_audience(evidence, my_number, my_name, my_times) == expected


@pytest.mark.parametrize("evidence", [
    "진료실이 5번으로 바뀌었습니다.",
    "환자분들은 잠시 기다려 주세요.",
    "보호자님은 밖에서 기다려 주세요.",
    "선생님께서 곧 오십니다.",
    "3번 진료실 앞에서 기다리세요.",
])
def test_no_audience(evidence):
    assert find_audience(evidence, "37", "홍길동", ["오전 10시"]) is None


@pytest.mark.parametrize("my_room, expected", [("3번", "me"), ("7번", "other"), (None, "unknown")])
def test_group_call(my_room, expected):
    evidence = "3번 진료실 환자분들은 5번 진료실로 이동해 주시기 바랍니다."
    assert find_audience(evidence, groups={"진료실": my_room}) == expected
