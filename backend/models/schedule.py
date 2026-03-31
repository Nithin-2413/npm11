from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class Schedule(BaseModel):
    schedule_id: str
    name: str
    blueprint_id: str
    blueprint_name: Optional[str] = None
    variables: Dict[str, str] = {}
    cron_expression: str
    timezone: str = "UTC"
    is_active: bool = True
    is_paused: bool = False
    last_run: Optional[str] = None
    last_status: Optional[str] = None
    next_run: Optional[str] = None
    notification_on_failure: bool = True
    created_at: str
    updated_at: Optional[str] = None
    run_count: int = 0
    success_count: int = 0
    failure_count: int = 0
