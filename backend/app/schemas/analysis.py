from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ChangeType = Literal["new", "change", "correction", "cancel", "mention", "uncertain"]
Status = Literal["applied", "pending", "ignored", "rejected"]


class Candidate(BaseModel):
    """AI(또는 모의 분석기)가 찾아낸 변경 후보. LLM 출력 형식이기도 합니다."""

    key: str
    value: str | None = None
    change_type: ChangeType
    evidence: str = Field(description="원문에서 그대로 가져온 근거 문장")
    confidence: float = Field(ge=0, le=1)


class ExtractionResult(BaseModel):
    candidates: list[Candidate] = []


class AnnouncementCreate(BaseModel):
    text: str = Field(min_length=1)


class ChangeOut(BaseModel):
    id: int
    key: str
    label: str
    old_value: str | None
    new_value: str | None
    change_type: ChangeType
    evidence: str
    confidence: float
    status: Status
    reason: str
    created_at: datetime


class AnalyzeResponse(BaseModel):
    announcement_id: int
    text: str
    changes: list[ChangeOut]
    needs_confirmation: bool


class ConfirmRequest(BaseModel):
    approve: bool


class TranscribeResponse(BaseModel):
    text: str
