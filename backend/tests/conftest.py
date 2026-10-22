import os

# 앱 설정을 불러오기 전에 테스트용 값을 먼저 넣습니다. (로컬 .env의 DB·OpenAI 설정을 쓰지 않도록)
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["LLM_PROVIDER"] = "mock"

import pytest  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.services import cost_guard  # noqa: E402


@pytest.fixture(autouse=True)
def no_cost_limits(monkeypatch):
    """테스트는 같은 접속에서 분석을 여러 번 부르므로 요금 보호 제한을 풀어 둡니다.

    제한 자체를 확인하는 테스트(test_cost_guard.py)는 값을 다시 낮춰서 씁니다.
    """
    cost_guard.reset()
    monkeypatch.setattr(settings, "rate_limit_per_minute", 10_000)
    monkeypatch.setattr(settings, "ai_daily_limit", 10_000)
    yield
    cost_guard.reset()
