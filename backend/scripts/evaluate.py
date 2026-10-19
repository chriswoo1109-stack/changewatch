"""변경 판단 정확도 평가 스크립트 (C 담당).

tests/fixtures/sentences.json 문장 세트를 분석기 + verifier에 통과시켜
기대 결과와 얼마나 맞는지 측정합니다. pytest와 달리 실제 OpenAI도 평가할 수 있습니다.

실행 (backend 폴더에서):
    python -m scripts.evaluate                     # 모의 분석기(mock)
    python -m scripts.evaluate --provider openai   # 실제 AI (.env의 OPENAI_API_KEY 필요, 비용 발생)
    python -m scripts.evaluate --tag mention       # 특정 유형만
    python -m scripts.evaluate --out result.json   # 결과를 파일로 저장 (프롬프트 개선 전후 비교용)

문장 세트 형식:
    "expect": {"key": [기대 status, 분석 후 기대 값]}
    - status: "applied" 등 하나, 또는 허용 목록 ["ignored", null]  (null = 후보를 만들지 않음)
    - 값: 문자열 하나, 허용 목록 ["11시", "오전 11시"], null(값 없음), "*"(값은 채점하지 않음)
    - expect에 없는 key가 applied 되면 '잘못된 반영'으로 실패 처리합니다.
    - me: 이 사용자 정보 {"my_number": "37", "my_name": "홍길동"} (선택, 없으면 모름)
    - mock_xfail: 모의 분석기의 한계로 틀려도 되는 문장 (pytest에서 xfail 처리)
"""

import argparse
import json
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

from app.core.config import settings
from app.domains import item_labels
from app.services.llm_extractor import MockExtractor, OpenAIExtractor
from app.services.verifier import verify

FIXTURES = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "sentences.json"
DOMAIN = "hospital"


def as_list(x) -> list:
    return x if isinstance(x, list) else [x]


def normalize(value: str | None) -> str | None:
    """채점용 정규화: 공백과 쉼표·마침표 차이는 같은 값으로 봅니다."""
    return None if value is None else re.sub(r"[\s,.]", "", value)


def value_ok(actual: str | None, expected) -> bool:
    if expected == "*":
        return bool(actual)
    return normalize(actual) in [normalize(e) for e in as_list(expected)]


def run_case(extractor, case: dict, keys: set[str]) -> dict:
    facts, me = case["facts"], case.get("me", {})
    candidates = extractor.extract(case["text"], DOMAIN, facts, **me).candidates
    decisions = verify(candidates, facts, case["text"], keys, domain=DOMAIN, **me)
    return score_case(case, decisions)


def score_case(case: dict, decisions: list) -> dict:
    """판단 결과(Decision 목록)를 문장 세트의 기대 결과와 비교해 채점합니다."""
    facts = case["facts"]
    after = dict(facts)
    statuses: dict[str, str] = {}  # 같은 key가 여러 번 나오면 마지막 판단
    for d in decisions:
        statuses[d.candidate.key] = d.status
        if d.status == "applied":
            if d.candidate.change_type == "cancel":
                after.pop(d.candidate.key, None)
            else:
                after[d.candidate.key] = d.candidate.value

    checks = []
    for key, (exp_status, exp_value) in case["expect"].items():
        checks.append({
            "key": key,
            "status_ok": statuses.get(key) in as_list(exp_status),
            "value_ok": value_ok(after.get(key), exp_value),
            "expected": [exp_status, exp_value],
            "actual": [statuses.get(key), after.get(key)],
        })
    # 반영되면 안 되는 항목이 반영되면 사용자에게 틀린 정보를 보여주게 되므로 실패
    # (기대 목록에 없는 항목이 applied, 또는 기대 status에 applied가 없는데 applied)
    wrong_applied = [
        k for k, s in statuses.items()
        if s == "applied" and (k not in case["expect"] or "applied" not in as_list(case["expect"][k][0]))
    ]

    return {
        "name": case["name"],
        "tags": case.get("tags", []),
        "passed": all(c["status_ok"] and c["value_ok"] for c in checks) and not wrong_applied,
        "checks": checks,
        "wrong_applied": wrong_applied,
        "after": after,
        "pending": sum(d.status == "pending" for d in decisions),
        # 반영해야 하는데(applied만 정답) 반영하지 않은 항목
        "missed": [c["key"] for c in checks if as_list(c["expected"][0]) == ["applied"] and c["actual"][0] != "applied"],
        "candidates": [
            {**d.candidate.model_dump(), "status": d.status, "reason": d.reason} for d in decisions
        ],
    }


def pct(n: int, total: int) -> str:
    return f"{n}/{total} ({n / total * 100:.0f}%)" if total else "-"


def print_report(results: list[dict], provider: str, elapsed: float) -> None:
    print(f"\n=== 변경 판단 평가: {provider} / {DOMAIN} / {len(results)}문장 / {elapsed:.1f}초 ===\n")

    for r in results:
        mark = "O" if r["passed"] else "X"
        print(f"[{mark}] {r['name']}")
        if r["passed"]:
            continue
        if r.get("error"):
            print(f"      오류: {r['error']}")
            continue
        for c in r["checks"]:
            if not (c["status_ok"] and c["value_ok"]):
                print(f"      {c['key']}: 기대 {c['expected']} / 실제 {c['actual']}")
        if r["wrong_applied"]:
            print(f"      잘못 반영된 항목: {r['wrong_applied']}")
        for cand in r["candidates"]:
            print(f"      - 후보 {cand['key']}={cand['value']!r} {cand['change_type']} "
                  f"({cand['confidence']}) → {cand['status']}")

    checks = [c for r in results for c in r["checks"]]
    print("\n--- 요약 ---")
    print(f"문장 정답률      : {pct(sum(r['passed'] for r in results), len(results))}")
    print(f"status 정답률    : {pct(sum(c['status_ok'] for c in checks), len(checks))}")
    print(f"값 정답률        : {pct(sum(c['value_ok'] for c in checks), len(checks))}")
    print(f"잘못된 반영 문장 : {sum(bool(r.get('wrong_applied')) for r in results)}")
    print(f"분석 오류        : {sum(bool(r.get('error')) for r in results)}")

    by_tag: dict[str, list[bool]] = defaultdict(list)
    for r in results:
        for t in r["tags"]:
            by_tag[t].append(r["passed"])
    print("\n--- 유형별 문장 정답률 ---")
    for tag, passed in sorted(by_tag.items()):
        print(f"{tag:<14}: {pct(sum(passed), len(passed))}")


def main() -> int:
    parser = argparse.ArgumentParser(description="변경 판단 정확도 평가")
    parser.add_argument("--provider", choices=["mock", "openai"], default="mock")
    parser.add_argument("--tag", help="이 태그가 붙은 문장만 평가")
    parser.add_argument("--out", help="결과 JSON 저장 경로")
    args = parser.parse_args()

    if args.provider == "openai":
        if not settings.openai_api_key:
            print("OPENAI_API_KEY가 .env에 없습니다.", file=sys.stderr)
            return 1
        extractor = OpenAIExtractor()
    else:
        extractor = MockExtractor()

    cases = json.loads(FIXTURES.read_text(encoding="utf-8"))
    if args.tag:
        cases = [c for c in cases if args.tag in c.get("tags", [])]
    keys = set(item_labels(DOMAIN))

    start = time.time()
    results = []
    for case in cases:
        try:
            results.append(run_case(extractor, case, keys))
        except Exception as e:  # AI 응답 형식 오류 등도 '실패'로 집계
            results.append({"name": case["name"], "tags": case.get("tags", []), "passed": False,
                            "checks": [], "wrong_applied": [], "candidates": [], "error": repr(e)})
    elapsed = time.time() - start

    print_report(results, args.provider, elapsed)

    if args.out:
        payload = {"provider": args.provider,
                   "model": settings.openai_model if args.provider == "openai" else None,
                   "results": results}
        Path(args.out).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n결과 저장: {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
