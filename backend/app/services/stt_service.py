import logging

from fastapi import HTTPException

from app.core.config import settings
from app.domains import stt_prompt
from app.services import cost_guard

logger = logging.getLogger(__name__)

# 최대 파일 크기. OpenAI 한도는 25MB지만, 안내 한 번 녹음은 10MB(webm 기준 수십 분)면 충분하고 요금도 아낍니다.
MAX_AUDIO_BYTES = 10 * 1024 * 1024


def transcribe(filename: str, data: bytes, content_type: str | None, domain: str = "hospital") -> str:
    """녹음 파일을 텍스트로 바꿉니다. OpenAI 키가 있어야 동작합니다.

    분야 용어를 prompt로 함께 보내 인식 정확도를 높입니다. (domains/*.json의 stt_hints)
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
    if not cost_guard.use_ai_budget():
        raise HTTPException(status_code=429, detail="오늘 음성 인식 사용량을 다 썼어요. 텍스트로 입력해 주세요.")

    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key, timeout=30, max_retries=1)
    try:
        result = client.audio.transcriptions.create(
            model=settings.stt_model,
            file=(filename, data, content_type or "audio/webm"),
            language="ko",
            prompt=stt_prompt(domain),
        )
    except Exception:
        logger.exception("음성 인식 실패")
        raise HTTPException(
            status_code=502,
            detail="음성 인식에 실패했습니다. 잠시 후 다시 시도하거나 텍스트로 입력해 주세요.",
        )

    text = (result.text or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="안내를 알아듣지 못했어요. 다시 녹음하거나 텍스트로 입력해 주세요.")
    return text
