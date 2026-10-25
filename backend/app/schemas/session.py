from datetime import datetime

from pydantic import BaseModel

from app.schemas.analysis import TodoOut


class SessionCreate(BaseModel):
    title: str
    domain: str = "hospital"
    my_number: str | None = None
    my_name: str | None = None


class SessionUpdate(BaseModel):
    """보낸 필드만 바뀝니다. 빈 문자열("")을 보내면 지웁니다."""

    my_number: str | None = None
    my_name: str | None = None


class FactOut(BaseModel):
    key: str
    label: str
    value: str
    updated_at: datetime


class SessionOut(BaseModel):
    id: str
    title: str
    domain: str
    my_number: str | None = None
    my_name: str | None = None
    created_at: datetime
    facts: list[FactOut] = []
    todos: list[TodoOut] = []
