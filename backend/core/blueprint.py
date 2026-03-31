import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from models.blueprint import Blueprint, BlueprintCreate, BlueprintVariable, BlueprintAction
from utils.database import get_db
from utils.helpers import generate_id, utcnow_str, sanitize_id
from utils.logger import get_logger

logger = get_logger(__name__)

SUPPORTED_ACTIONS = {
    "navigate", "fill", "click", "select", "wait", "screenshot",
    "press", "hover", "scroll", "assert", "upload", "keypress",
    "checkbox", "radio", "textarea", "condition", "loop", "function",
    "api", "delay", "extract", "custom",
}

TEMPLATE_BLUEPRINTS = [
    {
        "blueprint_id": "login_flow_v1",
        "name": "Login Flow",
        "description": "Standard login with email and password, verify dashboard redirect.",
        "version": "1.0",
        "variables": [
            {"name": "USER_EMAIL", "default_value": "test@example.com", "type": "email"},
            {"name": "USER_PASSWORD", "default_value": "", "type": "secret"},
        ],
        "actions": [
            {"id": "a1", "type": "navigate", "url": "https://example.com/login"},
            {"id": "a2", "type": "fill", "selector": "input[type='email']", "value": "{{USER_EMAIL}}"},
            {"id": "a3", "type": "fill", "selector": "input[type='password']", "value": "{{USER_PASSWORD}}"},
            {"id": "a4", "type": "click", "selector": "button[type='submit']"},
            {"id": "a5", "type": "wait", "ms": 2000},
            {"id": "a6", "type": "screenshot", "filename": "login_result"},
        ],
        "metadata": {"tags": ["Authentication"], "success_rate": 0.0, "usage_count": 0},
    },
    {
        "blueprint_id": "signup_flow_v1",
        "name": "Signup Flow",
        "description": "Complete user registration with email, password, and name.",
        "version": "1.0",
        "variables": [
            {"name": "USER_EMAIL", "default_value": "{{FAKER:email}}", "type": "email"},
            {"name": "USER_PASSWORD", "default_value": "SecurePass123!", "type": "secret"},
            {"name": "USER_NAME", "default_value": "{{FAKER:name}}", "type": "text"},
        ],
        "actions": [
            {"id": "a1", "type": "navigate", "url": "https://example.com/signup"},
            {"id": "a2", "type": "fill", "selector": "input[name='name']", "value": "{{USER_NAME}}"},
            {"id": "a3", "type": "fill", "selector": "input[name='email']", "value": "{{USER_EMAIL}}"},
            {"id": "a4", "type": "fill", "selector": "input[name='password']", "value": "{{USER_PASSWORD}}"},
            {"id": "a5", "type": "click", "selector": "button[type='submit']"},
            {"id": "a6", "type": "wait", "ms": 2000},
            {"id": "a7", "type": "screenshot", "filename": "signup_result"},
        ],
        "metadata": {"tags": ["Authentication", "Forms"], "success_rate": 0.0, "usage_count": 0},
    },
    {
        "blueprint_id": "search_flow_v1",
        "name": "Search & Verify",
        "description": "Navigate to a site, search for a query, and verify results.",
        "version": "1.0",
        "variables": [
            {"name": "BASE_URL", "default_value": "https://amazon.com", "type": "url"},
            {"name": "SEARCH_QUERY", "default_value": "wireless mouse", "type": "text"},
        ],
        "actions": [
            {"id": "a1", "type": "navigate", "url": "{{BASE_URL}}"},
            {"id": "a2", "type": "fill", "selector": "#twotabsearchtextbox", "value": "{{SEARCH_QUERY}}"},
            {"id": "a3", "type": "click", "selector": "#nav-search-submit-button"},
            {"id": "a4", "type": "wait", "ms": 3000},
            {"id": "a5", "type": "screenshot", "filename": "search_results"},
        ],
        "metadata": {"tags": ["Navigation", "Search"], "success_rate": 0.0, "usage_count": 0},
    },
    {
        "blueprint_id": "google_search_v1",
        "name": "Google Search",
        "description": "Search on Google and capture results page.",
        "version": "1.0",
        "variables": [
            {"name": "SEARCH_QUERY", "default_value": "FastAPI tutorial", "type": "text"},
        ],
        "actions": [
            {"id": "a1", "type": "navigate", "url": "https://google.com"},
            {"id": "a2", "type": "fill", "selector": "textarea[name='q']", "value": "{{SEARCH_QUERY}}"},
            {"id": "a3", "type": "press", "key": "Enter"},
            {"id": "a4", "type": "wait", "ms": 2000},
            {"id": "a5", "type": "screenshot", "filename": "google_results"},
        ],
        "metadata": {"tags": ["Navigation", "Search"], "success_rate": 0.0, "usage_count": 0},
    },
    {
        "blueprint_id": "form_validation_v1",
        "name": "Form Validation Test",
        "description": "Test form validation by submitting empty or invalid data.",
        "version": "1.0",
        "variables": [
            {"name": "TARGET_URL", "default_value": "https://example.com/contact", "type": "url"},
        ],
        "actions": [
            {"id": "a1", "type": "navigate", "url": "{{TARGET_URL}}"},
            {"id": "a2", "type": "click", "selector": "button[type='submit']", "optional": True},
            {"id": "a3", "type": "screenshot", "filename": "validation_errors"},
            {"id": "a4", "type": "fill", "selector": "input[name='email']", "value": "not-an-email"},
            {"id": "a5", "type": "click", "selector": "button[type='submit']", "optional": True},
            {"id": "a6", "type": "screenshot", "filename": "email_validation"},
        ],
        "metadata": {"tags": ["Forms", "Validation"], "success_rate": 0.0, "usage_count": 0},
    },
]


async def seed_blueprints() -> None:
    """Seed the database with template blueprints if empty."""
    db = get_db()
    count = await db.blueprints.count_documents({})
    if count == 0:
        now = utcnow_str()
        for bp_data in TEMPLATE_BLUEPRINTS:
            bp_data["created_at"] = now
            bp_data["updated_at"] = now
            await db.blueprints.insert_one(bp_data)
        logger.info(f"Seeded {len(TEMPLATE_BLUEPRINTS)} template blueprints")


def extract_variables(actions: List[Dict]) -> List[str]:
    """Find all {{VAR_NAME}} placeholders in actions."""
    pattern = re.compile(r'\{\{([A-Z0-9_]+)\}\}')
    variables = set()
    for action in actions:
        for key in ["url", "value", "selector"]:
            val = action.get(key, "")
            if val:
                for match in pattern.finditer(str(val)):
                    variables.add(match.group(1))
    return sorted(variables)


def inject_variables(actions: List[Dict], variables: Dict[str, str]) -> List[Dict]:
    """Replace {{VAR_NAME}} placeholders with actual values."""
    injected = []
    for action in actions:
        new_action = dict(action)
        for key in ["url", "value", "selector"]:
            if new_action.get(key):
                val = str(new_action[key])
                for var_name, var_val in variables.items():
                    val = val.replace(f"{{{{{var_name}}}}}", str(var_val))
                new_action[key] = val
        injected.append(new_action)
    return injected


def validate_actions(actions: List[Dict]) -> List[str]:
    """Validate blueprint actions and return errors."""
    errors = []
    for i, action in enumerate(actions):
        t = action.get("type")
        if not t:
            errors.append(f"Action {i}: missing 'type'")
            continue
        if t not in SUPPORTED_ACTIONS:
            errors.append(f"Action {i}: unsupported type '{t}'")
        if t in {"fill", "click", "select", "hover", "assert"} and not action.get("selector"):
            errors.append(f"Action {i} ({t}): missing 'selector'")
        if t == "navigate" and not action.get("url"):
            errors.append(f"Action {i} (navigate): missing 'url'")
    return errors
