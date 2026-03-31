from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class Webhook(BaseModel):
    webhook_id: str
    name: str
    secret_token: str
    blueprint_id: str
    blueprint_name: Optional[str] = None
    variables: Dict[str, str] = {}
    trigger_on: List[str] = ["push", "pull_request"]
    branch_filter: Optional[str] = None
    is_active: bool = True
    created_at: str
    last_triggered: Optional[str] = None
    trigger_count: int = 0
