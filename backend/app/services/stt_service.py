import logging

from fastapi import HTTPException

from app.core.config import settings
from app.domains import stt_prompt

logger = logging.getLogger(__name__)

# OpenAI 음성 인식 API가 받는 최대 파일 크기
MAX_AUDIO_BYTES = 25 * 1024 * 1024


def transcribe(filename: str, data: bytes, content_type: str | None, domain: str = "hospital") -> str:
    """녹음 파일을 텍스트로 바꿉니다. OpenAI 키가 있어야 동작합니다."""
    text = transcribe_raw(filename, data, content_type, domain)
    if not text:
        raise HTTPException(status_code=422, detail="안내를 알아듣지 못했어요. 다시 녹음하거나 텍스트로 입력해 주세요.")
    return text


def transcribe_raw(
    filename: str, data: bytes, content_type: str | None, domain: str = "hospital", prev_text: str | None = None
) -> str:
    """음성 인식만 합니다. 결과가 비어 있어도 에러로 보지 않습니다. (대기 모드는 조용한 구간이 많음)

    prompt로 분야 용어(domains/*.json의 stt_hints)를 보내 인식 정확도를 높이고,
    prev_text(직전 조각의 텍스트)가 있으면 뒤에 붙여 조각 경계에서 잘린 문장을 이어서 알아듣게 합니다.
    """
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=501,
            detail="음성 인식을 쓰려면 .env에 OPENAI_API_KEY를 설정하세요. 지금은 텍스트 입력을 이용해 주세요.",
        )
    if not data:
        raise HTTPException(status_code=400, detail="녹음된 소리가 없습니다. 다시 녹음해 주세요.")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="녹음이 너무 깁니다. 짧게 나눠서 다시 녹음해 주세요.")

    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key, timeout=30, max_retries=1)
    try:
        result = client.audio.transcriptions.create(
            model=settings.stt_model,
            file=(filename, data, content_type or "audio/webm"),
            language="ko",
            prompt=stt_prompt(domain) + (" " + prev_text[-200:] if prev_text else ""),
        )
    except Exception:
        logger.exception("음성 인식 실패")
        raise HTTPException(
            status_code=502,
            detail="음성 인식에 실패했습니다. 잠시 후 다시 시도하거나 텍스트로 입력해 주세요.",
        )
    return (result.text or "").strip()
