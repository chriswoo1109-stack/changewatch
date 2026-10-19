"""내 차례 감지 테스트: 한글 숫자, 숫자 경계, 번호가 장소·값으로 쓰인 경우."""

import pytest

from app.services.my_turn import detect_my_turn


@pytest.mark.parametrize("text", [
    "37번 환자분 들어오세요.",
    "삼십칠 번 환자분 들어오세요.",          # 음성 인식이 한글 숫자로 적은 경우
    "삼십칠번 환자분 들어오세요.",
    "대기 번호 삼십칠 번 고객님 창구로 오세요.",
    "37번 손님, 2번 창구로 오세요.",
    "37번 들어오세요.",
])
def test_detects_my_number(text):
    found = detect_my_turn(text, "37", None)
    assert found is not None and found.matched == "37번"
    assert found.evidence == text  # 근거는 원문 그대로


@pytest.mark.parametrize("text", [
    "137번 환자분 들어오세요.",              # 숫자 경계
    "370번 환자분 들어오세요.",
    "백삼십칠 번 환자분 들어오세요.",
    "37번 진료실로 가세요.",                  # 번호가 장소로 쓰임
    "진료실이 37번으로 바뀌었습니다.",        # 번호가 값으로 쓰임
    "이번 주에 다시 오세요.",                 # "이번"은 숫자가 아님
])
def test_ignores_other_meanings(text):
    assert detect_my_turn(text, "37", None) is None
