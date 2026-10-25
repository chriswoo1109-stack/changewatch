"""값 정규화 테스트. 바꿔야 할 표현과 건드리면 안 되는 표현을 함께 확인합니다."""

import pytest

from app.services.normalize import fill_meridiem, normalize_value


@pytest.mark.parametrize("raw, expected", [
    ("오후 세 시", "오후 3시"),
    ("오후세시", "오후 3시"),
    ("열한 시", "11시"),
    ("열두시", "12시"),
    ("오후 두 시 반", "오후 2시 30분"),
    ("오 번", "5번"),
    ("이십 번", "20번"),
    ("삼십 분", "30분"),
    ("사십오 분", "45분"),
    ("하루 두 번", "하루 2번"),
    ("하루 3회 식후 30분 한 봉", "하루 3회 식후 30분 1봉"),   # 복약 단위
    ("두 알씩", "2알씩"),
    ("한 포", "1포"),
    ("이 주 뒤", "2주 뒤"),
    ("삼 개월 후", "3개월 후"),
    ("오후3시30분", "오후 3시 30분"),
    ("3 시", "3시"),
    ("  5번 ", "5번"),
    (None, None),
])
def test_converts(raw, expected):
    assert normalize_value(raw) == expected


@pytest.mark.parametrize("raw", [
    "오후", "오전", "들어오세요", "이번 주", "이분", "한시적", "오일",
    "네 번호", "이 일정", "하루 3회 식후 30분", "네 정말요", "한정 판매",
])
def test_keeps_ordinary_words(raw):
    assert normalize_value(raw) == raw


@pytest.mark.parametrize("raw, expected", [
    ("11시", "오전 11시"),
    ("7시", "오전 7시"),
    ("11시 30분", "오전 11시 30분"),
    ("1시", "오후 1시"),
    ("6시", "오후 6시"),
    ("12시", "오후 12시"),
    ("14시", "오후 2시"),
    ("내일 9시", "내일 오전 9시"),
    ("오전 9시", "오전 9시"),      # 이미 있으면 그대로
    ("오후 11시", "오후 11시"),
    ("3시간 뒤", "3시간 뒤"),      # 기간은 시각이 아님
    ("0시", "0시"),
    (None, None),
])
def test_fill_meridiem(raw, expected):
    assert fill_meridiem(raw, (7, 11)) == expected
