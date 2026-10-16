from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DB

from app.db import get_db
from app.schemas.analysis import ChangeOut, ConfirmRequest
from app.services import session_service

router = APIRouter(prefix="/changes", tags=["changes"])


@router.post("/{change_id}/confirm", response_model=ChangeOut)
def confirm(change_id: int, body: ConfirmRequest, db: DB = Depends(get_db)):
    """확인 요청(pending) 상태의 변경을 승인하거나 거절합니다."""
    return session_service.confirm_change(db, change_id, body.approve)
