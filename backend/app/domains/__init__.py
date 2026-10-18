import json
from functools import lru_cache
from pathlib import Path

DOMAIN_DIR = Path(__file__).parent


@lru_cache
def load_domain(domain: str) -> dict:
    """분야별 항목 템플릿을 읽습니다. 새 분야는 JSON 파일만 추가하면 됩니다."""
    path = DOMAIN_DIR / f"{domain}.json"
    if not path.exists():
        raise ValueError(f"지원하지 않는 분야입니다: {domain}")
    return json.loads(path.read_text(encoding="utf-8"))


def item_labels(domain: str) -> dict[str, str]:
    return {item["key"]: item["label"] for item in load_domain(domain)["items"]}


def time_keys(domain: str) -> set[str]:
    """시각 항목(type: time). 오전/오후 보정 대상입니다."""
    return {item["key"] for item in load_domain(domain)["items"] if item.get("type") == "time"}


def am_hours(domain: str) -> tuple[int, int]:
    """오전/오후를 말하지 않은 시각을 '오전'으로 볼 범위. 그 밖은 오후로 봅니다."""
    start, end = load_domain(domain).get("am_hours", [7, 11])
    return start, end
