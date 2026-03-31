"""PART 3: Scheduler core — APScheduler wrapper for blueprint execution."""
import asyncio
from datetime import datetime
from typing import Any, Dict, Optional
from utils.database import get_db
from utils.helpers import generate_id, utcnow_str
from utils.logger import get_logger

logger = get_logger(__name__)

_scheduler = None


def get_scheduler():
    global _scheduler
    return _scheduler


async def start_scheduler():
    """Start APScheduler and load active schedules from MongoDB."""
    global _scheduler
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger

    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.start()
    logger.info("APScheduler started")

    # Load all active, non-paused schedules from DB
    db = get_db()
    count = 0
    async for schedule in db.schedules.find({"is_active": True, "is_paused": False}):
        try:
            await _add_job_to_scheduler(schedule)
            count += 1
        except Exception as e:
            logger.error(f"Failed to load schedule {schedule.get('schedule_id')}: {e}")

    logger.info(f"Loaded {count} active schedules")


async def stop_scheduler():
    """Stop APScheduler gracefully."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")


async def _add_job_to_scheduler(schedule: Dict):
    """Add a schedule document as an APScheduler job."""
    from apscheduler.triggers.cron import CronTrigger
    import pytz

    sched_id = schedule.get("schedule_id")
    cron_expr = schedule.get("cron_expression", "0 * * * *")
    tz = schedule.get("timezone", "UTC")
    blueprint_id = schedule.get("blueprint_id")
    variables = schedule.get("variables", {})

    try:
        tz_obj = pytz.timezone(tz)
    except Exception:
        tz_obj = pytz.UTC

    try:
        parts = cron_expr.strip().split()
        if len(parts) == 5:
            minute, hour, day, month, day_of_week = parts
        else:
            minute, hour, day, month, day_of_week = "0", "*", "*", "*", "*"

        trigger = CronTrigger(
            minute=minute, hour=hour, day=day,
            month=month, day_of_week=day_of_week,
            timezone=tz_obj,
        )
    except Exception as e:
        logger.error(f"Invalid cron expression '{cron_expr}': {e}")
        return

    _scheduler.add_job(
        _run_scheduled_blueprint,
        trigger=trigger,
        id=sched_id,
        replace_existing=True,
        kwargs={"schedule_id": sched_id, "blueprint_id": blueprint_id, "variables": variables},
        misfire_grace_time=300,
    )

    # Update next_run in DB
    try:
        job = _scheduler.get_job(sched_id)
        if job and job.next_run_time:
            db = get_db()
            await db.schedules.update_one(
                {"schedule_id": sched_id},
                {"$set": {"next_run": job.next_run_time.isoformat()}}
            )
    except Exception:
        pass

    logger.info(f"Scheduled job: {schedule.get('name')} [{sched_id}] cron={cron_expr}")


async def _run_scheduled_blueprint(schedule_id: str, blueprint_id: str, variables: Dict):
    """Execute a scheduled blueprint and update schedule stats."""
    from core.orchestrator import execute_blueprint

    db = get_db()
    execution_id = generate_id("exec")
    started_at = utcnow_str()

    logger.info(f"Running scheduled blueprint: {blueprint_id} for schedule {schedule_id}")

    # Update schedule: last_run
    await db.schedules.update_one(
        {"schedule_id": schedule_id},
        {"$set": {"last_run": started_at}, "$inc": {"run_count": 1}}
    )

    try:
        await execute_blueprint(
            execution_id=execution_id,
            blueprint_id=blueprint_id,
            variables=variables,
            options={"headless": True, "scheduled": True, "schedule_id": schedule_id},
        )

        # Get final status
        await asyncio.sleep(2)
        exec_doc = await db.executions.find_one({"execution_id": execution_id})
        final_status = exec_doc.get("status", "UNKNOWN") if exec_doc else "UNKNOWN"

        await db.schedules.update_one(
            {"schedule_id": schedule_id},
            {"$set": {"last_status": final_status}}
        )

        if final_status in ("SUCCESS",):
            await db.schedules.update_one({"schedule_id": schedule_id}, {"$inc": {"success_count": 1}})
        else:
            await db.schedules.update_one({"schedule_id": schedule_id}, {"$inc": {"failure_count": 1}})

        logger.info(f"Scheduled run {schedule_id} completed: {final_status}")

    except Exception as e:
        logger.error(f"Scheduled run {schedule_id} failed: {e}")
        await db.schedules.update_one(
            {"schedule_id": schedule_id},
            {"$set": {"last_status": "FAILURE"}, "$inc": {"failure_count": 1}}
        )

    # Update next_run
    try:
        job = _scheduler.get_job(schedule_id)
        if job and job.next_run_time:
            await db.schedules.update_one(
                {"schedule_id": schedule_id},
                {"$set": {"next_run": job.next_run_time.isoformat()}}
            )
    except Exception:
        pass


async def add_schedule(schedule: Dict) -> bool:
    """Add a new schedule to the scheduler."""
    if _scheduler and _scheduler.running:
        await _add_job_to_scheduler(schedule)
        return True
    return False


async def remove_schedule(schedule_id: str) -> bool:
    """Remove a schedule from the scheduler."""
    if _scheduler:
        try:
            _scheduler.remove_job(schedule_id)
            return True
        except Exception:
            pass
    return False


async def pause_schedule(schedule_id: str) -> bool:
    """Pause a schedule without deleting it."""
    if _scheduler:
        try:
            _scheduler.pause_job(schedule_id)
            return True
        except Exception:
            pass
    return False


async def resume_schedule(schedule_id: str, schedule: Optional[Dict] = None) -> bool:
    """Resume a paused schedule."""
    if _scheduler:
        try:
            # Try to resume existing job
            _scheduler.resume_job(schedule_id)
            return True
        except Exception:
            # Job might not exist, re-add it
            if schedule:
                await _add_job_to_scheduler(schedule)
                return True
    return False


async def trigger_now(schedule_id: str, blueprint_id: str, variables: Dict) -> str:
    """Trigger a scheduled blueprint immediately (outside cron)."""
    execution_id = generate_id("exec")
    asyncio.create_task(
        _run_scheduled_blueprint(schedule_id, blueprint_id, variables)
    )
    return execution_id
