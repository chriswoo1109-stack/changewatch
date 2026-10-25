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


def test_parses_todos_and_drops_broken_ones():
    content = json.dumps({"candidates": [good()], "todos": [
        {"text": "처방전을 약국에 제출하기", "evidence": "처방전은 1층 약국에 제출하세요."},
        {"text": "근거 없음"}, "문자열",
    ]}, ensure_ascii=False)
    result = parse_candidates(content)
    assert len(result.candidates) == 1
    assert [t.text for t in result.todos] == ["처방전을 약국에 제출하기"]


def test_openai_extractor_builds_prompt_and_parses(monkeypatch):
    """실제 API 없이 OpenAIExtractor를 끝까지 실행합니다.

    여기서 예외가 나면 앱은 조용히 모의 분석기로 대체되므로(extract_safely), 테스트로 따로 확인합니다.
    """
    from types import SimpleNamespace

    from app.services import llm_extractor

    sent = {}

    class FakeCompletions:
        def create(self, **kwargs):
            sent["prompt"] = kwargs["messages"][0]["content"]
            content = json.dumps({"candidates": [good()], "todos": []}, ensure_ascii=False)
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    extractor = llm_extractor.OpenAIExtractor.__new__(llm_extractor.OpenAIExtractor)
    extractor.client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))

    result = extractor.extract("진료실이 5번으로 변경되었습니다.", "hospital", {"room": "3번"}, "37", "홍길동")
    assert [c.value for c in result.candidates] == ["5번"]
    assert "번호: 37, 이름: 홍길동" in sent["prompt"]
    assert "supplies: 준비물 — " in sent["prompt"]  # 항목 설명이 프롬프트에 들어감
    # 저장된 정보는 모든 추적 항목을 (없음)과 함께 보여 준다 (진료실만 보이면 AI가 다른 새 항목을 놓침)
    assert "- room(진료실): 3번" in sent["prompt"]
    assert "- exam_time(검사 시간): (없음)" in sent["prompt"]
