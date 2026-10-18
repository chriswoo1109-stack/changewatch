from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session as DB

from app.db import get_db
from app.schemas.analysis import ListenResponse, TranscribeResponse
from app.services import listen_service, session_service, stt_service

router = APIRouter(prefix="/sessions", tags=["transcribe"])


@router.post("/{session_id}/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(session_id: str, file: UploadFile = File(...), db: DB = Depends(get_db)):
    """녹음 파일을 텍스트로 바꿉니다. 분석은 하지 않습니다(프론트가 이어서 /announcements 호출)."""
    session = session_service.get_session_or_404(db, session_id)
    data = await file.read()
    text = stt_service.transcribe(file.filename or "audio.webm", data, file.content_type, session.domain)
    return TranscribeResponse(text=text)


@router.post("/{session_id}/listen", response_model=ListenResponse)
async def listen_chunk(
    session_id: str,
    file: UploadFile = File(...),
    prev_text: str | None = Form(None),
    db: DB = Depends(get_db),
):
    """대기 모드: 음성 조각 1개를 듣고, 내 차례·안내 변경을 확인합니다."""
    session = session_service.get_session_or_404(db, session_id)
    data = await file.read()
    return listen_service.listen(db, session, file.filename or "audio.webm", data, file.content_type, prev_text)
