from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session as DB

from app.db import get_db
from app.schemas.analysis import TranscribeResponse
from app.services import session_service, stt_service

router = APIRouter(prefix="/sessions", tags=["transcribe"])


@router.post("/{session_id}/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(session_id: str, file: UploadFile = File(...), db: DB = Depends(get_db)):
    """녹음 파일을 텍스트로 바꿉니다. 분석은 하지 않습니다(프론트가 이어서 /announcements 호출)."""
    session_service.get_session_or_404(db, session_id)
    data = await file.read()
    text = stt_service.transcribe(file.filename or "audio.webm", data, file.content_type)
    return TranscribeResponse(text=text)
