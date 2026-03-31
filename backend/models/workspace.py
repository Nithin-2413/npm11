from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class WorkspaceMember(BaseModel):
    user_id: str
    email: str
    name: Optional[str] = None
    role: str = "viewer"  # admin | editor | viewer
    joined_at: str


class Workspace(BaseModel):
    workspace_id: str
    name: str
    owner_id: str
    members: List[WorkspaceMember] = []
    settings: Dict[str, Any] = {"allow_public_blueprints": False, "require_approval_to_run": False}
    created_at: str
    updated_at: Optional[str] = None
