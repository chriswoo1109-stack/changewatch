"""OpenAI 요금 보호. 배포 후 누가 반복 호출해도 충전한 크레딧이 바닥나지 않게 막습니다.

- 접속(IP)당 1분 호출 횟수 제한 → 넘으면 429
- 하루 OpenAI 호출 총량 제한 → 넘으면 분석은 모의 분석기로 대체, 음성 인식은 429
서버 메모리에만 기록하므로 서버가 다시 켜지면 초기화됩니다. (Render 무료 서버 1대 기준으로 충분)
"""

import time
from collections import defaultdict, deque
from datetime import date

from fastapi import HTTPException, Request

from app.core.config import settings

_recent: dict[str, deque[float]] = defaultdict(deque)
_daily = {"day": date.today(), "count": 0}


def client_ip(request: Request) -> str:
    # Render는 프록시 뒤에서 동작하므로 실제 접속 주소는 X-Forwarded-For 맨 앞에 있습니다.
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(request: Request) -> None:
    """라우트 의존성. 같은 IP가 1분에 rate_limit_per_minute번을 넘게 부르면 429."""
    now = time.monotonic()
    calls = _recent[client_ip(request)]
    while calls and now - calls[0] > 60:
        calls.popleft()
    if len(calls) >= settings.rate_limit_per_minute:
        raise HTTPException(status_code=429, detail="요청이 너무 많아요. 1분 뒤에 다시 시도해 주세요.")
    calls.append(now)


def use_ai_budget() -> bool:
    """OpenAI를 1번 쓰기 전에 부릅니다. 오늘 한도가 남았으면 1 차감하고 True, 없으면 False."""
    today = date.today()
    if _daily["day"] != today:
        _daily["day"], _daily["count"] = today, 0
    if _daily["count"] >= settings.ai_daily_limit:
        return False
    _daily["count"] += 1
    return True


def reset() -> None:
    """테스트용: 기록을 모두 지웁니다."""
    _recent.clear()
    _daily["day"], _daily["count"] = date.today(), 0
