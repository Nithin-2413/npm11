from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class SecretData(BaseModel):
    url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None  # always encrypted
    api_key: Optional[str] = None   # always encrypted
    custom: Optional[Dict[str, str]] = None


class Secret(BaseModel):
    secret_id: str
    name: str
    type: str = "credentials"  # credentials | url | api_key | custom
    domain: Optional[str] = None
    data: Dict[str, Any] = {}
    tags: List[str] = []
    created_at: str
    last_used: Optional[str] = None
