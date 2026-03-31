"""PART 3B: Schedules API."""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from utils.database import get_db
from utils.helpers import generate_id, utcnow_str
from utils.logger import get_logger
from core.scheduler import add_schedule, remove_schedule, pause_schedule, resume_schedule, trigger_now

logger = get_logger(__name__)
router = APIRouter(prefix="/api/schedules", tags=["schedules"])


class ScheduleCreate(BaseModel):
    name: str
    blueprint_id: str
    variables: Dict[str, str] = {}
    cron_expression: str
    timezone: str = "UTC"
    is_active: bool = True
    notification_on_failure: bool = True


class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    variables: Optional[Dict[str, str]] = None
    cron_expression: Optional[str] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None
    notification_on_failure: Optional[bool] = None


def _validate_cron(expr: str) -> bool:
    """Basic cron expression validation — 5 fields."""
    parts = expr.strip().split()
    return len(parts) == 5


def _clean_doc(doc: Dict) -> Dict:
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("")
async def list_schedules():
    """List all schedules with next_run times."""
    db = get_db()
    schedules = []
    async for doc in db.schedules.find({}).sort("created_at", -1):
        schedules.append(_clean_doc(doc))
    return {"schedules": schedules, "total": len(schedules)}


@router.post("")
async def create_schedule(payload: ScheduleCreate):
    """Create a new schedule."""
    if not _validate_cron(payload.cron_expression):
        raise HTTPException(status_code=400, detail="Invalid cron expression — must have exactly 5 fields")

    db = get_db()

    # Validate blueprint exists
    bp = await db.blueprints.find_one({"blueprint_id": payload.blueprint_id})
    if not bp:
        raise HTTPException(status_code=404, detail="Blueprint not found")

    schedule = {
        "schedule_id": generate_id("sched"),
        "name": payload.name,
        "blueprint_id": payload.blueprint_id,
        "blueprint_name": bp.get("name"),
        "variables": payload.variables,
        "cron_expression": payload.cron_expression,
        "timezone": payload.timezone,
        "is_active": payload.is_active,
        "is_paused": False,
        "notification_on_failure": payload.notification_on_failure,
        "created_at": utcnow_str(),
        "last_run": None,
        "last_status": None,
        "next_run": None,
        "run_count": 0,
        "success_count": 0,
        "failure_count": 0,
    }
    await db.schedules.insert_one(schedule)

    if payload.is_active:
        await add_schedule(schedule)

    logger.info(f"Created schedule: {payload.name}")
    return {"schedule_id": schedule["schedule_id"], "message": "Schedule created"}


@router.get("/{schedule_id}")
async def get_schedule(schedule_id: str):
    db = get_db()
    doc = await db.schedules.find_one({"schedule_id": schedule_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return _clean_doc(doc)


@router.put("/{schedule_id}")
async def update_schedule(schedule_id: str, payload: ScheduleUpdate):
    db = get_db()
    doc = await db.schedules.find_one({"schedule_id": schedule_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if payload.cron_expression and not _validate_cron(payload.cron_expression):
        raise HTTPException(status_code=400, detail="Invalid cron expression")

    update = {"updated_at": utcnow_str()}
    for field in ("name", "variables", "cron_expression", "timezone", "is_active", "notification_on_failure"):
        val = getattr(payload, field, None)
        if val is not None:
            update[field] = val

    await db.schedules.update_one({"schedule_id": schedule_id}, {"$set": update})

    # Re-register with scheduler if cron or active status changed
    if payload.cron_expression or payload.is_active is not None:
        updated_doc = await db.schedules.find_one({"schedule_id": schedule_id})
        if updated_doc.get("is_active") and not updated_doc.get("is_paused"):
            await remove_schedule(schedule_id)
            await add_schedule(updated_doc)
        else:
            await remove_schedule(schedule_id)

    return {"message": "Schedule updated"}


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: str):
    db = get_db()
    result = await db.schedules.delete_one({"schedule_id": schedule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await remove_schedule(schedule_id)
    return {"message": "Schedule deleted"}


@router.post("/{schedule_id}/pause")
async def pause_sched(schedule_id: str):
    db = get_db()
    doc = await db.schedules.find_one({"schedule_id": schedule_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await db.schedules.update_one({"schedule_id": schedule_id}, {"$set": {"is_paused": True}})
    await pause_schedule(schedule_id)
    return {"message": "Schedule paused"}


@router.post("/{schedule_id}/resume")
async def resume_sched(schedule_id: str):
    db = get_db()
    doc = await db.schedules.find_one({"schedule_id": schedule_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await db.schedules.update_one({"schedule_id": schedule_id}, {"$set": {"is_paused": False}})
    await resume_schedule(schedule_id, doc)
    return {"message": "Schedule resumed"}


@router.post("/{schedule_id}/run-now")
async def run_now(schedule_id: str):
    """Trigger a scheduled blueprint immediately outside of schedule."""
    db = get_db()
    doc = await db.schedules.find_one({"schedule_id": schedule_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Schedule not found")
    execution_id = await trigger_now(
        schedule_id=schedule_id,
        blueprint_id=doc.get("blueprint_id"),
        variables=doc.get("variables", {}),
    )
    return {"execution_id": execution_id, "message": "Triggered immediately"}


@router.get("/{schedule_id}/history")
async def schedule_history(schedule_id: str):
    """Get execution history for this schedule."""
    db = get_db()
    history = []
    async for doc in db.executions.find(
        {"options.schedule_id": schedule_id}
    ).sort("timestamp", -1).limit(20):
        history.append({
            "execution_id": doc.get("execution_id"),
            "status": doc.get("status"),
            "duration_seconds": doc.get("duration_seconds"),
            "timestamp": doc.get("timestamp"),
            "completed_at": doc.get("completed_at"),
        })
    return {"history": history, "schedule_id": schedule_id}
