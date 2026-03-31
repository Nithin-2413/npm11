"""PART 2B: Secrets API — stores encrypted credentials for use during execution."""
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from utils.database import get_db
from utils.helpers import generate_id, utcnow_str
from utils.crypto import encrypt_value, decrypt_value
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/secrets", tags=["secrets"])


class SecretCreate(BaseModel):
    name: str
    type: str = "credentials"
    domain: Optional[str] = None
    data: Dict[str, Any] = {}
    tags: List[str] = []


class SecretUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None


def _sanitize_for_response(doc: Dict) -> Dict:
    """Remove _id and mask password/api_key fields — never return plain text secrets."""
    doc = {k: v for k, v in doc.items() if k != "_id"}
    if "data" in doc:
        data = dict(doc["data"])
        for sensitive_key in ("password", "api_key", "token", "secret"):
            if data.get(sensitive_key):
                data[sensitive_key] = "***masked***"
        doc["data"] = data
    return doc


def _encrypt_sensitive_fields(data: Dict) -> Dict:
    """Encrypt password, api_key, token fields before storing."""
    encrypted = dict(data)
    for field in ("password", "api_key", "token", "secret"):
        if encrypted.get(field) and not encrypted[field].startswith("gAAA"):  # not already encrypted
            try:
                encrypted[field] = encrypt_value(encrypted[field])
            except Exception as e:
                logger.error(f"Failed to encrypt {field}: {e}")
    return encrypted


@router.get("")
async def list_secrets():
    """List all secrets — passwords are never returned."""
    db = get_db()
    secrets = []
    async for doc in db.secrets.find({}).sort("created_at", -1):
        secrets.append(_sanitize_for_response(doc))
    return {"secrets": secrets, "total": len(secrets)}


@router.post("")
async def create_secret(payload: SecretCreate):
    """Create a new secret with encrypted sensitive fields."""
    db = get_db()

    # Check for name collision
    existing = await db.secrets.find_one({"name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail=f"Secret with name '{payload.name}' already exists")

    # Encrypt sensitive fields
    encrypted_data = _encrypt_sensitive_fields(payload.data)

    secret = {
        "secret_id": generate_id("sec"),
        "name": payload.name,
        "type": payload.type,
        "domain": payload.domain or _extract_domain(payload.data.get("url", "")),
        "data": encrypted_data,
        "tags": payload.tags,
        "created_at": utcnow_str(),
        "last_used": None,
    }
    await db.secrets.insert_one(secret)
    logger.info(f"Created secret: {payload.name}")
    return {"secret_id": secret["secret_id"], "message": "Secret created successfully"}


@router.get("/{secret_id}")
async def get_secret(secret_id: str):
    """Get secret metadata (passwords masked)."""
    db = get_db()
    doc = await db.secrets.find_one({"secret_id": secret_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Secret not found")
    return _sanitize_for_response(doc)


@router.put("/{secret_id}")
async def update_secret(secret_id: str, payload: SecretUpdate):
    """Update a secret."""
    db = get_db()
    doc = await db.secrets.find_one({"secret_id": secret_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Secret not found")

    update = {"updated_at": utcnow_str()}
    if payload.name is not None:
        update["name"] = payload.name
    if payload.domain is not None:
        update["domain"] = payload.domain
    if payload.tags is not None:
        update["tags"] = payload.tags
    if payload.data is not None:
        # Merge with existing, encrypt new sensitive values
        existing_data = doc.get("data", {})
        new_data = {**existing_data, **payload.data}
        update["data"] = _encrypt_sensitive_fields(new_data)

    await db.secrets.update_one({"secret_id": secret_id}, {"$set": update})
    return {"message": "Secret updated"}


@router.delete("/{secret_id}")
async def delete_secret(secret_id: str):
    """Delete a secret permanently."""
    db = get_db()
    result = await db.secrets.delete_one({"secret_id": secret_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Secret not found")
    return {"message": "Secret deleted"}


@router.get("/{secret_id}/reveal")
async def reveal_secret(secret_id: str):
    """
    Return decrypted secret for execution engine use.
    Access is logged. Passwords are decrypted for the execution engine only.
    """
    db = get_db()
    doc = await db.secrets.find_one({"secret_id": secret_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Secret not found")

    # Log access
    logger.info(f"Secret revealed for execution: {doc.get('name')} [{secret_id}]")
    await db.secrets.update_one(
        {"secret_id": secret_id},
        {"$set": {"last_used": utcnow_str()}}
    )

    # Decrypt sensitive fields for execution engine
    data = dict(doc.get("data", {}))
    for field in ("password", "api_key", "token", "secret"):
        if data.get(field) and data[field] != "***masked***":
            try:
                data[field] = decrypt_value(data[field])
            except Exception:
                data[field] = ""

    doc["data"] = data
    return {k: v for k, v in doc.items() if k != "_id"}


def _extract_domain(url: str) -> Optional[str]:
    if not url:
        return None
    match = re.search(r'https?://(?:www\.)?([^/]+)', url)
    return match.group(1) if match else None
