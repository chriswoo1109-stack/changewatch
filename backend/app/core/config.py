from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """환경변수(.env)에서 설정을 읽어옵니다."""

    llm_provider: str = "mock"  # "mock" 또는 "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    stt_model: str = "whisper-1"
    database_url: str = "sqlite:///./changewatch.db"
    cors_origins: str = "http://localhost:5173"
    # 이 값보다 AI 신뢰도가 낮으면 자동 반영하지 않고 사용자 확인을 요청합니다.
    confidence_threshold: float = 0.7

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def use_openai(self) -> bool:
        return self.llm_provider == "openai" and bool(self.openai_api_key)


settings = Settings()
