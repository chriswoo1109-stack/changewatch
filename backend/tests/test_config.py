from app.core.config import Settings


def test_postgres_url_uses_psycopg_driver():
    neon = "postgresql://user:pw@ep-x.neon.tech/db?sslmode=require"
    assert Settings(database_url=neon).sqlalchemy_url == "postgresql+psycopg://user:pw@ep-x.neon.tech/db?sslmode=require"
    assert Settings(database_url="postgres://u:p@h/db").sqlalchemy_url == "postgresql+psycopg://u:p@h/db"


def test_sqlite_url_unchanged():
    assert Settings(database_url="sqlite:///./x.db").sqlalchemy_url == "sqlite:///./x.db"
