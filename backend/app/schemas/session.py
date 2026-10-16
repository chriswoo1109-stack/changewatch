from datetime import datetime

from pydantic import BaseModel


class SessionCreate(BaseModel):
    title: str
    domain: str = "hospital"


class FactOut(BaseModel):
    key: str
    label: str
    value: str
    updated_at: datetime


class SessionOut(BaseModel):
    id: str
    title: str
    domain: str
    created_at: datetime
    facts: list[FactOut] = []
