"""규칙 검증 단계 ★ 프로젝트의 핵심.

AI가 제안한 변경 후보를 바로 저장하지 않고, 아래 규칙을 통과한 것만 반영합니다.
불확실하면 자동 반영하지 않고 사용자에게 확인을 요청합니다(pending).
"""

from dataclasses import dataclass

from app.core.config import settings
from app.schemas.analysis import Candidate, TodoCandidate


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
) -> list[Decision]:
    threshold = settings.confidence_threshold if threshold is None else threshold
    decisions: list[Decision] = []
    current = dict(facts)  # 같은 안내 안에서 앞 문장의 반영 결과를 뒤 문장이 볼 수 있게 복사

    for c in candidates:
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
        # 6. 값이 없거나 그대로면 반영할 필요가 없다
        elif not c.value:
            decide("pending", "값을 확인하지 못했습니다")
        elif old == c.value:
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


def verify_todos(todos: list[TodoCandidate], original_text: str, existing: set[str]) -> list[TodoCandidate]:
    """할 일 후보 중 원문 근거가 있고, 이미 있는 할 일과 겹치지 않는 것만 남깁니다."""
    kept: list[TodoCandidate] = []
    seen = set(existing)
    for t in todos:
        text = t.text.strip()
        if not text or text in seen:
            continue
        if t.evidence.strip() not in original_text:
            continue
        seen.add(text)
        kept.append(TodoCandidate(text=text, evidence=t.evidence.strip()))
    return kept
