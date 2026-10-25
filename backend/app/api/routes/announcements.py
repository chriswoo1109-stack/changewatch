from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DB

from app.core.config import settings
from app.db import get_db
from app.schemas.analysis import AnalyzeResponse, AnnouncementCreate
from app.services import session_service
from app.services.cost_guard import rate_limit

router = APIRouter(prefix="/sessions", tags=["announcements"])


@router.post("/{session_id}/announcements", response_model=AnalyzeResponse, dependencies=[Depends(rate_limit)])
def analyze_announcement(session_id: str, body: AnnouncementCreate, db: DB = Depends(get_db)):
    """안내 텍스트를 분석해 변경 내용을 돌려줍니다."""
    text = body.text.strip()
    if len(text) > settings.max_text_chars:
        raise HTTPException(
            status_code=413, detail=f"안내가 너무 길어요. {settings.max_text_chars}자 이내로 나눠서 입력해 주세요."
        )
    session = session_service.get_session_or_404(db, session_id)
    return session_service.analyze(db, session, text)
