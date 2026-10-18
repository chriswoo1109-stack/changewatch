"""규칙 검증 단계 ★ 프로젝트의 핵심.

AI가 제안한 변경 후보를 바로 저장하지 않고, 아래 규칙을 통과한 것만 반영합니다.
불확실하면 자동 반영하지 않고 사용자에게 확인을 요청합니다(pending).
"""

import re
from dataclasses import dataclass

from app.core.config import settings
from app.schemas.analysis import Candidate
from app.services.normalize import fill_meridiem, normalize_value


# 값은 "5번", "오후 3시"처럼 짧은 정보여야 한다. 문장 끝맺음이 있거나 너무 길면 문장을 통째로 넣은 것이다.
SENTENCE_END_RE = re.compile(r"(니다|세요|어요|아요|에요|예요|해요|까요|죠)[.!?]?$")
MAX_VALUE_LEN = 30


def looks_like_sentence(value: str) -> bool:
    return len(value) > MAX_VALUE_LEN or bool(SENTENCE_END_RE.search(value))


@dataclass
class Decision:
    candidate: Candidate
    status: str  # applied | pending | ignored
    reason: str
    old_value: str | None


def verify(
    candidates: list[Candidate],
    facts: dict[str, str],
    original_text: str,
    allowed_keys: set[str],
    threshold: float | None = None,
    time_keys: set[str] = frozenset(),
    am_hours: tuple[int, int] = (7, 11),
) -> list[Decision]:
    threshold = settings.confidence_threshold if threshold is None else threshold
    decisions: list[Decision] = []
    current = dict(facts)  # 같은 안내 안에서 앞 문장의 반영 결과를 뒤 문장이 볼 수 있게 복사

    def norm(key: str, value: str | None) -> str | None:
        # "오후 세 시"·"3시"와 "오후 3시"를 같은 값으로 보도록 정규화 (시각 항목은 오전/오후 보정까지)
        value = normalize_value(value)
        return fill_meridiem(value, am_hours) if key in time_keys else value

    for c in candidates:
        c = c.model_copy(update={"value": norm(c.key, c.value)})
        old = current.get(c.key)

        def decide(status: str, reason: str) -> None:
            decisions.append(Decision(c, status, reason, old))
            if status == "applied":
                if c.change_type == "cancel":
                    current.pop(c.key, None)
                elif c.value:
                    current[c.key] = c.value

        # 1. AI가 지어낸 근거는 받지 않는다
        if c.evidence.strip() not in original_text:
            decide("pending", "근거 문장이 원문에서 확인되지 않아 확인이 필요합니다")
        # 2. 추적 대상이 아닌 항목
        elif c.key not in allowed_keys:
            decide("pending", "추적 항목에 없는 정보라 확인이 필요합니다")
        # 3. 단순 언급은 기존 정보를 바꾸지 않는다
        elif c.change_type == "mention":
            decide("ignored", "단순 언급으로 판단해 기존 정보를 유지합니다")
        # 4. 말하는 사람이 확신하지 않거나 AI 신뢰도가 낮으면 확인 요청
        elif c.change_type == "uncertain" or c.confidence < threshold:
            decide("pending", "확실하지 않은 안내라 확인이 필요합니다")
        # 5. 취소
        elif c.change_type == "cancel":
            if old is None:
                decide("ignored", "취소할 기존 정보가 없습니다")
            else:
                decide("applied", "기존 안내가 취소되었습니다")
        # 6. 값이 없거나, 문장 형태라 값을 특정할 수 없거나, 그대로면 반영하지 않는다
        elif not c.value:
            decide("pending", "값을 확인하지 못했습니다")
        elif looks_like_sentence(c.value):
            decide("pending", "바뀐 값을 정확히 찾지 못해 확인이 필요합니다")
        elif norm(c.key, old) == c.value:
            decide("ignored", "기존 정보와 같은 값입니다")
        # 7. 신규인데 이미 다른 값이 있으면 변경인지 사용자에게 묻는다
        elif c.change_type == "new" and old is not None:
            decide("pending", f"기존 값({old})과 다른 새 안내라 확인이 필요합니다")
        # 8. 통과
        elif old is None:
            decide("applied", "새로운 정보를 저장했습니다")
        else:
            decide("applied", "변경 내용을 반영했습니다")

    return decisions
