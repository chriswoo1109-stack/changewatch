"""내 차례 감지. 안내에서 내 번호·이름이 불렸는지 규칙으로 확인합니다. (AI를 쓰지 않음)

- "137번", "370번"은 37번으로 보지 않도록 숫자 경계를 확인합니다.
- TODO(ai): 한글 숫자("삼십칠번") 정규화, "3번 진료실"처럼 번호가 다른 뜻으로 쓰인 경우 구분
"""

import re

from app.schemas.analysis import MyTurnOut
from app.services.llm_extractor import split_sentences


def detect_my_turn(text: str, my_number: str | None, my_name: str | None) -> MyTurnOut | None:
    digits = re.sub(r"\D", "", my_number or "").lstrip("0")
    number_re = re.compile(rf"(?<!\d)0*{digits}\s*번") if digits else None
    name = (my_name or "").strip()

    for sentence in split_sentences(text):
        if number_re and number_re.search(sentence):
            return MyTurnOut(matched=f"{digits}번", evidence=sentence)
        if name and name in sentence:
            return MyTurnOut(matched=name, evidence=sentence)
    return None
