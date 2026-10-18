"""안내 대상 판별: 이 안내가 '나'에게 하는 말인지 다른 사람에게 하는 말인지 규칙으로 확인합니다.

"37번 환자분 3번 진료실로 오세요"를 듣고 내 진료실을 3번으로 바꾸면 안 되는 경우가 있습니다.
- 대상이 나 (내 번호·이름·예약 시각과 같음) → "me"   : 평소대로 판단
- 대상이 다른 사람                          → "other" : 반영하지 않음 (ignored)
- 대상을 알 수 없음 (내 정보가 없음 등)      → "unknown": 사용자 확인 (pending)
- 대상 표현이 없음 ("진료실이 5번으로 바뀌었습니다") → None
"""

import re
from typing import Literal

from app.services.normalize import fill_meridiem, normalize_value

Audience = Literal["me", "other", "unknown"]

# "12번 환자분", "12번 고객님", "12번님"
NUMBER_CALL_RE = re.compile(r"(?<!\d)0*(\d+)\s*번\s*(?:환자|고객|손님|님)")
# "홍길동님", "홍길동씨", "홍길동 환자분" — 이름 대신 쓰는 일반 호칭은 제외
NAME_CALL_RE = re.compile(r"([가-힣]{2,4})\s*(?:님|씨|환자분|환자님)")
NOT_NAMES = {"환자", "환자분", "보호자", "고객", "고객분", "손님", "여러분", "선생", "의사", "간호사", "원장", "교수",
             "직원", "담당자", "어르신", "어머", "아버", "할머", "할아버"}
# "오전 11시 예약 환자분들은", "2시 검사 예정이신 분은"
TIME_GROUP_RE = re.compile(
    r"((?:오전|오후)?\s*\d+\s*시(?:\s*\d+\s*분)?)\s*(?:예약|진료|검사)\s*(?:환자분?|고객님?|하신|예정이신|받으실)(?:들)?"
)
# "처음 오신 분은", "검사 받으실 분들은" — 누구인지 규칙으로 판단할 수 없음
GENERIC_GROUP_RE = re.compile(r"(?:하신|있으신|계신|오신|받으실|받으신|예정이신|해당하시는|되신)\s*분(?:들)?(?:은|께서는|께서)")


def find_audience_detail(
    evidence: str,
    my_number: str | None = None,
    my_name: str | None = None,
    my_times: list[str] | None = None,
    am_hours: tuple[int, int] = (7, 11),
    groups: dict[str, str | None] | None = None,
) -> tuple[Audience, str] | None:
    """근거 문장에서 안내 대상과 부른 사람(예: "12번", "김철수님", "오전 11시 예약")을 찾습니다.

    my_times: 내 진료·검사 시각 (예: ["오전 11시"])
    groups: 묶음 호출에 쓰이는 항목의 이름과 내 값 (예: {"진료실": "3번"} → "3번 진료실 환자분들은")
    """
    mine = re.sub(r"\D", "", my_number or "").lstrip("0")
    name = (my_name or "").strip()
    results: list[tuple[Audience, str]] = []

    for m in NUMBER_CALL_RE.finditer(evidence):
        who = f"{m.group(1).lstrip('0')}번"
        if not mine:
            results.append(("unknown", who))
        else:
            results.append(("me" if m.group(1).lstrip("0") == mine else "other", who))

    times = {fill_meridiem(normalize_value(t), am_hours) for t in (my_times or [])}
    for m in TIME_GROUP_RE.finditer(evidence):
        called = fill_meridiem(normalize_value(m.group(1)), am_hours)
        who = f"{called} 예약"
        if not times:
            results.append(("unknown", who))
        else:
            results.append(("me" if called in times else "other", who))

    rest = TIME_GROUP_RE.sub(" ", NUMBER_CALL_RE.sub(" ", evidence))
    for label, my_value in (groups or {}).items():
        group_re = re.compile(r"(?<!\d)0*(\d+)\s*번\s*" + re.escape(label) + r"\s*(?:환자|대기)")
        for m in group_re.finditer(evidence):
            mine_digits = re.sub(r"\D", "", my_value or "").lstrip("0")
            who = f"{m.group(1).lstrip('0')}번 {label}"
            if not mine_digits:
                results.append(("unknown", who))
            else:
                results.append(("me" if m.group(1).lstrip("0") == mine_digits else "other", who))
        rest = group_re.sub(" ", rest)

    # "오전 11시 예약 환자분", "3번 진료실 환자분"의 "예약"·"진료실"을 이름으로 잡지 않도록
    # 번호·시간대·묶음 호출 부분을 지운 문장(rest)에서 이름을 찾는다
    for m in NAME_CALL_RE.finditer(rest):
        called = m.group(1)
        if called in NOT_NAMES:
            continue
        who = f"{called}님"
        if not name:
            results.append(("unknown", who))
        else:
            results.append(("me" if called == name or name in called else "other", who))

    if not results and (m := GENERIC_GROUP_RE.search(evidence)):
        results.append(("unknown", m.group(0)))

    # 한 문장에 여러 대상이 있으면: 나를 부른 게 하나라도 있으면 나, 모르는 게 있으면 확인, 모두 남이면 남
    for kind in ("me", "unknown", "other"):
        for k, who in results:
            if k == kind:
                return k, who
    return None


def find_audience(
    evidence: str,
    my_number: str | None = None,
    my_name: str | None = None,
    my_times: list[str] | None = None,
    am_hours: tuple[int, int] = (7, 11),
    groups: dict[str, str | None] | None = None,
) -> Audience | None:
    """안내 대상만 돌려줍니다: "me" / "other" / "unknown" / None."""
    found = find_audience_detail(evidence, my_number, my_name, my_times, am_hours, groups)
    return found[0] if found else None
