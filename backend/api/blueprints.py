from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from models.blueprint import BlueprintCreate, BlueprintUpdate
from core.blueprint import inject_variables, validate_actions, extract_variables
from utils.database import get_db
from utils.helpers import generate_id, utcnow_str, sanitize_id
from utils.logger import get_logger

router = APIRouter(prefix="/api", tags=["blueprints"])
logger = get_logger(__name__)


@router.get("/blueprints")
async def list_blueprints(
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    sort: str = Query("recent"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    db = get_db()
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if tag:
        query["metadata.tags"] = {"$in": [tag]}

    sort_field = {"recent": "updated_at", "name": "name", "usage": "metadata.usage_count"}.get(sort, "updated_at")
    sort_dir = 1 if sort == "name" else -1

    total = await db.blueprints.count_documents(query)
    cursor = db.blueprints.find(query, {"_id": 0}).sort(sort_field, sort_dir).skip((page - 1) * page_size).limit(page_size)
    docs = await cursor.to_list(length=page_size)

    return {
        "blueprints": docs,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/blueprints", status_code=201)
async def create_blueprint(data: BlueprintCreate):
    db = get_db()

    # Validate actions
    errors = validate_actions([a.dict() for a in data.actions])
    if errors:
        raise HTTPException(status_code=422, detail={"validation_errors": errors})

    bp_id = generate_id("bp")
    now = utcnow_str()
    doc = {
        "blueprint_id": bp_id,
        "name": data.name,
        "description": data.description,
        "version": data.version,
        "created_at": now,
        "updated_at": now,
        "variables": [v.dict() for v in data.variables],
        "actions": [a.dict() for a in data.actions],
        "success_criteria": data.success_criteria,
        "metadata": data.metadata.dict() if data.metadata else {"tags": [], "success_rate": 0.0, "usage_count": 0},
    }
    await db.blueprints.insert_one(doc)
    logger.info(f"Created blueprint: {bp_id} '{data.name}'")
    return {"blueprint_id": bp_id, "message": "Blueprint created successfully"}


@router.get("/blueprints/{blueprint_id}")
async def get_blueprint(blueprint_id: str):
    db = get_db()
    doc = await db.blueprints.find_one({"blueprint_id": blueprint_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Blueprint '{blueprint_id}' not found")
    return doc


@router.put("/blueprints/{blueprint_id}")
async def update_blueprint(blueprint_id: str, data: BlueprintUpdate):
    db = get_db()
    existing = await db.blueprints.find_one({"blueprint_id": blueprint_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Blueprint not found")

    updates = {k: v for k, v in data.dict(exclude_none=True).items()}
    if updates.get("actions"):
        errors = validate_actions(updates["actions"])
        if errors:
            raise HTTPException(status_code=422, detail={"validation_errors": errors})
    updates["updated_at"] = utcnow_str()

    # Auto-increment version
    old_ver = existing.get("version", "1.0")
    try:
        parts = old_ver.split(".")
        new_ver = f"{parts[0]}.{int(parts[1]) + 1}" if len(parts) > 1 else f"{float(old_ver) + 0.1:.1f}"
        updates["version"] = new_ver
    except Exception:
        updates["version"] = old_ver

    await db.blueprints.update_one({"blueprint_id": blueprint_id}, {"$set": updates})
    return {"message": "Blueprint updated", "version": updates["version"]}


@router.delete("/blueprints/{blueprint_id}")
async def delete_blueprint(blueprint_id: str):
    db = get_db()
    result = await db.blueprints.delete_one({"blueprint_id": blueprint_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blueprint not found")
    return {"message": f"Blueprint '{blueprint_id}' deleted"}


@router.post("/blueprints/{blueprint_id}/duplicate")
async def duplicate_blueprint(blueprint_id: str):
    db = get_db()
    original = await db.blueprints.find_one({"blueprint_id": blueprint_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Blueprint not found")

    new_id = generate_id("bp")
    now = utcnow_str()
    copy = {**original, "blueprint_id": new_id, "name": f"{original['name']} (Copy)",
            "created_at": now, "updated_at": now, "version": "1.0"}
    copy["metadata"] = {**original.get("metadata", {}), "usage_count": 0, "success_rate": 0.0}
    await db.blueprints.insert_one(copy)
    return {"blueprint_id": new_id, "message": "Blueprint duplicated"}


@router.post("/blueprints/{blueprint_id}/inject")
async def inject_blueprint_vars(blueprint_id: str, body: dict):
    db = get_db()
    bp = await db.blueprints.find_one({"blueprint_id": blueprint_id}, {"_id": 0})
    if not bp:
        raise HTTPException(status_code=404, detail="Blueprint not found")

    variables = body.get("variables", {})
    actions = bp.get("actions", [])
    injected_actions = inject_variables(actions, variables)

    # Check for missing variables
    remaining_vars = extract_variables(injected_actions)
    missing = [v for v in remaining_vars if v not in variables]

    return {
        "blueprint": {**bp, "actions": injected_actions},
        "ready_to_execute": len(missing) == 0,
        "missing_variables": missing,
    }


@router.get("/blueprints/{blueprint_id}/executions")
async def get_blueprint_executions(blueprint_id: str, limit: int = Query(20)):
    db = get_db()
    cursor = db.executions.find(
        {"blueprint_id": blueprint_id},
        {"_id": 0, "action_timeline": 0, "network_logs": 0, "console_logs": 0}
    ).sort("timestamp", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return {"executions": docs, "total": len(docs)}
