from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, HTMLResponse
from utils.database import get_db
from utils.logger import get_logger
import json

router = APIRouter(prefix="/api", tags=["reports"])
logger = get_logger(__name__)


@router.get("/reports")
async def list_reports(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
):
    db = get_db()
    query = {"status": {"$ne": "RUNNING"}}  # Exclude running
    if status and status.upper() != "ALL":
        query["status"] = status.upper()
    if from_date:
        query["timestamp"] = query.get("timestamp", {})
        query["timestamp"]["$gte"] = from_date
    if to_date:
        query.setdefault("timestamp", {})
        query["timestamp"]["$lte"] = to_date

    total = await db.executions.count_documents(query)
    cursor = db.executions.find(
        query,
        {"_id": 0, "action_timeline": 0, "network_logs": 0, "console_logs": 0}
    ).sort("timestamp", -1).skip((page - 1) * page_size).limit(page_size)
    docs = await cursor.to_list(length=page_size)

    return {"reports": docs, "total": total, "page": page, "page_size": page_size}


@router.get("/reports/stats")
async def get_stats():
    db = get_db()
    total = await db.executions.count_documents({"status": {"$ne": "RUNNING"}})
    success = await db.executions.count_documents({"status": "SUCCESS"})
    failure = await db.executions.count_documents({"status": "FAILURE"})
    partial = await db.executions.count_documents({"status": "PARTIAL"})

    # Time-based stats
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat() + "Z"
    week_start = (now - timedelta(days=7)).isoformat() + "Z"
    month_start = (now - timedelta(days=30)).isoformat() + "Z"

    today_count = await db.executions.count_documents({"timestamp": {"$gte": today_start}})
    week_count = await db.executions.count_documents({"timestamp": {"$gte": week_start}})
    month_count = await db.executions.count_documents({"timestamp": {"$gte": month_start}})

    # Avg duration
    pipeline = [
        {"$match": {"status": "SUCCESS", "duration_seconds": {"$gt": 0}}},
        {"$group": {"_id": None, "avg": {"$avg": "$duration_seconds"}}}
    ]
    avg_cursor = db.executions.aggregate(pipeline)
    avg_result = await avg_cursor.to_list(length=1)
    avg_duration = round(avg_result[0]["avg"], 2) if avg_result else 0.0

    # Top blueprints
    bp_pipeline = [
        {"$match": {"blueprint_id": {"$ne": None}}},
        {"$group": {"_id": "$blueprint_id", "count": {"$sum": 1}, "name": {"$first": "$blueprint_name"}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    bp_cursor = db.executions.aggregate(bp_pipeline)
    top_blueprints = await bp_cursor.to_list(length=5)

    # Recent errors
    err_cursor = db.executions.find(
        {"status": "FAILURE"},
        {"_id": 0, "execution_id": 1, "error_message": 1, "timestamp": 1, "command": 1}
    ).sort("timestamp", -1).limit(5)
    recent_errors = await err_cursor.to_list(length=5)

    success_rate = round(success / total, 4) if total > 0 else 0.0
    total_blueprints = await db.blueprints.count_documents({})

    return {
        "total_executions": total,
        "success_count": success,
        "failure_count": failure,
        "partial_count": partial,
        "success_rate": success_rate,
        "avg_duration": avg_duration,
        "total_blueprints": total_blueprints,
        "executions_today": today_count,
        "executions_this_week": week_count,
        "executions_this_month": month_count,
        "top_blueprints": [{"blueprint_id": b["_id"], "name": b.get("name", b["_id"]), "usage_count": b["count"]} for b in top_blueprints],
        "recent_errors": recent_errors,
    }


@router.get("/reports/{execution_id}")
async def get_report(execution_id: str):
    db = get_db()
    doc = await db.executions.find_one({"execution_id": execution_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return doc


@router.delete("/reports/{execution_id}")
async def delete_report(execution_id: str):
    db = get_db()
    result = await db.executions.delete_one({"execution_id": execution_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"message": f"Report '{execution_id}' deleted"}


@router.get("/reports/{execution_id}/export")
async def export_report(execution_id: str, format: str = Query("json")):
    db = get_db()
    doc = await db.executions.find_one({"execution_id": execution_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    if format == "json":
        return JSONResponse(
            content=doc,
            headers={"Content-Disposition": f"attachment; filename=report_{execution_id}.json"}
        )
    elif format == "html":
        html = _generate_html_report(doc)
        return HTMLResponse(
            content=html,
            headers={"Content-Disposition": f"attachment; filename=report_{execution_id}.html"}
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}. Use 'json' or 'html'.")


@router.get("/reports/{execution_id}/performance")
async def get_performance(execution_id: str):
    db = get_db()
    doc = await db.executions.find_one({"execution_id": execution_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "execution_id": execution_id,
        "performance": doc.get("performance", {}),
        "duration_seconds": doc.get("duration_seconds", 0),
        "total_actions": doc.get("total_actions", 0),
        "successful_actions": doc.get("successful_actions", 0),
        "network_requests": len(doc.get("network_logs", [])),
        "network_errors": sum(1 for r in doc.get("network_logs", []) if r.get("is_error")),
    }


def _generate_html_report(doc: dict) -> str:
    status = doc.get("status", "UNKNOWN")
    status_color = {"SUCCESS": "#10b981", "FAILURE": "#ef4444", "PARTIAL": "#f59e0b", "CANCELLED": "#6b7280"}.get(status, "#6b7280")
    actions = doc.get("action_timeline", [])
    network = doc.get("network_logs", [])
    console = doc.get("console_logs", [])
    ai_summary = doc.get("ai_summary", "")
    ai_analysis = doc.get("ai_analysis", {})

    actions_html = ""
    for a in actions:
        a_status = a.get("status", "")
        a_color = "#10b981" if a_status == "success" else "#ef4444"
        actions_html += f"""<tr>
            <td style='padding:8px;border-bottom:1px solid #1e293b;color:#94a3b8'>{a.get('action_index', 0) + 1}</td>
            <td style='padding:8px;border-bottom:1px solid #1e293b;color:#38bdf8'>{a.get('action_type', '')}</td>
            <td style='padding:8px;border-bottom:1px solid #1e293b;color:#cbd5e1'>{a.get('selector', '') or a.get('value', '')}</td>
            <td style='padding:8px;border-bottom:1px solid #1e293b;color:{a_color};font-weight:bold'>{a_status.upper()}</td>
            <td style='padding:8px;border-bottom:1px solid #1e293b;color:#94a3b8'>{a.get('duration_ms', 0)}ms</td>
        </tr>"""

    network_html = ""
    for r in network[:20]:
        n_color = "#10b981" if r.get("status", 0) < 400 else "#ef4444"
        network_html += f"""<tr>
            <td style='padding:6px;border-bottom:1px solid #1e293b;color:#38bdf8;font-weight:bold'>{r.get('method', '')}</td>
            <td style='padding:6px;border-bottom:1px solid #1e293b;color:#94a3b8;max-width:300px;overflow:hidden;text-overflow:ellipsis'>{r.get('url', '')[:80]}</td>
            <td style='padding:6px;border-bottom:1px solid #1e293b;color:{n_color};font-weight:bold'>{r.get('status', '')}</td>
            <td style='padding:6px;border-bottom:1px solid #1e293b;color:#94a3b8'>{r.get('duration_ms', 0)}ms</td>
        </tr>"""

    return f"""
<!DOCTYPE html><html><head><title>NPM Report - {doc.get('execution_id')}</title>
<style>body{{font-family:'Courier New',monospace;background:#0f172a;color:#e2e8f0;margin:0;padding:20px}}
h1,h2{{color:#38bdf8}} table{{width:100%;border-collapse:collapse;margin:10px 0}}
.card{{background:#1e293b;border-radius:12px;padding:20px;margin:15px 0;border:1px solid #334155}}
.badge{{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold}}
</style></head><body>
<h1>NPM Execution Report</h1>
<div class='card'>
  <table><tr>
    <td><b>Execution ID:</b> {doc.get('execution_id')}</td>
    <td><b>Status:</b> <span class='badge' style='background:{status_color}22;color:{status_color}'>{status}</span></td>
    <td><b>Duration:</b> {doc.get('duration_seconds', 0):.2f}s</td>
    <td><b>Actions:</b> {doc.get('successful_actions', 0)}/{doc.get('total_actions', 0)}</td>
  </tr></table>
  <p><b>Command:</b> {doc.get('command', 'N/A')}</p>
  {f"<p style='color:#94a3b8;font-style:italic'>{ai_summary}</p>" if ai_summary else ''}
</div>
{f"<div class='card'><h2>AI Analysis</h2><p><b>Root Cause:</b> {ai_analysis.get('root_cause', '')}</p><p><b>Suggested Fix:</b> {ai_analysis.get('suggested_fix', '')}</p></div>" if ai_analysis else ''}
<div class='card'><h2>Action Timeline</h2>
<table><tr><th>Step</th><th>Type</th><th>Target</th><th>Status</th><th>Duration</th></tr>{actions_html}</table></div>
<div class='card'><h2>Network Requests ({len(network)} total)</h2>
<table><tr><th>Method</th><th>URL</th><th>Status</th><th>Duration</th></tr>{network_html}</table></div>
</body></html>"""
