from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from utils.helpers import utcnow_str


class NetworkLog(BaseModel):
    request_id: str
    execution_id: str
    url: str
    method: str
    status: int
    content_type: Optional[str] = None
    duration_ms: int = 0
    size_bytes: int = 0
    timestamp: str = Field(default_factory=utcnow_str)
    request_headers: Optional[Dict[str, str]] = None
    response_headers: Optional[Dict[str, str]] = None
    request_body: Optional[str] = None
    response_body: Optional[str] = None
    initiator: Optional[str] = None
    resource_type: Optional[str] = None
    timing: Optional[Dict[str, Any]] = None
    ai_analysis: Optional[Dict[str, Any]] = None
    is_error: bool = False
