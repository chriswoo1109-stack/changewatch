from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.sqlalchemy_url.startswith("sqlite") else {}
# pool_pre_ping: Neon은 오래 쉰 연결을 끊으므로, 쓰기 전에 살아 있는지 확인합니다.
engine = create_engine(settings.sqlalchemy_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
