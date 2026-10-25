import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class VisitSession(Base):
    """방문 단위 세션. 같은 세션 안의 안내끼리만 비교합니다. (예: 오늘 OO병원 방문)"""

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    title: Mapped[str] = mapped_column(String)
    domain: Mapped[str] = mapped_column(String, default="hospital")
    # 내 차례 알림용. 안내에서 이 번호·이름이 불리면 알린다.
    my_number: Mapped[str | None] = mapped_column(String, nullable=True)
    my_name: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
