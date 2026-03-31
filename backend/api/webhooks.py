"""PART 5A: Webhooks API for CI/CD integration."""
import hmac
import hashlib
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from utils.database import get_db
from utils.helpers import generate_id, utcnow_str
from utils.crypto import generate_token
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


class WebhookCreate(BaseModel):
    name: str
    blueprint_id: str
    variables: Dict[str, str] = {}
    trigger_on: List[str] = ["push", "pull_request"]
    branch_filter: Optional[str] = None
    is_active: bool = True


class WebhookUpdate(BaseModel):
    name: Optional[str] = None
    variables: Optional[Dict[str, str]] = None
    trigger_on: Optional[List[str]] = None
    branch_filter: Optional[str] = None
    is_active: Optional[bool] = None


def _clean(doc: Dict) -> Dict:
    doc = {k: v for k, v in doc.items() if k != "_id"}
    # Mask secret token in list responses
    if "secret_token" in doc:
        token = doc["secret_token"]
        doc["secret_token_preview"] = f"{token[:8]}...{token[-4:]}" if len(token) > 12 else "***"
    return doc


@router.get("")
async def list_webhooks():
    db = get_db()
    webhooks = []
    async for doc in db.webhooks.find({}).sort("created_at", -1):
        webhooks.append(_clean(doc))
    return {"webhooks": webhooks, "total": len(webhooks)}


@router.post("")
async def create_webhook(payload: WebhookCreate):
    db = get_db()

    bp = await db.blueprints.find_one({"blueprint_id": payload.blueprint_id})
    if not bp:
        raise HTTPException(status_code=404, detail="Blueprint not found")

    secret_token = generate_token(32)

    webhook = {
        "webhook_id": generate_id("wh"),
        "name": payload.name,
        "secret_token": secret_token,
        "blueprint_id": payload.blueprint_id,
        "blueprint_name": bp.get("name"),
        "variables": payload.variables,
        "trigger_on": payload.trigger_on,
        "branch_filter": payload.branch_filter,
        "is_active": payload.is_active,
        "created_at": utcnow_str(),
        "last_triggered": None,
        "trigger_count": 0,
    }
    await db.webhooks.insert_one(webhook)
    logger.info(f"Created webhook: {payload.name}")
    return {
        "webhook_id": webhook["webhook_id"],
        "secret_token": secret_token,  # Only returned once at creation
        "message": "Webhook created. Save the secret_token — it won't be shown again.",
    }


@router.get("/{webhook_id}")
async def get_webhook(webhook_id: str):
    db = get_db()
    doc = await db.webhooks.find_one({"webhook_id": webhook_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return _clean(doc)


@router.put("/{webhook_id}")
async def update_webhook(webhook_id: str, payload: WebhookUpdate):
    db = get_db()
    doc = await db.webhooks.find_one({"webhook_id": webhook_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Webhook not found")

    update = {"updated_at": utcnow_str()}
    for field in ("name", "variables", "trigger_on", "branch_filter", "is_active"):
        val = getattr(payload, field, None)
        if val is not None:
            update[field] = val

    await db.webhooks.update_one({"webhook_id": webhook_id}, {"$set": update})
    return {"message": "Webhook updated"}


@router.delete("/{webhook_id}")
async def delete_webhook(webhook_id: str):
    db = get_db()
    result = await db.webhooks.delete_one({"webhook_id": webhook_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"message": "Webhook deleted"}


@router.post("/trigger/{webhook_id}")
async def trigger_webhook(webhook_id: str, request: Request):
    """
    External trigger endpoint called by GitHub/GitLab.
    Validates X-Webhook-Secret header and triggers blueprint execution.
    """
    db = get_db()
    doc = await db.webhooks.find_one({"webhook_id": webhook_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Webhook not found")
    if not doc.get("is_active"):
        raise HTTPException(status_code=400, detail="Webhook is inactive")

    # Validate secret token
    provided_token = request.headers.get("X-Webhook-Secret", "")
    expected_token = doc.get("secret_token", "")
    if not hmac.compare_digest(provided_token, expected_token):
        logger.warning(f"Webhook {webhook_id}: invalid secret token")
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    # Parse GitHub/GitLab payload
    payload = {}
    try:
        payload = await request.json()
    except Exception:
        pass

    branch = _extract_branch(payload)
    commit = _extract_commit(payload)
    author = _extract_author(payload)

    # Apply branch filter
    branch_filter = doc.get("branch_filter")
    if branch_filter and branch and branch_filter not in branch:
        return {"message": f"Skipped — branch '{branch}' does not match filter '{branch_filter}'"}

    # Inject CI/CD variables
    exec_variables = {
        **doc.get("variables", {}),
        "CI_BRANCH": branch or "",
        "CI_COMMIT": commit or "",
        "CI_AUTHOR": author or "",
        "CI_TRIGGER": "webhook",
    }

    # Launch execution
    from core.orchestrator import execute_blueprint
    execution_id = generate_id("exec")

    import asyncio
    asyncio.create_task(execute_blueprint(
        execution_id=execution_id,
        blueprint_id=doc.get("blueprint_id"),
        variables=exec_variables,
        options={"headless": True, "webhook_id": webhook_id},
    ))

    # Update webhook stats
    await db.webhooks.update_one(
        {"webhook_id": webhook_id},
        {"$set": {"last_triggered": utcnow_str()}, "$inc": {"trigger_count": 1}}
    )

    logger.info(f"Webhook triggered: {doc.get('name')} → execution {execution_id}")
    return {
        "execution_id": execution_id,
        "message": "Blueprint execution started",
        "branch": branch,
        "commit": commit,
    }


def _extract_branch(payload: Dict) -> Optional[str]:
    ref = payload.get("ref", "")
    if ref.startswith("refs/heads/"):
        return ref.replace("refs/heads/", "")
    return payload.get("object_attributes", {}).get("source_branch") or ref or None


def _extract_commit(payload: Dict) -> Optional[str]:
    commits = payload.get("commits", [])
    if commits:
        return commits[0].get("id", "")[:8]
    return payload.get("checkout_sha", payload.get("after", ""))[:8] or None


def _extract_author(payload: Dict) -> Optional[str]:
    pusher = payload.get("pusher", {})
    if isinstance(pusher, dict):
        return pusher.get("name") or pusher.get("login")
    commits = payload.get("commits", [])
    if commits:
        return commits[0].get("author", {}).get("name")
    return None
