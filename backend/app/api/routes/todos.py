from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DB

from app.db import get_db
from app.schemas.analysis import TodoOut, TodoUpdate
from app.services import session_service

router = APIRouter(prefix="/todos", tags=["todos"])


@router.patch("/{todo_id}", response_model=TodoOut)
def update_todo(todo_id: int, body: TodoUpdate, db: DB = Depends(get_db)):
    """할 일 체크·해제."""
    return session_service.update_todo(db, todo_id, body.done)
