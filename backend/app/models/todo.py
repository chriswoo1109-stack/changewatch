from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Todo(Base):
    """안내에서 뽑아낸 할 일. 오늘의 안내 화면의 체크리스트 데이터입니다. (예: 처방전을 약국에 제출하기)"""

    __tablename__ = "todos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, ForeignKey("sessions.id"), index=True)
    announcement_id: Mapped[int] = mapped_column(Integer, ForeignKey("announcements.id"))
    text: Mapped[str] = mapped_column(String)
    evidence: Mapped[str] = mapped_column(Text)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
