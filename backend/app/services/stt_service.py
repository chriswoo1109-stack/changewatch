from fastapi import HTTPException

from app.core.config import settings


def transcribe(filename: str, data: bytes, content_type: str | None) -> str:
    """녹음 파일을 텍스트로 바꿉니다. OpenAI 키가 있어야 동작합니다."""
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=501,
            detail="음성 인식을 쓰려면 .env에 OPENAI_API_KEY를 설정하세요. 지금은 텍스트 입력을 이용해 주세요.",
        )
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    result = client.audio.transcriptions.create(
        model=settings.stt_model,
        file=(filename, data, content_type or "audio/webm"),
        language="ko",
    )
    return result.text
