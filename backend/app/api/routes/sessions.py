from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session as DB

from app.db import get_db
from app.domains import item_labels, load_domain
from app.models import ChangeLog, VisitSession
from app.schemas.analysis import ChangeOut
from app.schemas.session import SessionCreate, SessionOut, SessionUpdate
from app.services import session_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionOut, status_code=201)
def create_session(body: SessionCreate, db: DB = Depends(get_db)):
    try:
        load_domain(body.domain)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    session = VisitSession(
        title=body.title, domain=body.domain,
        my_number=(body.my_number or "").strip() or None, my_name=(body.my_name or "").strip() or None,
    )
    db.add(session)
    db.commit()
    return session_service.to_session_out(db, session)


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: str, db: DB = Depends(get_db)):
    session = session_service.get_session_or_404(db, session_id)
    return session_service.to_session_out(db, session)


@router.patch("/{session_id}", response_model=SessionOut)
def update_session(session_id: str, body: SessionUpdate, db: DB = Depends(get_db)):
    """내 번호·이름을 바꿉니다. (방문 중에 번호표를 받은 경우 등)"""
    session = session_service.get_session_or_404(db, session_id)
    return session_service.update_session(db, session, body)


@router.get("/{session_id}/history", response_model=list[ChangeOut])
def get_history(session_id: str, db: DB = Depends(get_db)):
    session = session_service.get_session_or_404(db, session_id)
    labels = item_labels(session.domain)
    logs = db.scalars(
        select(ChangeLog).where(ChangeLog.session_id == session_id).order_by(ChangeLog.id.desc())
    ).all()
    return [session_service.to_change_out(log, labels) for log in logs]
