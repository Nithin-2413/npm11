"""PART 6: Advanced Analytics API — time-series, flaky detection, performance regressions."""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query
from utils.database import get_db
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/timeseries")
async def timeseries(
    period: str = Query("7d", description="7d | 30d | 90d"),
    granularity: str = Query("day", description="hour | day | week"),
):
    """PART 6A: Time-series execution statistics."""
    db = get_db()

    days_map = {"7d": 7, "30d": 30, "90d": 90}
    days = days_map.get(period, 7)
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    executions = []
    async for doc in db.executions.find(
        {"timestamp": {"$gte": since.isoformat()}},
        {"status": 1, "duration_seconds": 1, "timestamp": 1, "performance": 1}
    ):
        executions.append(doc)

    # Group by granularity
    buckets: Dict[str, Dict] = {}
    for doc in executions:
        try:
            ts = _parse_ts(doc.get("timestamp", ""))
            if ts is None:
                continue
            bucket_key = _get_bucket_key(ts, granularity)
            if bucket_key not in buckets:
                buckets[bucket_key] = {
                    "timestamp": bucket_key,
                    "total_executions": 0,
                    "success_count": 0,
                    "failure_count": 0,
                    "partial_count": 0,
                    "durations": [],
                    "perf_scores": [],
                }
            b = buckets[bucket_key]
            b["total_executions"] += 1
            status = doc.get("status", "")
            if status == "SUCCESS":
                b["success_count"] += 1
            elif status == "FAILURE":
                b["failure_count"] += 1
            elif status == "PARTIAL":
                b["partial_count"] += 1
            d = doc.get("duration_seconds")
            if d:
                b["durations"].append(float(d))
            ps = (doc.get("performance") or {}).get("performance_score")
            if ps:
                b["perf_scores"].append(float(ps))
        except Exception:
            continue

    # Build result with averages
    data = []
    for key in sorted(buckets.keys()):
        b = buckets[key]
        data.append({
            "timestamp": b["timestamp"],
            "total_executions": b["total_executions"],
            "success_count": b["success_count"],
            "failure_count": b["failure_count"],
            "partial_count": b["partial_count"],
            "avg_duration_seconds": round(sum(b["durations"]) / len(b["durations"]), 2) if b["durations"] else 0,
            "avg_performance_score": round(sum(b["perf_scores"]) / len(b["perf_scores"]), 1) if b["perf_scores"] else 0,
        })

    return {"period": period, "granularity": granularity, "data": data}


@router.get("/flaky")
async def flaky_blueprints():
    """PART 6B: Detect flaky blueprints — fail between 5% and 50% of the time."""
    db = get_db()

    blueprints_list = []
    async for bp in db.blueprints.find({}, {"blueprint_id": 1, "name": 1}):
        blueprints_list.append(bp)

    flaky = []
    for bp in blueprints_list:
        bp_id = bp.get("blueprint_id")
        bp_name = bp.get("name", "")

        executions = []
        async for doc in db.executions.find(
            {"blueprint_id": bp_id},
            {"status": 1, "error_message": 1, "ai_analysis": 1, "timestamp": 1}
        ).sort("timestamp", -1).limit(20):
            executions.append(doc)

        if len(executions) < 3:
            continue

        success_count = sum(1 for e in executions if e.get("status") == "SUCCESS")
        fail_count = sum(1 for e in executions if e.get("status") in ("FAILURE", "PARTIAL"))
        total = len(executions)
        failure_rate = fail_count / total if total > 0 else 0

        # Flaky if: has both successes and failures, failure rate between 5%-50%
        if 0.05 <= failure_rate <= 0.50 and success_count > 0 and fail_count > 0:
            # Get last failure reason
            last_failure = next(
                (e for e in executions if e.get("status") in ("FAILURE", "PARTIAL")), None
            )
            last_failure_reason = ""
            if last_failure:
                ai = last_failure.get("ai_analysis", {})
                last_failure_reason = (
                    ai.get("root_cause") or last_failure.get("error_message", "")
                )[:200]

            # Detect time patterns
            failure_pattern = _detect_failure_pattern(executions)

            flaky.append({
                "blueprint_id": bp_id,
                "name": bp_name,
                "failure_rate": round(failure_rate, 3),
                "total_runs": total,
                "success_count": success_count,
                "failure_count": fail_count,
                "last_failure_reason": last_failure_reason,
                "failure_pattern": failure_pattern,
                "recommendation": _generate_recommendation(last_failure_reason),
            })

    flaky.sort(key=lambda x: x["failure_rate"], reverse=True)
    return {"flaky_blueprints": flaky, "total": len(flaky)}


@router.get("/regressions")
async def performance_regressions():
    """PART 6C: Detect blueprints with >20% duration increase in last 7 days vs previous 7 days."""
    db = get_db()

    now = datetime.now(timezone.utc)
    last7 = now - timedelta(days=7)
    prev7 = now - timedelta(days=14)

    blueprints_list = []
    async for bp in db.blueprints.find({}, {"blueprint_id": 1, "name": 1}):
        blueprints_list.append(bp)

    regressions = []
    for bp in blueprints_list:
        bp_id = bp.get("blueprint_id")
        bp_name = bp.get("name", "")

        # Last 7 days
        recent_durations = []
        async for doc in db.executions.find(
            {"blueprint_id": bp_id, "status": "SUCCESS", "timestamp": {"$gte": last7.isoformat()}},
            {"duration_seconds": 1}
        ):
            d = doc.get("duration_seconds")
            if d:
                recent_durations.append(float(d))

        # Previous 7 days
        prev_durations = []
        async for doc in db.executions.find(
            {"blueprint_id": bp_id, "status": "SUCCESS",
             "timestamp": {"$gte": prev7.isoformat(), "$lt": last7.isoformat()}},
            {"duration_seconds": 1}
        ):
            d = doc.get("duration_seconds")
            if d:
                prev_durations.append(float(d))

        if len(recent_durations) < 2 or len(prev_durations) < 2:
            continue

        avg_recent = sum(recent_durations) / len(recent_durations)
        avg_prev = sum(prev_durations) / len(prev_durations)

        if avg_prev > 0:
            change_pct = ((avg_recent - avg_prev) / avg_prev) * 100
            if change_pct > 20:
                regressions.append({
                    "blueprint_id": bp_id,
                    "name": bp_name,
                    "avg_duration_recent_s": round(avg_recent, 2),
                    "avg_duration_prev_s": round(avg_prev, 2),
                    "change_percent": round(change_pct, 1),
                    "severity": "High" if change_pct > 50 else "Medium",
                    "recommendation": f"Duration increased by {change_pct:.0f}%. Check for new network calls, slow selectors, or added wait steps.",
                })

    regressions.sort(key=lambda x: x["change_percent"], reverse=True)
    return {"regressions": regressions, "total": len(regressions)}


@router.get("/top-blueprints")
async def top_blueprints(limit: int = Query(5, ge=1, le=20)):
    """Top blueprints by usage count."""
    db = get_db()
    bps = []
    async for doc in db.blueprints.find(
        {}, {"blueprint_id": 1, "name": 1, "metadata": 1}
    ).sort("metadata.usage_count", -1).limit(limit):
        bps.append({
            "blueprint_id": doc.get("blueprint_id"),
            "name": doc.get("name"),
            "usage_count": (doc.get("metadata") or {}).get("usage_count", 0),
            "success_rate": (doc.get("metadata") or {}).get("success_rate", 0),
        })
    return {"blueprints": bps}


def _parse_ts(ts_str: str) -> Optional[datetime]:
    if not ts_str:
        return None
    try:
        ts_str = ts_str.replace("Z", "+00:00")
        return datetime.fromisoformat(ts_str)
    except Exception:
        return None


def _get_bucket_key(ts: datetime, granularity: str) -> str:
    if granularity == "hour":
        return ts.strftime("%Y-%m-%dT%H:00:00Z")
    elif granularity == "week":
        # ISO week start (Monday)
        monday = ts - timedelta(days=ts.weekday())
        return monday.strftime("%Y-%m-%dT00:00:00Z")
    else:  # day (default)
        return ts.strftime("%Y-%m-%dT00:00:00Z")


def _detect_failure_pattern(executions: List[Dict]) -> str:
    """Simple pattern detection — check if failures cluster on certain days."""
    failure_hours = []
    for e in executions:
        if e.get("status") in ("FAILURE", "PARTIAL"):
            ts = _parse_ts(e.get("timestamp", ""))
            if ts:
                failure_hours.append(ts.hour)
    if not failure_hours:
        return "No clear pattern detected"
    avg_hour = sum(failure_hours) / len(failure_hours)
    if 14 <= avg_hour <= 18:
        return "Tends to fail during afternoon hours (2-6 PM UTC)"
    elif 22 <= avg_hour or avg_hour <= 2:
        return "Tends to fail during late night hours (10 PM - 2 AM UTC)"
    return "Failures occur at various times — no clear temporal pattern"


def _generate_recommendation(last_failure_reason: str) -> str:
    lr = last_failure_reason.lower()
    if "selector" in lr or "not found" in lr:
        return "The selector is unstable. Switch to ARIA roles or data-testid attributes."
    elif "timeout" in lr:
        return "Action is timing out. Increase timeout or add explicit wait for networkidle."
    elif "network" in lr or "http" in lr or "4" in lr:
        return "Network errors detected. Check if the site is reliable and add retry logic."
    elif "assertion" in lr:
        return "Assertion is fragile. Use partial text matching instead of exact match."
    return "Review the action timeline and switch to more resilient selectors."
