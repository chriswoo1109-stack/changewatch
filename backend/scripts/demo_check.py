"""시연 점검 스크립트 (C 담당).

tests/fixtures/demo.json의 시연 시나리오를 실제 API 흐름(세션 생성 → 안내 분석을 순서대로)으로 실행해
단계마다 판단 결과·현재 정보·할 일·내 차례가 기대와 같은지 확인합니다.
실제 AI는 같은 문장에도 답이 조금씩 달라서, 여러 번 반복해 '매번' 맞는지 봅니다.

실행 (backend 폴더에서):
    python -m scripts.demo_check                              # 모의 분석기
    python -m scripts.demo_check --provider openai --repeat 5 # 실제 AI로 5번 반복 (비용 발생)
    python -m scripts.demo_check --base-url https://<배포 주소>  # 배포된 서버에 직접 요청 (배포 직후·발표 전 점검)

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


def run_scenario(client, scenario: dict, title_prefix: str = "", pause: float = 0.0) -> list[dict]:
    """시나리오를 처음부터 끝까지 실행합니다. client는 FastAPI TestClient 또는 httpx.Client(배포 서버).

    pause: 분석 요청 사이 쉬는 초. 배포 서버의 요금 보호(같은 접속 1분 N회)에 걸리지 않게 합니다.
    """
    session = {**scenario["session"], "title": title_prefix + scenario["session"]["title"]}
    sid = client.post("/api/sessions", json=session).json()["id"]
    results = []
    for step in scenario["steps"]:
        start = time.time()
        r = client.post(f"/api/sessions/{sid}/announcements", json={"text": step["text"]})
        seconds = time.time() - start
        if pause:
            time.sleep(pause)
        if r.status_code == 429:
            results.append({"text": step["text"], "changes": [], "seconds": seconds,
                            "problems": ["요금 보호 제한(같은 접속 1분 호출 수)에 걸림 → --per-minute를 낮춰 다시 실행"]})
            continue
        if r.status_code != 200:
            results.append({"text": step["text"], "problems": [f"HTTP {r.status_code}: {r.text}"], "changes": [],
                            "seconds": seconds})
            continue
        result = r.json()
        facts = {f["key"]: f["value"] for f in client.get(f"/api/sessions/{sid}").json()["facts"]}
        results.append({"text": step["text"], "problems": check_step(step, result, facts), "changes": result["changes"],
                        "seconds": seconds})
    return results


def run_all(client, scenarios: list[dict], repeat: int, label: str, title_prefix: str = "", pause: float = 0.0) -> bool:
    """시나리오를 repeat번 실행하고 결과·요약을 출력합니다. 모두 통과하면 True."""
    fails: dict[str, int] = {}
    total_steps = 0
    times: list[tuple[float, str]] = []
    for n in range(1, repeat + 1):
        print(f"\n===== {n}회차 ({label})")
        for sc in scenarios:
            print(f"[{sc['name']}]")
            for res in run_scenario(client, sc, title_prefix, pause):
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

    print("\n--- 요약 ---")
    print(f"단계 통과: {total_steps - sum(fails.values())}/{total_steps}")
    if times:
        slowest = max(times)
        print(f"분석 응답 시간: 평균 {sum(t for t, _ in times) / len(times):.1f}초, "
              f"최대 {slowest[0]:.1f}초 ({slowest[1]})")
    for text, count in fails.items():
        print(f"  {count}/{repeat}회 실패: {text}")
    return not fails


def check_deployed(base_url: str, scenarios: list[dict], repeat: int, per_minute: int) -> int:
    """배포된 서버에 직접 요청합니다. 서버 깨우기 시간과 AI 설정을 먼저 확인합니다."""
    import httpx

    with httpx.Client(base_url=base_url.rstrip("/"), timeout=90) as client:
        # Render 무료 서버는 15분 쉬면 잠들어 첫 요청이 오래 걸립니다
        start = time.time()
        try:
            health = client.get("/api/health").json()
        except httpx.HTTPError as e:
            print(f"서버에 연결하지 못했습니다: {e!r}", file=sys.stderr)
            return 1
        print(f"서버 응답: {time.time() - start:.1f}초 (잠들어 있었다면 깨우는 시간 포함), AI 설정: {health.get('llm_provider')}")
        if health.get("llm_provider") != "openai":
            print("⚠ 배포 서버가 모의 분석기로 설정돼 있습니다. Render 환경변수 LLM_PROVIDER·OPENAI_API_KEY를 확인하세요.")

        # 점검으로 만든 세션은 배포 DB에 남으므로 제목으로 구분합니다.
        # 서버의 요금 보호(기본 1분 20회)를 넘지 않게 분석 요청 사이에 쉽니다. 하루 AI 한도도 그만큼 씁니다.
        steps = sum(len(sc["steps"]) for sc in scenarios) * repeat
        print(f"분석 요청 {steps}번을 1분에 {per_minute}번 이하로 보냅니다 (약 {steps * 60 / per_minute / 60:.1f}분)")
        ok = run_all(client, scenarios, repeat, base_url, title_prefix="[시연 점검] ", pause=60 / per_minute)

    print("(AI 호출이 실행 중에 실패해 모의 분석기로 대체된 경우는 밖에서 보이지 않습니다. "
          "Render 로그에서 'AI 분석 실패 → 모의 분석기로 대체'를 확인하세요.)")
    return 0 if ok and health.get("llm_provider") == "openai" else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="시연 시나리오 점검")
    parser.add_argument("--provider", choices=["mock", "openai"], default="mock", help="로컬 점검에서 쓸 분석기")
    parser.add_argument("--repeat", type=int, default=1, help="반복 횟수 (실제 AI는 3~5회 권장)")
    parser.add_argument("--base-url", help="배포 서버 주소 (예: https://changewatch.onrender.com). 주면 로컬 대신 그 서버로 점검")
    parser.add_argument("--per-minute", type=int, default=18,
                        help="배포 서버 점검 때 1분에 보낼 분석 요청 수 (서버 RATE_LIMIT_PER_MINUTE보다 작게, 기본 18)")
    args = parser.parse_args()

    scenarios = json.loads(DEMO_PATH.read_text(encoding="utf-8"))
    if args.base_url:
        return check_deployed(args.base_url, scenarios, args.repeat, args.per_minute)

    # 점검용 DB를 따로 써서 개발 DB를 건드리지 않습니다. (app import 전에 설정)
    db_file = Path("demo_check.db")
    os.environ["DATABASE_URL"] = f"sqlite:///./{db_file}"
    os.environ["LLM_PROVIDER"] = args.provider
    # 이 점검용 앱 안에서만 요금 보호를 풉니다 (tests/conftest.py와 같음). 같은 접속에서 빠르게 여러 번 부르고,
    # 하루 한도에 닿으면 표시 없이 모의 분석기로 넘어가 점검 결과가 틀어지기 때문입니다.
    os.environ["RATE_LIMIT_PER_MINUTE"] = "100000"
    os.environ["AI_DAILY_LIMIT"] = "100000"

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

    try:
        with TestClient(app) as client:
            ok = run_all(client, scenarios, args.repeat, args.provider)
    finally:
        from app.db import engine

        engine.dispose()  # Windows는 연결이 열려 있으면 파일을 지울 수 없습니다
        db_file.unlink(missing_ok=True)

    if fallbacks:
        print(f"AI 호출 실패로 모의 분석기 대체: {len(fallbacks)}회")
        for f in fallbacks[:5]:
            print(f"  {f}")
    return 0 if ok and not fallbacks else 1


if __name__ == "__main__":
    sys.exit(main())
