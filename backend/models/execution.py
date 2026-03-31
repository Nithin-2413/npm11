from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from utils.helpers import utcnow_str


class ActionResult(BaseModel):
    action_index: int
    action_type: str
    selector: Optional[str] = None
    value: Optional[str] = None
    status: str  # success, failure, skipped
    started_at: str
    completed_at: Optional[str] = None
    duration_ms: int = 0
    error_message: Optional[str] = None
    screenshot_path: Optional[str] = None
    details: Optional[str] = None


class ActionResult(BaseModel):
    action_index: int
    action_type: str
    selector: Optional[str] = None
    value: Optional[str] = None
    status: str  # success, failure, skipped
    started_at: str
    completed_at: Optional[str] = None
    duration_ms: int = 0
    error_message: Optional[str] = None
    screenshot_path: Optional[str] = None
    details: Optional[str] = None
    description: Optional[str] = None
    confidence: Optional[float] = None
    used_fallback: Optional[bool] = None
    was_refined: Optional[bool] = None
    ai_analysis: Optional[Dict[str, Any]] = None


class AIAnalysis(BaseModel):
    root_cause: str = ""
    affected_component: str = ""
    suggested_fix: str = ""
    impact_level: str = "High"   # FIX 2: new required field
    confidence: float = 0.0
    error_type: str = ""
    raw_error: str = ""          # FIX 2: new required field
    full_analysis: str = ""


class PerformanceMetrics(BaseModel):
    page_load_time_ms: int = 0
    avg_action_duration_ms: int = 0
    slowest_action_ms: int = 0
    total_wait_time_ms: int = 0
    network_bandwidth_bytes: int = 0
    performance_score: float = 0.0


class Execution(BaseModel):
    execution_id: str
    status: str = "RUNNING"  # RUNNING, SUCCESS, FAILURE, PARTIAL, CANCELLED
    timestamp: str = Field(default_factory=utcnow_str)
    completed_at: Optional[str] = None
    duration_seconds: float = 0.0
    command: Optional[str] = None
    blueprint_id: Optional[str] = None
    blueprint_name: Optional[str] = None
    total_actions: int = 0
    successful_actions: int = 0
    failed_actions: int = 0
    action_timeline: List[ActionResult] = []
    network_logs: List[Dict[str, Any]] = []
    console_logs: List[Dict[str, Any]] = []
    screenshots: List[str] = []
    ai_analysis: Optional[AIAnalysis] = None
    ai_summary: Optional[str] = None
    performance: Optional[PerformanceMetrics] = None
    error_message: Optional[str] = None
    options: Dict[str, Any] = {}


class ExecuteRequest(BaseModel):
    command: str
    options: Optional[Dict[str, Any]] = {}


class ExecuteBlueprintRequest(BaseModel):
    blueprint_id: str
    variables: Optional[Dict[str, str]] = {}
    options: Optional[Dict[str, Any]] = {}
