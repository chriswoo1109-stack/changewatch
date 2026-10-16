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
