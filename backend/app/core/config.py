from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """환경변수(.env)에서 설정을 읽어옵니다."""

    llm_provider: str = "mock"  # "mock" 또는 "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    stt_model: str = "whisper-1"
    database_url: str = "sqlite:///./changewatch.db"
    cors_origins: str = "http://localhost:5173"
    # Vercel 미리보기 주소처럼 매번 바뀌는 주소를 허용할 때 사용 (예: https://changewatch-.*\.vercel\.app)
    cors_origin_regex: str = ""
    # 이 값보다 AI 신뢰도가 낮으면 자동 반영하지 않고 사용자 확인을 요청합니다.
    confidence_threshold: float = 0.7

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def use_openai(self) -> bool:
        return self.llm_provider == "openai" and bool(self.openai_api_key)

    @property
    def sqlalchemy_url(self) -> str:
        """Neon·Render가 주는 postgres(ql):// 주소를 psycopg 드라이버 주소로 바꿉니다."""
        url = self.database_url
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix):]
        return url


settings = Settings()
