from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session as DB

from app.domains import item_labels
from app.models import Announcement, ChangeLog, Fact, Todo, VisitSession
from app.schemas.analysis import AnalyzeResponse, ChangeOut, TodoOut
from app.schemas.session import FactOut, SessionOut, SessionUpdate
from app.services.llm_extractor import extract_safely
from app.services.my_turn import detect_my_turn
from app.services.verifier import verify, verify_todos


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
    todos = db.scalars(select(Todo).where(Todo.session_id == session.id).order_by(Todo.id)).all()
    return SessionOut(
        id=session.id, title=session.title, domain=session.domain,
        my_number=session.my_number, my_name=session.my_name, created_at=session.created_at,
        facts=[FactOut(key=f.key, label=labels.get(f.key, f.key), value=f.value, updated_at=f.updated_at) for f in rows],
        todos=[to_todo_out(t) for t in todos],
    )


def update_session(db: DB, session: VisitSession, body: SessionUpdate) -> SessionOut:
    # 요청에 포함된 필드만 바꾸고, 빈 문자열은 지운 것으로 봅니다.
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(session, field, (value or "").strip() or None)
    db.commit()
    return to_session_out(db, session)


def to_todo_out(todo: Todo) -> TodoOut:
    return TodoOut(id=todo.id, text=todo.text, evidence=todo.evidence, done=todo.done, created_at=todo.created_at)


def update_todo(db: DB, todo_id: int, done: bool) -> TodoOut:
    todo = db.get(Todo, todo_id)
    if todo is None:
        raise HTTPException(status_code=404, detail="할 일을 찾을 수 없습니다")
    todo.done = done
    db.commit()
    return to_todo_out(todo)


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

    # AI가 실패해도(호출 오류·응답 형식 오류) 모의 분석기로 대체하므로 시연이 멈추지 않습니다.
    extraction = extract_safely(text, session.domain, facts)
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

    existing_todos = set(db.scalars(select(Todo.text).where(Todo.session_id == session.id)).all())
    todos = [
        Todo(session_id=session.id, announcement_id=announcement.id, text=t.text, evidence=t.evidence)
        for t in verify_todos(extraction.todos, text, existing_todos)
    ]
    db.add_all(todos)
    db.commit()

    changes = [to_change_out(log, labels) for log in logs]
    return AnalyzeResponse(
        announcement_id=announcement.id, text=text, changes=changes,
        needs_confirmation=any(c.status == "pending" for c in changes),
        todos=[to_todo_out(t) for t in todos],
        my_turn=detect_my_turn(text, session.my_number, session.my_name),
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
