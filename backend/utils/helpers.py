import uuid
import re
from datetime import datetime
from typing import Any, Dict


def generate_id(prefix: str = "exec") -> str:
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    short = str(uuid.uuid4())[:8]
    return f"{prefix}_{ts}_{short}"


def sanitize_id(text: str) -> str:
    """Convert text to safe slug ID."""
    slug = re.sub(r'[^a-zA-Z0-9_]', '_', text.lower())
    slug = re.sub(r'_+', '_', slug).strip('_')
    return slug[:50]


def utcnow_str() -> str:
    return datetime.utcnow().isoformat() + "Z"


def ms_elapsed(start: datetime) -> int:
    delta = datetime.utcnow() - start
    return int(delta.total_seconds() * 1000)


def clean_dict(d: Dict[str, Any]) -> Dict[str, Any]:
    """Remove None values from dict."""
    return {k: v for k, v in d.items() if v is not None}
