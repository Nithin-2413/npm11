from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from utils.helpers import generate_id, utcnow_str


class BlueprintAction(BaseModel):
    id: str = Field(default_factory=lambda: generate_id("act"))
    type: str
    selector: Optional[str] = None
    url: Optional[str] = None
    value: Optional[str] = None
    timeout: int = 5000
    optional: bool = False
    description: Optional[str] = None


class BlueprintVariable(BaseModel):
    name: str
    default_value: Optional[str] = ""
    type: str = "text"  # text, number, boolean, secret, email, url
    description: Optional[str] = None
    required: bool = True


class BlueprintMetadata(BaseModel):
    tags: List[str] = []
    success_rate: float = 0.0
    usage_count: int = 0
    avg_duration: float = 0.0


class Blueprint(BaseModel):
    blueprint_id: str = Field(default_factory=lambda: generate_id("bp"))
    name: str
    description: str = ""
    version: str = "1.0"
    created_at: str = Field(default_factory=utcnow_str)
    updated_at: str = Field(default_factory=utcnow_str)
    variables: List[BlueprintVariable] = []
    actions: List[BlueprintAction] = []
    success_criteria: Optional[str] = None
    metadata: BlueprintMetadata = Field(default_factory=BlueprintMetadata)


class BlueprintCreate(BaseModel):
    name: str
    description: str = ""
    version: str = "1.0"
    variables: List[BlueprintVariable] = []
    actions: List[BlueprintAction] = []
    success_criteria: Optional[str] = None
    metadata: Optional[BlueprintMetadata] = None


class BlueprintUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    variables: Optional[List[BlueprintVariable]] = None
    actions: Optional[List[BlueprintAction]] = None
    success_criteria: Optional[str] = None
    metadata: Optional[BlueprintMetadata] = None
