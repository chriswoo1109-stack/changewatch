"""AI 응답 파싱 테스트. 실제 API 없이, AI가 형식을 틀리게 답한 경우를 흉내 냅니다."""

import json

import pytest

from app.services.llm_extractor import ExtractionError, parse_candidates


def parse(obj) -> list:
    return parse_candidates(json.dumps(obj, ensure_ascii=False)).candidates


def good(**kw) -> dict:
    return {"key": "room", "value": "5번", "change_type": "change",
            "evidence": "진료실이 5번으로 변경되었습니다.", "confidence": 0.9, **kw}


def test_valid():
    [c] = parse({"candidates": [good()]})
    assert (c.key, c.value, c.change_type) == ("room", "5번", "change")


def test_drops_only_broken_candidate():
    cs = parse({"candidates": [good(), good(change_type="moved"), good(key="exam_time", evidence=None), "문자열"]})
    assert [c.key for c in cs] == ["room"]


def test_fixes_recoverable_format():
    [c] = parse({"candidates": [good(change_type=" Change ", value=5, confidence=95)]})
    assert (c.change_type, c.value, c.confidence) == ("change", "5", 0.95)


def test_empty_value_becomes_none():
    [c] = parse({"candidates": [good(value="")]})
    assert c.value is None


@pytest.mark.parametrize("obj", [{}, {"candidates": None}, {"candidates": "없음"}, []])
def test_missing_candidates_is_empty(obj):
    assert parse(obj) == []


def test_invalid_json_raises():
    with pytest.raises(ExtractionError):
        parse_candidates("죄송합니다, 분석할 수 없습니다.")
