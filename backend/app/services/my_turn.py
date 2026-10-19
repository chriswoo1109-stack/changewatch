"""내 차례 감지. 안내에서 내 번호·이름이 불렸는지 규칙으로 확인합니다. (AI를 쓰지 않음)

- "137번", "370번"은 37번으로 보지 않도록 숫자 경계를 확인합니다.
- 음성 인식이 "삼십칠 번"처럼 한글 숫자로 적어도 알아보도록 문장을 정규화한 뒤 찾습니다. (근거는 원문 그대로)
- "37번 진료실로 가세요", "진료실이 37번으로 바뀌었습니다"처럼 번호가 장소·값으로 쓰인 경우는 부른 것이 아닙니다.
"""

import re

from app.schemas.analysis import MyTurnOut
from app.services.llm_extractor import split_sentences
from app.services.normalize import normalize_value

# 번호 바로 뒤에 오면 사람을 부른 게 아니라 장소·값을 말한 것 ("37번 진료실", "37번으로")
NOT_A_CALL = r"(?!\s*(?:진료실|진찰실|검사실|창구|호실|층)|으로|로(?![가-힣]))"


def detect_my_turn(text: str, my_number: str | None, my_name: str | None) -> MyTurnOut | None:
    digits = re.sub(r"\D", "", my_number or "").lstrip("0")
    number_re = re.compile(rf"(?<!\d)0*{digits}\s*번{NOT_A_CALL}") if digits else None
    name = (my_name or "").strip()

    for sentence in split_sentences(text):
        if number_re and number_re.search(normalize_value(sentence)):
            return MyTurnOut(matched=f"{digits}번", evidence=sentence)
        if name and name in sentence:
            return MyTurnOut(matched=name, evidence=sentence)
    return None
