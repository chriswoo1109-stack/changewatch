"""시연 점검 스크립트 (C 담당).

tests/fixtures/demo.json의 시연 시나리오를 실제 API 흐름(세션 생성 → 안내 분석을 순서대로)으로 실행해
단계마다 판단 결과·현재 정보·할 일·내 차례가 기대와 같은지 확인합니다.
실제 AI는 같은 문장에도 답이 조금씩 달라서, 여러 번 반복해 '매번' 맞는지 봅니다.

실행 (backend 폴더에서):
    python -m scripts.demo_check                              # 모의 분석기
    python -m scripts.demo_check --provider openai --repeat 5 # 실제 AI로 5번 반복 (비용 발생)

시나리오 형식 (단계마다):
    "changes": {"room": "applied"}   key별 판단 (허용 목록 ["ignored", null], null = 후보 없음)
                                      여기 없는 key가 applied 되면 실패
    "facts": {"room": "3번"}          분석 후 현재 정보 전체 (정확히 같아야 함)
    "needs_confirmation", "todos"(최소 개수), "my_turn"(불렸는지)   (선택)
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

DEMO_PATH = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "demo.json"


def as_list(x) -> list:
    return x if isinstance(x, list) else [x]


def check_step(step: dict, result: dict, facts: dict) -> list[str]:
    """한 단계의 결과를 기대와 비교해 문제 목록을 돌려줍니다 (비어 있으면 통과)."""
    problems = []
    statuses = {c["key"]: c["status"] for c in result["changes"]}  # 같은 key는 마지막 판단
    for key, expected in step["changes"].items():
        if statuses.get(key) not in as_list(expected):
            problems.append(f"{key}: 기대 {expected} / 실제 {statuses.get(key)}")
    for key, status in statuses.items():
        if status == "applied" and key not in step["changes"]:
            problems.append(f"{key}: 반영되면 안 되는데 applied")
    if facts != step["facts"]:
        problems.append(f"현재 정보: 기대 {step['facts']} / 실제 {facts}")
    if "needs_confirmation" in step and result["needs_confirmation"] != step["needs_confirmation"]:
        problems.append(f"확인 요청: 기대 {step['needs_confirmation']} / 실제 {result['needs_confirmation']}")
    if "todos" in step and len(result.get("todos", [])) < step["todos"]:
        problems.append(f"할 일: 기대 {step['todos']}개 이상 / 실제 {len(result.get('todos', []))}개")
    if "my_turn" in step and bool(result.get("my_turn")) != step["my_turn"]:
        problems.append(f"내 차례: 기대 {step['my_turn']} / 실제 {result.get('my_turn')}")
    return problems


def run_scenario(client, scenario: dict) -> list[dict]:
    """시나리오를 처음부터 끝까지 실행합니다. client는 FastAPI TestClient."""
    sid = client.post("/api/sessions", json=scenario["session"]).json()["id"]
    results = []
    for step in scenario["steps"]:
        start = time.time()
        r = client.post(f"/api/sessions/{sid}/announcements", json={"text": step["text"]})
        seconds = time.time() - start
        if r.status_code != 200:
            results.append({"text": step["text"], "problems": [f"HTTP {r.status_code}: {r.text}"], "changes": [],
                            "seconds": seconds})
            continue
        result = r.json()
        facts = {f["key"]: f["value"] for f in client.get(f"/api/sessions/{sid}").json()["facts"]}
        results.append({"text": step["text"], "problems": check_step(step, result, facts), "changes": result["changes"],
                        "seconds": seconds})
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="시연 시나리오 점검")
    parser.add_argument("--provider", choices=["mock", "openai"], default="mock")
    parser.add_argument("--repeat", type=int, default=1, help="반복 횟수 (실제 AI는 3~5회 권장)")
    args = parser.parse_args()

    # 점검용 DB를 따로 써서 개발 DB를 건드리지 않습니다. (app import 전에 설정)
    db_file = Path("demo_check.db")
    os.environ["DATABASE_URL"] = f"sqlite:///./{db_file}"
    os.environ["LLM_PROVIDER"] = args.provider

    from fastapi.testclient import TestClient

    from app.core.config import settings
    from app.main import app
    from app.services import llm_extractor

    if args.provider == "openai" and not settings.use_openai:
        print("OPENAI_API_KEY가 .env에 없습니다.", file=sys.stderr)
        return 1

    # AI 호출이 실패하면 앱은 조용히 모의 분석기로 대체합니다. 점검에서는 그 사실을 드러냅니다.
    fallbacks = []
    original = llm_extractor.OpenAIExtractor.extract

    def watched(self, text, *a, **kw):
        try:
            return original(self, text, *a, **kw)
        except Exception as e:
            fallbacks.append(f"{text} → {e!r}")
            raise

    llm_extractor.OpenAIExtractor.extract = watched

    scenarios = json.loads(DEMO_PATH.read_text(encoding="utf-8"))
    fails: dict[str, int] = {}
    total_steps = 0
    times: list[tuple[float, str]] = []
    try:
        with TestClient(app) as client:
            for n in range(1, args.repeat + 1):
                print(f"\n===== {n}회차 ({args.provider})")
                for sc in scenarios:
                    print(f"[{sc['name']}]")
                    for res in run_scenario(client, sc):
                        total_steps += 1
                        times.append((res["seconds"], res["text"]))
                        if res["problems"]:
                            fails[res["text"]] = fails.get(res["text"], 0) + 1
                            print(f"  X {res['text']}")
                            for p in res["problems"]:
                                print(f"      {p}")
                            for c in res["changes"]:
                                print(f"      - {c['key']}={c['new_value']!r} {c['change_type']} → {c['status']} ({c['reason']})")
                        else:
                            print(f"  O {res['text']}")
    finally:
        from app.db import engine

        engine.dispose()  # Windows는 연결이 열려 있으면 파일을 지울 수 없습니다
        db_file.unlink(missing_ok=True)

    print("\n--- 요약 ---")
    print(f"단계 통과: {total_steps - sum(fails.values())}/{total_steps}")
    if times:
        slowest = max(times)
        print(f"분석 응답 시간: 평균 {sum(t for t, _ in times) / len(times):.1f}초, "
              f"최대 {slowest[0]:.1f}초 ({slowest[1]})")
    for text, count in fails.items():
        print(f"  {count}/{args.repeat}회 실패: {text}")
    if fallbacks:
        print(f"AI 호출 실패로 모의 분석기 대체: {len(fallbacks)}회")
        for f in fallbacks[:5]:
            print(f"  {f}")
    return 1 if fails or fallbacks else 0


if __name__ == "__main__":
    sys.exit(main())
