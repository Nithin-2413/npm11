import asyncio
from fastapi import APIRouter, HTTPException, BackgroundTasks
from models.execution import ExecuteRequest, ExecuteBlueprintRequest
from core.orchestrator import execute_command, execute_blueprint, cancel_execution
from utils.database import get_db
from utils.helpers import generate_id
from utils.logger import get_logger

router = APIRouter(prefix="/api", tags=["execute"])
logger = get_logger(__name__)


@router.post("/execute")
async def run_command(request: ExecuteRequest, bg: BackgroundTasks):
    """Execute a natural language command."""
    if not request.command.strip():
        raise HTTPException(status_code=400, detail="Command cannot be empty")
    
    execution_id = generate_id("exec")
    bg.add_task(execute_command, execution_id, request.command, request.options or {})
    
    return {
        "execution_id": execution_id,
        "status": "RUNNING",
        "message": f"Execution started. Connect to WebSocket at /ws/execution/{execution_id} for live updates.",
    }


@router.post("/execute/blueprint")
async def run_blueprint(request: ExecuteBlueprintRequest, bg: BackgroundTasks):
    """Execute a blueprint with variable injection."""
    db = get_db()
    bp = await db.blueprints.find_one({"blueprint_id": request.blueprint_id})
    if not bp:
        raise HTTPException(status_code=404, detail=f"Blueprint '{request.blueprint_id}' not found")

    execution_id = generate_id("exec")
    bg.add_task(
        execute_blueprint,
        execution_id,
        request.blueprint_id,
        request.variables or {},
        request.options or {},
    )

    return {
        "execution_id": execution_id,
        "status": "RUNNING",
        "message": f"Blueprint execution started.",
    }


@router.get("/execute/{execution_id}/status")
async def get_execution_status(execution_id: str):
    """Get current status of an execution."""
    db = get_db()
    doc = await db.executions.find_one({"execution_id": execution_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    total = doc.get("total_actions", 0)
    successful = doc.get("successful_actions", 0)
    failed = doc.get("failed_actions", 0)
    done = successful + failed
    progress = round((done / total * 100) if total else 0, 1)

    timeline = doc.get("action_timeline", [])
    current = None
    if timeline:
        last = timeline[-1]
        current = f"{last.get('action_type', '')} {last.get('selector', '') or last.get('value', '')}".strip()

    return {
        "execution_id": execution_id,
        "status": doc.get("status", "UNKNOWN"),
        "progress": progress,
        "current_action": current,
        "actions_completed": done,
        "actions_successful": successful,
        "actions_failed": failed,
        "actions_total": total,
        "duration_seconds": doc.get("duration_seconds", 0),
    }


@router.post("/execute/{execution_id}/cancel")
async def cancel_exec(execution_id: str):
    """Cancel a running execution."""
    db = get_db()
    doc = await db.executions.find_one({"execution_id": execution_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    cancel_execution(execution_id)
    return {"message": f"Cancellation requested for {execution_id}"}
