from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from utils.database import get_db
from utils.logger import get_logger

router = APIRouter(prefix="/api", tags=["network"])
logger = get_logger(__name__)


@router.get("/network/{execution_id}")
async def get_network_logs(execution_id: str):
    db = get_db()
    doc = await db.executions.find_one({"execution_id": execution_id}, {"_id": 0, "network_logs": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Execution not found")

    logs = doc.get("network_logs", [])
    errors = [r for r in logs if r.get("is_error")]
    total_size = sum(r.get("size_bytes", 0) for r in logs)
    avg_duration = int(sum(r.get("duration_ms", 0) for r in logs) / len(logs)) if logs else 0

    return {
        "execution_id": execution_id,
        "total_requests": len(logs),
        "total_errors": len(errors),
        "avg_duration_ms": avg_duration,
        "total_size_bytes": total_size,
        "requests": logs,
    }


@router.get("/network/{execution_id}/export")
async def export_network_logs(execution_id: str):
    """Export network logs as HAR format."""
    from fastapi.responses import JSONResponse
    import time

    db = get_db()
    doc = await db.executions.find_one({"execution_id": execution_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Execution not found")

    logs = doc.get("network_logs", [])
    entries = []
    for r in logs:
        entries.append({
            "startedDateTime": r.get("timestamp", ""),
            "time": r.get("duration_ms", 0),
            "request": {
                "method": r.get("method", "GET"),
                "url": r.get("url", ""),
                "headers": [{"name": k, "value": v} for k, v in (r.get("request_headers") or {}).items()],
                "bodySize": len(r.get("request_body", "") or ""),
                "postData": {"text": r.get("request_body")} if r.get("request_body") else None,
            },
            "response": {
                "status": r.get("status", 0),
                "headers": [{"name": k, "value": v} for k, v in (r.get("response_headers") or {}).items()],
                "content": {
                    "size": r.get("size_bytes", 0),
                    "mimeType": r.get("content_type", ""),
                    "text": r.get("response_body", ""),
                },
                "bodySize": r.get("size_bytes", 0),
            },
            "timings": {"receive": r.get("duration_ms", 0)},
        })

    har = {
        "log": {
            "version": "1.2",
            "creator": {"name": "NPM", "version": "1.0"},
            "entries": entries,
        }
    }
    return JSONResponse(content=har, headers={
        "Content-Disposition": f"attachment; filename=network_{execution_id}.har"
    })
