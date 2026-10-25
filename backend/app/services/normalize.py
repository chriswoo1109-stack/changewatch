"""값 정규화: 한글 숫자·표현 차이를 통일해 같은 값을 같게 비교합니다.

"오후 세 시" → "오후 3시", "오 번" → "5번", "두 시 반" → "2시 30분"

원문 전체가 아니라 '값'에만 씁니다. (원문을 바꾸면 verifier의 근거 문장 검사가 깨집니다)
숫자 단어 바로 뒤에 단위가 올 때만 바꿔서 "오후", "들어오세요", "이번" 같은 말은 건드리지 않습니다.
"""

import re

# 고유어 숫자: 시각(세 시), 횟수(두 번)에 쓰입니다. 긴 단어를 먼저 둬야 "열한"이 "열"+"한"으로 잘리지 않습니다.
NATIVE = {"열두": 12, "열한": 11, "열": 10, "아홉": 9, "여덟": 8, "일곱": 7,
          "여섯": 6, "다섯": 5, "네": 4, "세": 3, "두": 2, "한": 1}
SINO_DIGITS = {"일": 1, "이": 2, "삼": 3, "사": 4, "오": 5, "육": 6, "칠": 7, "팔": 8, "구": 9}
UNITS = "개월|시|번|층|분|회|주|일|호"

# 앞에 다른 한글이 붙어 있으면 숫자로 보지 않습니다. 단 "오후세시"처럼 오전/오후 뒤는 허용합니다.
BOUNDARY = r"(?:(?<![가-힣])|(?<=오전)|(?<=오후))"

# 단위 뒤에 "호·정·의"가 오면 "번호", "일정", "주의"라서 숫자가 아닙니다
NOT_UNIT = r"(?!호|정|의)"
# 시각(세 시)·횟수(두 번)·복약 단위(한 봉, 두 알, 한 포). "정"은 "네 정말"이 "4정말"이 돼서 넣지 않음
NATIVE_RE = re.compile(BOUNDARY + r"(" + "|".join(NATIVE) + r")\s*(시|번|회|봉|알|포)" + NOT_UNIT)
SINO_RE = re.compile(BOUNDARY + r"([일이삼사오육칠팔구십백]+)(\s*)(" + UNITS + r")" + NOT_UNIT)


def sino_to_int(word: str) -> int | None:
    """한자어 숫자(삼십오 → 35)를 정수로 바꿉니다. 해석할 수 없으면 None."""
    total, current = 0, 0
    for ch in word:
        if ch in SINO_DIGITS:
            if current:
                return None  # "삼오"처럼 자릿수 없이 이어지면 숫자가 아님
            current = SINO_DIGITS[ch]
        elif ch == "십":
            total += (current or 1) * 10
            current = 0
        elif ch == "백":
            total += (current or 1) * 100
            current = 0
    return total + current


def _native(m: re.Match) -> str:
    word, unit = m.group(1), m.group(2)
    # "한"은 흔한 글자라("한시적") 띄어 썼을 때만 숫자로 봅니다
    if word == "한" and m.group(0) == "한" + unit:
        return m.group(0)
    return f"{NATIVE[word]}{unit}"


def _sino(m: re.Match) -> str:
    word, space, unit = m.groups()
    # 한 글자 숫자를 붙여 쓴 경우("이번", "이분", "일일")는 일반 단어일 가능성이 커서 그대로 둡니다
    if len(word) == 1 and not space:
        return m.group(0)
    n = sino_to_int(word)
    return m.group(0) if n is None else f"{n}{unit}"


def normalize_value(value: str | None) -> str | None:
    if value is None:
        return None
    v = re.sub(r"\s+", " ", value).strip()
    v = NATIVE_RE.sub(_native, v)
    v = SINO_RE.sub(_sino, v)
    v = re.sub(r"(\d+)\s*시\s*반", r"\1시 30분", v)            # 세 시 반 → 3시 30분
    v = re.sub(r"(\d)\s+(" + UNITS + r")", r"\1\2", v)         # 3 시 → 3시
    v = re.sub(r"(오전|오후)\s*(\d)", r"\1 \2", v)              # 오후3시 → 오후 3시
    v = re.sub(r"(\d+시)\s*(\d+분)", r"\1 \2", v)               # 3시30분 → 3시 30분
    return v or None


# "3시간"은 시각이 아니라 기간이므로 제외합니다
HOUR_RE = re.compile(r"(?<!\d)(\d{1,2})시(?!간)")


def fill_meridiem(value: str | None, am_hours: tuple[int, int] = (7, 11)) -> str | None:
    """운영 시간 기준 오전/오후 보정: 오전/오후 없이 말한 시각에 붙여 줍니다.

    am_hours=(7, 11)이면 7~11시 → 오전, 12시·1~6시 → 오후, 13~23시 → 오후 (n-12)시.
    병원에서 "1시"는 거의 항상 오후 1시라는 점을 이용합니다. 이미 오전/오후가 있으면 그대로 둡니다.
    """
    if value is None or re.search(r"오전|오후", value):
        return value
    start, end = am_hours

    def repl(m: re.Match) -> str:
        h = int(m.group(1))
        if 13 <= h <= 23:
            return f"오후 {h - 12}시"
        if start <= h <= end:
            return f"오전 {h}시"
        if 1 <= h <= 12:
            return f"오후 {h}시"
        return m.group(0)  # 0시, 24시 등은 판단하지 않음

    return HOUR_RE.sub(repl, value)
