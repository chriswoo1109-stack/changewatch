"""시연 시나리오 테스트 (모의 분석기). 실제 AI 점검은 python -m scripts.demo_check --provider openai --repeat 5"""

import json
import os

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("LLM_PROVIDER", "mock")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from scripts.demo_check import DEMO_PATH, run_scenario  # noqa: E402

SCENARIOS = json.loads(DEMO_PATH.read_text(encoding="utf-8"))
client = TestClient(app)


@pytest.mark.parametrize("scenario", SCENARIOS, ids=[s["name"] for s in SCENARIOS])
def test_demo_scenario(scenario):
    problems = [f"{r['text']}: {p}" for r in run_scenario(client, scenario) for p in r["problems"]]
    assert not problems, "\n".join(problems)
