"""대기 모드(연속 듣기). 프론트가 20~30초마다 보내는 음성 조각을 처리합니다.

조각마다 AI 분석을 하면 비용·지연이 크므로 순서를 나눕니다.
  1. 음성 인식 (직전 텍스트를 prompt로 넘겨 경계에서 잘린 문장 보완)
  2. 잡음 문장 제거 (무음 구간에서 음성 인식이 지어내는 문장)
  3. 직전 조각과 겹친 문장 제거
  4. 내 차례 확인 → 규칙이라 즉시
  5. 안내 키워드가 있을 때만 AI 분석 (analyze)
"""

import re

from sqlalchemy.orm import Session as DB

from app.domains import load_domain
from app.models import VisitSession
from app.schemas.analysis import ListenResponse
from app.services import session_service, stt_service
from app.services.llm_extractor import (
    CANCEL_WORDS, CHANGE_WORDS, CORRECTION_WORDS, UNCERTAIN_WORDS, split_sentences,
)
from app.services.my_turn import detect_my_turn

# 이보다 작은 파일은 녹음이 제대로 안 된 것으로 보고 음성 인식을 생략합니다.
MIN_CHUNK_BYTES = 1024

# 조용한 구간에서 음성 인식(Whisper)이 자주 지어내는 문장. 들어 있으면 그 문장을 버립니다.
# TODO(ai): 실제 녹음으로 테스트하면서 추가
HALLUCINATIONS = [
    "시청해 주셔서 감사", "시청해주셔서 감사", "구독과 좋아요", "구독 좋아요", "좋아요와 구독",
    "다음 영상에서", "MBC 뉴스", "KBS 뉴스", "자막 제공", "자막 by",
]


def _normalize(s: str) -> str:
    return re.sub(r"[\s.,!?·]", "", s)


def clean_text(text: str, prev_text: str | None) -> str:
    """잡음 문장과, 직전 조각에서 이미 들은 문장을 뺍니다."""
    prev = _normalize(prev_text or "")
    kept = []
    for sentence in split_sentences(text):
        if any(h in sentence for h in HALLUCINATIONS):
            continue
        norm = _normalize(sentence)
        if not norm or (prev and norm in prev):
            continue
        kept.append(sentence)
    return " ".join(kept)


def needs_analysis(text: str, domain: str, facts: dict[str, str]) -> bool:
    """추적 항목·변경 표현·현재 값 중 하나라도 들어 있으면 AI 분석이 필요하다고 봅니다."""
    words = [k for item in load_domain(domain)["items"] for k in item["keywords"]]
    words += CHANGE_WORDS + CORRECTION_WORDS + CANCEL_WORDS + UNCERTAIN_WORDS + list(facts.values())
    return any(w and w in text for w in words)


def listen(
    db: DB, session: VisitSession, filename: str, data: bytes, content_type: str | None, prev_text: str | None
) -> ListenResponse:
    if len(data) < MIN_CHUNK_BYTES:
        return ListenResponse(text="", skipped=True)

    raw = stt_service.transcribe_raw(filename, data, content_type, session.domain, prev_text=prev_text)
    text = clean_text(raw, prev_text)
    if not text:
        return ListenResponse(text="", skipped=True)

    my_turn = detect_my_turn(text, session.my_number, session.my_name)
    analysis = None
    if needs_analysis(text, session.domain, session_service.current_facts(db, session.id)):
        analysis = session_service.analyze(db, session, text)
    return ListenResponse(text=text, skipped=False, my_turn=my_turn, analysis=analysis)
