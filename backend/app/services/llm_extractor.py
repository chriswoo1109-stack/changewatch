"""안내 원문에서 변경 후보를 뽑아내는 단계.

- OpenAI 키가 있고 LLM_PROVIDER=openai 이면 실제 AI를 사용합니다.
- 아니면 간단한 규칙 기반 모의 분석기(MockExtractor)를 사용합니다.
  → API 키 없이도 프론트·백엔드 개발과 시연 리허설을 할 수 있습니다.
"""

import json
import logging
import re
from pathlib import Path

from pydantic import ValidationError

from app.core.config import settings
from app.domains import load_domain
from app.schemas.analysis import Candidate, ExtractionResult, TodoCandidate
from app.services.normalize import normalize_value
from app.services.verifier import UNCERTAIN_WORDS

logger = logging.getLogger(__name__)

logger = logging.getLogger(__name__)
PROMPT_PATH =Path(__file__).resolve().parent.parent / "prompts" / "extract.txt"

CORRECTION_WORDS = ["아니라", "정정", "잘못"]
CANCEL_WORDS = ["취소"]
CHANGE_WORDS = ["변경", "바뀌", "바꿔", "옮겨", "이동"]
# 안내·지시로 끝나는 말투. "5번 진료실로 가주세요"는 언급이 아니라 안내다. ("가 주세요", "이동하세요", "바랍니다" 포함)
DIRECTIVE_RE = re.compile(r"(세요|주십시오|십시오|바랍니다|입니다|됩니다)$")
TODO_RE = re.compile(r"(하세요|해 주세요|해주세요|하십시오)[.!?]?$")
VALUE_RE = re.compile(r"(오전|오후)?\s*\d+\s*(번|층|시\s*\d+\s*분|시|분|일|주|회|개월)(\s*(뒤|후))?")


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?。])\s+|\n+", text.strip())
    return [p.strip() for p in parts if p.strip()]


class MockExtractor:
    """규칙 기반 모의 분석기. 실제 AI의 '대역'이며 정확도는 낮습니다."""

    def extract(self, text: str, domain: str, facts: dict[str, str]) -> ExtractionResult:
        items = load_domain(domain)["items"]
        candidates: list[Candidate] = []
        todos: list[TodoCandidate] = []
        for sentence in split_sentences(text):
            item = next((i for i in items if any(k in sentence for k in i["keywords"])), None)
            if item is None:
                # 추적 항목은 없지만 "~하세요"로 끝나면 할 일로 봅니다. (예: 처방전은 약국에 제출하세요)
                if TODO_RE.search(sentence):
                    todos.append(TodoCandidate(text=sentence.rstrip(".!? "), evidence=sentence))
                continue
            keyword = next(k for k in item["keywords"] if k in sentence)

            target = sentence.split("아니라", 1)[1] if "아니라" in sentence else sentence
            # 값 찾기용으로만 한글 숫자를 바꾼다 (evidence는 원문 그대로)
            target = normalize_value(target)
            match = VALUE_RE.search(target)
            if match:
                value = re.sub(r"\s+", " ", match.group(0)).strip()
            elif item.get("value_pattern"):
                # 숫자 값이 필요한 항목(진료실·순번·시각)인데 못 찾으면 빈 값 → verifier가 확인 요청
                value = None
            else:
                value = sentence.rstrip(".!? ")

            if any(w in sentence for w in UNCERTAIN_WORDS):
                change_type, confidence = "uncertain", 0.5
            elif any(w in sentence for w in CORRECTION_WORDS):
                change_type, confidence = "correction", 0.9
            elif any(w in sentence for w in CANCEL_WORDS):
                change_type, confidence = "cancel", 0.9
            elif any(w in sentence for w in CHANGE_WORDS):
                change_type, confidence = "change", 0.9
            elif match and match.start() < sentence.find(keyword) and not DIRECTIVE_RE.search(sentence.rstrip(".!? ")):
                # "5번 진료실은 혼잡합니다"처럼 값이 수식어로만 쓰인 경우
                change_type, confidence = "mention", 0.8
            else:
                change_type, confidence = "new", 0.9

            candidates.append(
                Candidate(key=item["key"], value=value, change_type=change_type,
                          evidence=sentence, confidence=confidence)
            )
        return ExtractionResult(candidates=candidates, todos=todos)


class OpenAIExtractor:
    def __init__(self) -> None:
        from openai import OpenAI

        # 응답이 늦으면 오래 기다리지 않고 모의 분석기로 넘어가도록 짧게 잡습니다.
        self.client = OpenAI(api_key=settings.openai_api_key, timeout=20, max_retries=1)

    def extract(self, text: str, domain: str, facts: dict[str, str]) -> ExtractionResult:
        spec = load_domain(domain)
        prompt = PROMPT_PATH.read_text(encoding="utf-8").format(
            domain_label=spec["label"],
            items="\n".join(f"- {i['key']}: {i['label']}" for i in spec["items"]),
            facts=json.dumps(facts, ensure_ascii=False) if facts else "(없음)",
            text=text,
        )
        try:
            response = self.client.chat.completions.create(
                model=settings.openai_model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0,
            )
        except Exception as e:  # 네트워크·키·요금 한도 등 OpenAI 호출 실패
            raise ExtractionError(f"OpenAI 호출 실패: {e}") from e
        return parse_candidates(response.choices[0].message.content or "{}")


class ExtractionError(Exception):
    """AI 분석 자체가 실패한 경우. 라우트에서 502로 바꿔 사용자에게 알립니다."""


def parse_candidates(content: str) -> ExtractionResult:
    """AI 응답을 변경 후보·할 일 목록으로 바꿉니다.

    형식이 틀린 후보 하나 때문에 전체 분석이 실패하지 않도록, 고칠 수 있는 건 고치고
    고칠 수 없는 후보만 버립니다. 버려진 후보는 저장되지 않으므로 Fact에 영향이 없습니다.
    """
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise ExtractionError("AI 응답이 JSON 형식이 아닙니다") from e

    if not isinstance(data, dict):
        return ExtractionResult()

    def as_list(field: str) -> list:
        raw = data.get(field)
        return raw if isinstance(raw, list) else []

    candidates: list[Candidate] = []
    for item in as_list("candidates"):
        if not isinstance(item, dict):
            continue
        item = dict(item)
        if isinstance(item.get("change_type"), str):
            item["change_type"] = item["change_type"].strip().lower()  # "Change" → "change"
        if isinstance(item.get("value"), (int, float)) and not isinstance(item["value"], bool):
            item["value"] = str(item["value"])  # 5 → "5"
        if item.get("value") == "":
            item["value"] = None
        conf = item.get("confidence")
        if isinstance(conf, (int, float)) and 1 < conf <= 100:
            item["confidence"] = conf / 100  # 95 → 0.95 (퍼센트로 답한 경우)
        try:
            candidates.append(Candidate.model_validate(item))
        except ValidationError as e:
            logger.warning("형식이 틀린 AI 후보를 버립니다: %s (%s)", item, e.errors()[0]["msg"])

    todos: list[TodoCandidate] = []
    for item in as_list("todos"):
        try:
            todos.append(TodoCandidate.model_validate(item))
        except ValidationError:
            logger.warning("형식이 틀린 할 일 후보를 버립니다: %s", item)
    return ExtractionResult(candidates=candidates, todos=todos)


def get_extractor():
    return OpenAIExtractor() if settings.use_openai else MockExtractor()


def extract_safely(text: str, domain: str, facts: dict[str, str]) -> ExtractionResult:
    """AI 분석이 실패하면(ExtractionError: 호출 오류·JSON 아님 등) 모의 분석기로 대신 처리합니다.

    형식이 조금 틀린 응답은 parse_candidates가 먼저 고쳐 쓰므로, 여기까지 오는 건 복구할 수 없는 경우뿐입니다.
    결과는 어느 쪽이든 verifier를 거치므로, 시연 중 에러로 멈추는 것보다 안전합니다.
    """
    extractor = get_extractor()
    try:
        return extractor.extract(text, domain, facts)
    except Exception:
        if isinstance(extractor, MockExtractor):
            raise
        logger.exception("AI 분석 실패 → 모의 분석기로 대체")
        return MockExtractor().extract(text, domain, facts)
