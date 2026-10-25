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


class TodoCandidate(BaseModel):
    """AI가 찾아낸 할 일 후보. LLM 출력 형식이기도 합니다."""

    text: str = Field(description="짧게 정리한 할 일 (예: 처방전을 약국에 제출하기)")
    evidence: str = Field(description="원문에서 그대로 가져온 근거 문장")


class ExtractionResult(BaseModel):
    candidates: list[Candidate] = []
    todos: list[TodoCandidate] = []


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


class TodoOut(BaseModel):
    id: int
    text: str
    evidence: str
    done: bool
    created_at: datetime


class TodoUpdate(BaseModel):
    done: bool


class MyTurnOut(BaseModel):
    """안내에서 내 번호·이름이 불렸을 때만 채워집니다."""

    matched: str = Field(description="불린 값 (예: 37번, 홍길동)")
    evidence: str = Field(description="내 번호·이름이 나온 원문 문장")


class AnalyzeResponse(BaseModel):
    announcement_id: int
    text: str
    changes: list[ChangeOut]
    needs_confirmation: bool
    todos: list[TodoOut] = Field(default=[], description="이번 안내에서 새로 생긴 할 일")
    my_turn: MyTurnOut | None = None


class ConfirmRequest(BaseModel):
    approve: bool


class TranscribeResponse(BaseModel):
    text: str
