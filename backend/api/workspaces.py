"""PART 4B: Workspaces API for team collaboration."""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from utils.database import get_db
from utils.helpers import generate_id, utcnow_str
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])

ROLES = ("admin", "editor", "viewer")


class WorkspaceCreate(BaseModel):
    name: str
    owner_id: str = "default"
    settings: Dict[str, Any] = {}


class InviteMember(BaseModel):
    email: str
    name: Optional[str] = None
    role: str = "viewer"


class UpdateMemberRole(BaseModel):
    role: str


def _clean(doc: Dict) -> Dict:
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("")
async def list_workspaces():
    db = get_db()
    workspaces = []
    async for doc in db.workspaces.find({}).sort("created_at", -1):
        workspaces.append(_clean(doc))
    return {"workspaces": workspaces, "total": len(workspaces)}


@router.post("")
async def create_workspace(payload: WorkspaceCreate):
    db = get_db()
    workspace = {
        "workspace_id": generate_id("ws"),
        "name": payload.name,
        "owner_id": payload.owner_id,
        "members": [],
        "settings": {
            "allow_public_blueprints": False,
            "require_approval_to_run": False,
            **payload.settings,
        },
        "created_at": utcnow_str(),
        "updated_at": utcnow_str(),
    }
    await db.workspaces.insert_one(workspace)
    return {"workspace_id": workspace["workspace_id"], "message": "Workspace created"}


@router.get("/{workspace_id}")
async def get_workspace(workspace_id: str):
    db = get_db()
    doc = await db.workspaces.find_one({"workspace_id": workspace_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return _clean(doc)


@router.post("/{workspace_id}/invite")
async def invite_member(workspace_id: str, payload: InviteMember):
    db = get_db()
    doc = await db.workspaces.find_one({"workspace_id": workspace_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if payload.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {ROLES}")

    # Check if already a member
    members = doc.get("members", [])
    if any(m.get("email") == payload.email for m in members):
        raise HTTPException(status_code=400, detail="User is already a member")

    new_member = {
        "user_id": generate_id("usr"),
        "email": payload.email,
        "name": payload.name or payload.email.split("@")[0],
        "role": payload.role,
        "joined_at": utcnow_str(),
    }
    await db.workspaces.update_one(
        {"workspace_id": workspace_id},
        {"$push": {"members": new_member}, "$set": {"updated_at": utcnow_str()}}
    )
    return {"message": f"Invited {payload.email} as {payload.role}", "member": new_member}


@router.put("/{workspace_id}/members/{user_id}")
async def update_member_role(workspace_id: str, user_id: str, payload: UpdateMemberRole):
    db = get_db()
    if payload.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role")

    result = await db.workspaces.update_one(
        {"workspace_id": workspace_id, "members.user_id": user_id},
        {"$set": {"members.$.role": payload.role, "updated_at": utcnow_str()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Workspace or member not found")
    return {"message": f"Role updated to {payload.role}"}


@router.delete("/{workspace_id}/members/{user_id}")
async def remove_member(workspace_id: str, user_id: str):
    db = get_db()
    result = await db.workspaces.update_one(
        {"workspace_id": workspace_id},
        {"$pull": {"members": {"user_id": user_id}}, "$set": {"updated_at": utcnow_str()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Workspace or member not found")
    return {"message": "Member removed"}


@router.get("/{workspace_id}/activity")
async def workspace_activity(workspace_id: str):
    """Recent activity feed — who ran what, when."""
    db = get_db()
    activity = []
    async for doc in db.executions.find(
        {"workspace_id": workspace_id}
    ).sort("timestamp", -1).limit(30):
        activity.append({
            "execution_id": doc.get("execution_id"),
            "command": doc.get("command", "")[:80],
            "blueprint_name": doc.get("blueprint_name"),
            "status": doc.get("status"),
            "timestamp": doc.get("timestamp"),
            "user_id": doc.get("user_id"),
        })
    return {"activity": activity, "workspace_id": workspace_id}
