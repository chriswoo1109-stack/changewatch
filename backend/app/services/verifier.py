"""규칙 검증 단계 ★ 프로젝트의 핵심.

AI가 제안한 변경 후보를 바로 저장하지 않고, 아래 규칙을 통과한 것만 반영합니다.
불확실하면 자동 반영하지 않고 사용자에게 확인을 요청합니다(pending).
"""

import re
from dataclasses import dataclass

from app.core.config import settings
from app.domains import am_hours, load_domain, time_keys
from app.schemas.analysis import Candidate, TodoCandidate
from app.services.audience import find_audience_detail
from app.services.normalize import fill_meridiem, normalize_value


# 값은 "5번", "오후 3시"처럼 짧은 정보여야 한다. 문장 끝맺음이 있거나 너무 길면 문장을 통째로 넣은 것이다.
SENTENCE_END_RE = re.compile(r"(니다|세요|어요|아요|에요|예요|해요|까요|죠)[.!?]?$")
MAX_VALUE_LEN = 30


def looks_like_sentence(value: str) -> bool:
    return len(value) > MAX_VALUE_LEN or bool(SENTENCE_END_RE.search(value))


def sentence_around(text: str, evidence: str) -> str:
    """원문에서 근거가 들어 있는 문장(여러 문장에 걸치면 모두)을 돌려줍니다. 못 찾으면 근거 그대로."""
    ev = evidence.strip()
    start = text.find(ev) if ev else -1
    if start < 0:
        return evidence
    end = start + len(ev)
    parts = [m.group(0).strip() for m in re.finditer(r"[^.!?。\n]+[.!?。]*", text)
             if m.start() < end and m.end() > start]
    return " ".join(parts) or evidence


def unknown_reason(who: str) -> str:
    """대상을 모를 때 사용자에게 무엇을 등록하면 되는지 알려 줍니다."""
    if who.endswith("번"):
        return f"{who}을 부르는 안내예요. 내 번호를 등록하면 자동으로 구분해요"
    if who.endswith("님"):
        return f"{who}을 부르는 안내예요. 내 이름을 등록하면 자동으로 구분해요"
    return "누구에게 하는 안내인지 확인이 필요합니다"


def called_person(c: Candidate, suffixes: list[str]) -> bool:
    """근거 문장에서 값 바로 뒤에 "환자" 등이 붙으면 사람을 부르는 번호다. ("12번 환자분 들어오세요")"""
    if not suffixes or not c.value:
        return False
    return any(re.search(re.escape(c.value) + r"\s*" + re.escape(s), c.evidence) for s in suffixes)


@dataclass
class Decision:
    candidate: Candidate
    status: str  # applied | pending | ignored
    reason: str
    old_value: str | None


# 말하는 사람이 확신하지 않는 표현. AI가 놓쳐도 근거 문장에 있으면 확인을 요청한다.
UNCERTAIN_WORDS = ["아마", "것 같", "쯤", "확실하지", "일걸", "일 겁니다", "일 거예요", "지도 몰라", "지도 모릅"]


def has_uncertain_words(evidence: str) -> bool:
    return any(w in evidence for w in UNCERTAIN_WORDS)


def verify(
    candidates: list[Candidate],
    facts: dict[str, str],
    original_text: str,
    allowed_keys: set[str],
    threshold: float | None = None,
    domain: str | None = None,
    my_number: str | None = None,
    my_name: str | None = None,
) -> list[Decision]:
    threshold = settings.confidence_threshold if threshold is None else threshold
    decisions: list[Decision] = []
    current = dict(facts)  # 같은 안내 안에서 앞 문장의 반영 결과를 뒤 문장이 볼 수 있게 복사

    # 도메인 JSON의 항목 설정 (domain을 안 주면 정규화만 하고 형식 검사는 하지 않음)
    items = {i["key"]: i for i in load_domain(domain)["items"]} if domain else {}
    times = time_keys(domain) if domain else set()
    hours = am_hours(domain) if domain else (7, 11)

    def norm(key: str, value: str | None) -> str | None:
        # "오후 세 시"·"3시"와 "오후 3시"를 같은 값으로 보도록 정규화 (시각 항목은 오전/오후 보정까지)
        value = normalize_value(value)
        return fill_meridiem(value, hours) if key in times else value

    def audience(sentence: str):
        # 내 진료·검사 시각과 묶음 호출 항목 값은 지금까지 저장된(같은 안내 앞 문장에서 바뀐 것 포함) 값
        my_times = [v for k, v in current.items() if k in times and v]
        groups = {i["label"]: current.get(k) for k, i in items.items() if i.get("group_call")}
        return find_audience_detail(sentence, my_number, my_name, my_times, hours, groups)

    def position(c: Candidate) -> int:
        i = original_text.find(c.evidence.strip())
        return i if i >= 0 else len(original_text)

    # AI가 후보를 뒤죽박죽 줘도 원문에 나온 순서대로 판단한다 ("취소되었습니다. 대신 9시에…")
    candidates = sorted(candidates, key=position)

    for c in candidates:
        c = c.model_copy(update={"value": norm(c.key, c.value)})
        old = current.get(c.key)
        # AI가 근거를 "3번 진료실로 오세요."처럼 잘라 줘도 "12번 환자분"을 볼 수 있게 원문 문장 전체로 판단
        sentence = sentence_around(original_text, c.evidence)

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
        # 3-1. 다른 사람을 부르는 안내("12번 환자분 7번 진료실로 오세요")는 반영하지 않고, 누구인지 모르면 확인 요청
        #      AI가 근거를 "7번 진료실로 오세요"처럼 잘라 줄 수 있어 원문 문장 전체로 판단한다 (services/audience.py)
        elif (found := audience(sentence)) and found[0] == "other":
            decide("ignored", f"다른 분({found[1]})을 부르는 안내라 내 정보는 그대로 둡니다")
        elif found and found[0] == "unknown":
            decide("pending", unknown_reason(found[1]))
        # 4. 말하는 사람이 확신하지 않거나(AI가 놓쳐도 표현으로 확인) AI 신뢰도가 낮으면 확인 요청
        elif c.change_type == "uncertain" or c.confidence < threshold or has_uncertain_words(sentence):
            decide("pending", "확실하지 않은 안내라 확인이 필요합니다")
        # 5. 취소
        elif c.change_type == "cancel":
            if old is None:
                decide("ignored", "취소할 기존 정보가 없습니다")
            else:
                decide("applied", "기존 안내가 취소되었습니다")
        # 6. 값이 없거나, 문장 형태거나, 항목 형식(value_pattern·not_followed_by)에 안 맞거나, 그대로면 반영하지 않는다
        elif not c.value:
            decide("pending", "값을 확인하지 못했습니다")
        elif looks_like_sentence(c.value):
            decide("pending", "바뀐 값을 정확히 찾지 못해 확인이 필요합니다")
        elif (pattern := items.get(c.key, {}).get("value_pattern")) and not re.search(pattern, c.value):
            decide("pending", "값의 형식이 맞지 않아 확인이 필요합니다")
        elif called_person(c, items.get(c.key, {}).get("not_followed_by", [])):
            decide("pending", "다른 사람을 부르는 번호일 수 있어 확인이 필요합니다")
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
