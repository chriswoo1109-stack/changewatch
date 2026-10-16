from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ChangeLog(Base):
    """AI가 찾아낸 변경 후보와 검증 결과. 변경 이력 화면의 데이터입니다.

    status
      - applied : 현재 정보에 반영됨
      - pending : 불확실해서 사용자 확인을 기다리는 중
      - ignored : 단순 언급 등으로 반영하지 않음
      - rejected: 사용자가 거절함
    """

    __tablename__ = "change_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, ForeignKey("sessions.id"), index=True)
    announcement_id: Mapped[int] = mapped_column(Integer, ForeignKey("announcements.id"))
    key: Mapped[str] = mapped_column(String)
    old_value: Mapped[str | None] = mapped_column(String, nullable=True)
    new_value: Mapped[str | None] = mapped_column(String, nullable=True)
    change_type: Mapped[str] = mapped_column(String)
    evidence: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String)
    reason: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
