"""발표용 비교표 (C 담당): 같은 AI 답변을 세 가지 판단 방식에 넣어 규칙 검증의 효과를 숫자로 보여줍니다.

    ① AI 단독      : AI가 말한 변경 유형대로 저장 (언급은 무시, 불확실은 확인만)
    ② 기본 규칙    : 프로젝트 시작 때의 verifier 8개 규칙 (첫 커밋 그대로 옮김)
    ③ 안전장치 추가: 지금의 verifier (정규화, 불확실 표현, 값 형식, 안내 대상, 상태 설명 등)

AI 답변은 문장마다 한 번만 받아 세 방식에 똑같이 넣으므로, 차이는 오로지 판단 방식에서 나옵니다.
실제 AI는 같은 문장에도 답이 조금씩 달라서 --repeat 번 반복해 평균을 냅니다.

실행 (backend 폴더에서):
    python -m scripts.report --provider openai --repeat 3 --out report.md   # 비용: 평가 3회분 (docs/evaluation.md는 덮어쓰지 말 것)
    python -m scripts.report                                                       # 모의 분석기 (무료)
"""

import argparse
import json
import re
import sys
from pathlib import Path

from app.core.config import settings
from app.domains import am_hours, item_labels, time_keys
from app.services.llm_extractor import MockExtractor, OpenAIExtractor
from app.services.normalize import fill_meridiem, normalize_value
from app.services.verifier import Decision, verify
from scripts.evaluate import AI_FAILURES, DOMAIN, FIXTURES, as_list, extract_like_app, score_case, watch_ai_failures


def ai_only(candidates, facts, text, keys, **_) -> list[Decision]:
    """① AI 단독: 검증 없이 AI의 변경 유형을 그대로 따릅니다."""
    current, out = dict(facts), []
    for c in candidates:
        old = current.get(c.key)
        if c.change_type == "mention":
            status = "ignored"
        elif c.change_type == "uncertain":
            status = "pending"
        elif c.change_type == "cancel":
            status = "applied" if old is not None else "ignored"
        else:
            status = "applied"
        out.append(Decision(c, status, "", old))
        if status == "applied":
            if c.change_type == "cancel":
                current.pop(c.key, None)
            elif c.value:
                current[c.key] = c.value
    return out


def basic_rules(candidates, facts, text, keys, **_) -> list[Decision]:
    """② 기본 규칙: 프로젝트 첫 커밋(e362760)의 verifier. 비교 기준이므로 고치지 않습니다."""
    threshold = settings.confidence_threshold
    current, out = dict(facts), []
    for c in candidates:
        old = current.get(c.key)
        if c.evidence.strip() not in text or c.key not in keys:
            status = "pending"
        elif c.change_type == "mention":
            status = "ignored"
        elif c.change_type == "uncertain" or c.confidence < threshold:
            status = "pending"
        elif c.change_type == "cancel":
            status = "applied" if old is not None else "ignored"
        elif not c.value:
            status = "pending"
        elif old == c.value:
            status = "ignored"
        elif c.change_type == "new" and old is not None:
            status = "pending"
        else:
            status = "applied"
        out.append(Decision(c, status, "", old))
        if status == "applied":
            if c.change_type == "cancel":
                current.pop(c.key, None)
            elif c.value:
                current[c.key] = c.value
    return out


def full_verifier(candidates, facts, text, keys, me) -> list[Decision]:
    """③ 안전장치 추가: 지금 앱이 쓰는 verifier."""
    return verify(candidates, facts, text, keys, domain=DOMAIN, **me)


MODES = [("① AI 단독", ai_only), ("② 기본 규칙", basic_rules), ("③ 안전장치 추가", full_verifier)]


def same_info(key: str, a: str | None, b: str | None) -> bool:
    """표기만 다른 같은 정보인지 ("1시" = "오후 1시", "오후 세 시" = "오후 3시", 공백 차이)."""
    def norm(v):
        v = normalize_value(v)
        v = fill_meridiem(v, am_hours(DOMAIN)) if key in time_keys(DOMAIN) else v
        return None if v is None else re.sub(r"[\s,.]", "", v)
    return norm(a) == norm(b)


def wrong_saved(case: dict, decisions: list[Decision], after: dict) -> bool:
    """저장 결과 틀린 정보가 '현재 정보'에 남았는지. 같은 값을 다시 저장하거나 표기만 다른 건 틀린 게 아닙니다."""
    for key in {d.candidate.key for d in decisions if d.status == "applied"}:
        if key in case["expect"]:
            expected = case["expect"][key][1]
            if expected != "*" and not any(same_info(key, after.get(key), e) for e in as_list(expected)):
                return True
        elif not same_info(key, after.get(key), case["facts"].get(key)):
            return True
    return False


def summarize(scores: list[dict]) -> dict:
    """한 번의 실행(전체 문장) 결과를 숫자로 요약합니다."""
    return {
        "passed": sum(s["passed"] for s in scores),
        "wrong": sum(s["wrong_saved"] for s in scores),
        "pending": sum(s["pending"] for s in scores),
        "missed": sum(len(s["missed"]) for s in scores),
    }


def fmt(values: list[int]) -> str:
    """반복 결과를 "평균 (최소~최대)"로 보여줍니다. 한 번뿐이면 숫자만."""
    avg = sum(values) / len(values)
    text = f"{avg:.1f}".rstrip("0").rstrip(".")
    return text if min(values) == max(values) else f"{text} ({min(values)}~{max(values)})"


def main() -> int:
    parser = argparse.ArgumentParser(description="발표용 비교표")
    parser.add_argument("--provider", choices=["mock", "openai"], default="mock")
    parser.add_argument("--repeat", type=int, default=1)
    parser.add_argument("--out", help="Markdown 표 저장 경로")
    parser.add_argument("--fixtures", default=str(FIXTURES),
                        help="문장 세트 파일 (기본 sentences.json, 처음 보는 문장은 tests/fixtures/heldout.json)")
    args = parser.parse_args()

    if args.provider == "openai":
        if not settings.openai_api_key:
            print("OPENAI_API_KEY가 .env에 없습니다.", file=sys.stderr)
            return 1
        extractor = OpenAIExtractor()
        watch_ai_failures()
    else:
        extractor = MockExtractor()

    cases = json.loads(Path(args.fixtures).read_text(encoding="utf-8"))
    if not cases:
        print(f"{args.fixtures}에 문장이 없습니다.", file=sys.stderr)
        return 1
    keys = set(item_labels(DOMAIN))
    runs = {name: [] for name, _ in MODES}            # 방식별 · 회차별 요약
    rescued: dict[str, dict] = {}                     # AI 단독은 잘못 저장했는데 ③이 막은 문장 (발표 예시)
    remaining: dict[str, dict] = {}                   # ③에서도 남은 잘못된 저장 (발표의 '남은 한계')
    errors = 0

    for n in range(1, args.repeat + 1):
        print(f"{n}/{args.repeat}회차 분석 중...", file=sys.stderr)
        per_mode = {name: [] for name, _ in MODES}
        for case in cases:
            facts, me = case["facts"], case.get("me", {})
            try:
                candidates = extract_like_app(extractor, case["text"], facts, me).candidates
            except Exception:
                errors += 1
                candidates = []
            for name, judge in MODES:
                decisions = judge(candidates, facts, case["text"], keys, me=me)
                score = score_case(case, decisions)
                score["wrong_saved"] = wrong_saved(case, decisions, score["after"])
                per_mode[name].append(score)
                if name == "③ 안전장치 추가" and score["wrong_saved"]:
                    saved = {k: score["after"].get(k) for k in {d.candidate.key for d in decisions if d.status == "applied"}}
                    info = remaining.setdefault(case["text"], {"count": 0, "saved": saved,
                                                               "expected": {k: v[1] for k, v in case["expect"].items()}})
                    info["count"] += 1
                if name == "③ 안전장치 추가" and per_mode["① AI 단독"][-1]["wrong_saved"] and not score["wrong_saved"]:
                    blocked = [d.reason for d in decisions if d.status != "applied"]
                    info = rescued.setdefault(case["text"], {"count": 0, "reason": blocked[0] if blocked else "규칙 검증이 결과를 바로잡음"})
                    info["count"] += 1
        for name in runs:
            runs[name].append(summarize(per_mode[name]))

    total = len(cases)
    lines = [
        f"### 규칙 검증 효과 ({args.provider}, {Path(args.fixtures).name} {total}문장 × {args.repeat}회)",
        "",
        "| 판단 방식 | 문장 정답 | 잘못된 저장 | 확인 요청 | 놓친 반영 |",
        "|---|---|---|---|---|",
    ]
    for name, _ in MODES:
        r = runs[name]
        lines.append(f"| {name} | {fmt([x['passed'] for x in r])} / {total} | {fmt([x['wrong'] for x in r])}건 "
                     f"| {fmt([x['pending'] for x in r])}건 | {fmt([x['missed'] for x in r])}건 |")
    lines += [
        "",
        "- **잘못된 저장**: 저장 결과 '현재 정보'가 틀리게 된 문장 수 (같은 값 재저장, '1시'와 '오후 1시' 같은 표기 차이는 제외)",
        "- **확인 요청**: 자동 반영하지 않고 사용자에게 물은 횟수 (안전의 대가)",
        "- **놓친 반영**: 반영해야 하는데 반영하지 않은 항목 수",
        "- 같은 AI 답변을 세 방식에 넣었으므로 차이는 판단 방식에서만 나옵니다. 괄호는 반복 중 최소~최대.",
    ]
    if rescued:
        lines += ["", f"#### AI 단독이면 잘못 저장됐지만 규칙 검증이 막은 문장 ({len(rescued)}개)", "",
                  "| 안내 문장 | 막은 이유 | 횟수 |", "|---|---|---|"]
        for text, info in sorted(rescued.items(), key=lambda x: -x[1]["count"]):
            lines.append(f"| {text} | {info['reason']} | {info['count']}/{args.repeat} |")
    if remaining:
        lines += ["", f"#### 규칙 검증 후에도 남은 잘못된 저장 ({len(remaining)}개)", "",
                  "| 안내 문장 | 저장된 값 | 기대 값 | 횟수 |", "|---|---|---|---|"]
        for text, info in sorted(remaining.items(), key=lambda x: -x[1]["count"]):
            lines.append(f"| {text} | {info['saved']} | {info['expected']} | {info['count']}/{args.repeat} |")
    if errors:
        lines += ["", f"(AI 분석 오류 {errors}회는 후보 없음으로 처리)"]
    if AI_FAILURES:
        lines += ["", f"⚠ AI 호출 실패 {len(AI_FAILURES)}회: 모의 분석기 판단이 섞였으므로 이 표는 쓰지 말고 다시 측정하세요."]

    report = "\n".join(lines)
    print(report)
    if args.out:
        Path(args.out).write_text(report + "\n", encoding="utf-8")
        print(f"\n저장: {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
