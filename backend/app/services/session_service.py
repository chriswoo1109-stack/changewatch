from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session as DB

from app.domains import item_labels
from app.models import Announcement, ChangeLog, Fact, VisitSession
from app.schemas.analysis import AnalyzeResponse, ChangeOut
from app.schemas.session import FactOut, SessionOut
from app.services.llm_extractor import ExtractionError, get_extractor
from app.services.verifier import verify


def get_session_or_404(db: DB, session_id: str) -> VisitSession:
    session = db.get(VisitSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    return session


def current_facts(db: DB, session_id: str) -> dict[str, str]:
    rows = db.scalars(select(Fact).where(Fact.session_id == session_id)).all()
    return {f.key: f.value for f in rows}


def to_session_out(db: DB, session: VisitSession) -> SessionOut:
    labels = item_labels(session.domain)
    rows = db.scalars(select(Fact).where(Fact.session_id == session.id).order_by(Fact.id)).all()
    return SessionOut(
        id=session.id, title=session.title, domain=session.domain, created_at=session.created_at,
        facts=[FactOut(key=f.key, label=labels.get(f.key, f.key), value=f.value, updated_at=f.updated_at) for f in rows],
    )


def to_change_out(log: ChangeLog, labels: dict[str, str]) -> ChangeOut:
    return ChangeOut(
        id=log.id, key=log.key, label=labels.get(log.key, log.key), old_value=log.old_value,
        new_value=log.new_value, change_type=log.change_type, evidence=log.evidence,
        confidence=log.confidence, status=log.status, reason=log.reason, created_at=log.created_at,
    )


def apply_fact(db: DB, session_id: str, key: str, value: str | None, change_type: str) -> None:
    fact = db.scalar(select(Fact).where(Fact.session_id == session_id, Fact.key == key))
    if change_type == "cancel":
        if fact:
            db.delete(fact)
        return
    if value is None:
        return
    if fact:
        fact.value = value
    else:
        db.add(Fact(session_id=session_id, key=key, value=value))


def analyze(db: DB, session: VisitSession, text: str) -> AnalyzeResponse:
    """정보 추출 → 규칙 검증 → 저장. 시스템 처리 흐름 그대로입니다."""
    labels = item_labels(session.domain)
    facts = current_facts(db, session.id)

    announcement = Announcement(session_id=session.id, text=text)
    db.add(announcement)
    db.flush()

    try:
        extraction = get_extractor().extract(text, session.domain, facts)
    except ExtractionError:
        # 아직 commit 전이라 안내 원문도 저장되지 않습니다. 사용자는 같은 내용으로 다시 시도하면 됩니다.
        db.rollback()
        raise HTTPException(status_code=502, detail="AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요")
    decisions = verify(extraction.candidates, facts, text, set(labels), domain=session.domain)

    logs: list[ChangeLog] = []
    for d in decisions:
        c = d.candidate
        if d.status == "applied":
            apply_fact(db, session.id, c.key, c.value, c.change_type)
            db.flush()
        log = ChangeLog(
            session_id=session.id, announcement_id=announcement.id, key=c.key,
            old_value=d.old_value, new_value=c.value, change_type=c.change_type,
            evidence=c.evidence, confidence=c.confidence, status=d.status, reason=d.reason,
        )
        db.add(log)
        logs.append(log)
    db.commit()

    changes = [to_change_out(log, labels) for log in logs]
    return AnalyzeResponse(
        announcement_id=announcement.id, text=text, changes=changes,
        needs_confirmation=any(c.status == "pending" for c in changes),
    )


def confirm_change(db: DB, change_id: int, approve: bool) -> ChangeOut:
    log = db.get(ChangeLog, change_id)
    if log is None:
        raise HTTPException(status_code=404, detail="변경 기록을 찾을 수 없습니다")
    if log.status != "pending":
        raise HTTPException(status_code=409, detail="이미 처리된 변경입니다")
    if approve:
        apply_fact(db, log.session_id, log.key, log.new_value, log.change_type)
        log.status, log.reason = "applied", "사용자가 확인해 반영했습니다"
    else:
        log.status, log.reason = "rejected", "사용자가 거절했습니다"
    db.commit()
    session = db.get(VisitSession, log.session_id)
    return to_change_out(log, item_labels(session.domain))
