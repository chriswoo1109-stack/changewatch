from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DB

from app.db import get_db
from app.schemas.analysis import AnalyzeResponse, AnnouncementCreate
from app.services import session_service

router = APIRouter(prefix="/sessions", tags=["announcements"])


@router.post("/{session_id}/announcements", response_model=AnalyzeResponse)
def analyze_announcement(session_id: str, body: AnnouncementCreate, db: DB = Depends(get_db)):
    """안내 텍스트를 분석해 변경 내용을 돌려줍니다."""
    session = session_service.get_session_or_404(db, session_id)
    return session_service.analyze(db, session, body.text.strip())
