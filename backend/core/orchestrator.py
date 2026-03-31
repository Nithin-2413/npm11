import asyncio
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from models.execution import Execution, ActionResult, AIAnalysis, PerformanceMetrics
from core.agent import BrowserAgent
from core.interceptor import NetworkInterceptor
from core.llm_client import get_llm_client
from utils.database import get_db
from utils.helpers import generate_id, utcnow_str
from utils.logger import get_logger

logger = get_logger(__name__)

# Track active executions for cancellation
_active_executions: Dict[str, bool] = {}
# WebSocket connections per execution
_ws_connections: Dict[str, List[Any]] = {}


def register_ws(execution_id: str, ws) -> None:
    if execution_id not in _ws_connections:
        _ws_connections[execution_id] = []
    _ws_connections[execution_id].append(ws)


def unregister_ws(execution_id: str, ws) -> None:
    if execution_id in _ws_connections:
        _ws_connections[execution_id] = [w for w in _ws_connections[execution_id] if w != ws]


async def broadcast(execution_id: str, message: Dict) -> None:
    import json
    connections = _ws_connections.get(execution_id, [])
    dead = []
    for ws in connections:
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_connections[execution_id].remove(ws)


def cancel_execution(execution_id: str) -> None:
    _active_executions[execution_id] = False


def is_cancelled(execution_id: str) -> bool:
    return not _active_executions.get(execution_id, True)


async def execute_command(
    execution_id: str,
    command: str,
    options: Optional[Dict[str, Any]] = None,
) -> str:
    """Main execution function for natural language commands."""
    options = options or {}
    db = get_db()
    llm = get_llm_client()
    start_time = time.time()

    _active_executions[execution_id] = True

    # Create initial execution document
    execution = Execution(
        execution_id=execution_id,
        status="RUNNING",
        command=command,
        options=options,
    )
    await db.executions.insert_one(execution.dict())
    logger.info(f"[{execution_id}] Starting execution: {command[:80]}")

    async def on_update(event_type: str, data: Dict):
        await broadcast(execution_id, {"type": event_type, **data})

    agent = BrowserAgent(
        execution_id=execution_id,
        headless=options.get("headless", True),
        slow_mo=options.get("slow_mo", 0),
        on_update=on_update,
    )
    interceptor = NetworkInterceptor(execution_id=execution_id, on_update=on_update)

    try:
        # Step 1: Parse command with LLM
        await broadcast(execution_id, {"type": "status", "message": "Parsing command with AI..."})
        actions = await llm.parse_command_to_actions(command)

        if not actions:
            raise ValueError("LLM returned no actions")

        await broadcast(execution_id, {
            "type": "actions_parsed",
            "count": len(actions),
            "actions": actions,
        })

        # Step 2: Start browser
        await broadcast(execution_id, {"type": "status", "message": "Starting browser..."})
        page = await agent.start()
        interceptor.attach_to_page(page)

        # Step 3: Execute actions
        action_results = []
        successful = 0
        failed = 0
        screenshots = []

        for i, action in enumerate(actions):
            if is_cancelled(execution_id):
                logger.info(f"[{execution_id}] Execution cancelled at action {i}")
                break

            await broadcast(execution_id, {
                "type": "action_start",
                "index": i,
                "total": len(actions),
                "action": action.get("type"),
                "selector": action.get("selector"),
                "url": action.get("url"),
                "value": action.get("value"),
            })

            result = await agent.execute_action(action)
            result["action_index"] = i

            # Screenshot after each action
            ss = await agent.take_screenshot(f"step_{i+1}")
            if ss:
                result["screenshot_path"] = ss
                screenshots.append(ss)

            action_results.append(result)

            if result["status"] == "success":
                successful += 1
            else:
                failed += 1

            await broadcast(execution_id, {
                "type": "action_complete",
                "index": i,
                "total": len(actions),
                "status": result["status"],
                "duration_ms": result["duration_ms"],
                "screenshot_url": result.get("screenshot_path"),
                "error": result.get("error_message"),
            })

            # If failed and not optional, do AI analysis and stop
            if result["status"] == "failure" and not action.get("optional", False):
                if not options.get("continue_on_error", False):
                    # AI error analysis
                    page_html = await agent.get_page_html()
                    error_context = {
                        "command": command,
                        "failed_action": action,
                        "error_message": result.get("error_message"),
                        "action_index": i,
                        "previous_actions": [a.get("type") for a in actions[:i]],
                        "console_logs": interceptor.get_console_logs()[-10:],
                        "page_html_snippet": page_html[:2000] if page_html else "",
                    }
                    ai_analysis = await llm.analyze_error(error_context)
                    await broadcast(execution_id, {
                        "type": "error",
                        "action_index": i,
                        "error_message": result.get("error_message"),
                        "ai_analysis": ai_analysis,
                    })
                    # Save AI analysis to DB
                    await db.executions.update_one(
                        {"execution_id": execution_id},
                        {"$set": {"ai_analysis": ai_analysis}},
                    )
                    break

            # Update DB progress
            await db.executions.update_one(
                {"execution_id": execution_id},
                {"$set": {
                    "total_actions": len(actions),
                    "successful_actions": successful,
                    "failed_actions": failed,
                    "action_timeline": action_results,
                    "screenshots": screenshots,
                }}
            )

        # Step 4: Finalize
        duration = time.time() - start_time
        total = len(actions)

        if is_cancelled(execution_id):
            final_status = "CANCELLED"
        elif failed == 0:
            final_status = "SUCCESS"
        elif successful == 0:
            final_status = "FAILURE"
        else:
            final_status = "PARTIAL"

        network_logs = interceptor.get_network_logs()
        console_logs = interceptor.get_console_logs()

        # Performance metrics
        durations = [r.get("duration_ms", 0) for r in action_results]
        perf = PerformanceMetrics(
            avg_action_duration_ms=int(sum(durations) / len(durations)) if durations else 0,
            slowest_action_ms=max(durations) if durations else 0,
            network_bandwidth_bytes=sum(r.get("size_bytes", 0) for r in network_logs),
            performance_score=round((successful / total * 100) if total else 0, 1),
        )

        # Generate AI summary
        exec_data = {
            "status": final_status,
            "command": command,
            "duration_seconds": round(duration, 2),
            "total_actions": total,
            "successful_actions": successful,
            "failed_actions": failed,
            "network_logs": network_logs,
        }
        ai_summary = await llm.generate_summary(exec_data)

        # Final DB update
        await db.executions.update_one(
            {"execution_id": execution_id},
            {"$set": {
                "status": final_status,
                "completed_at": utcnow_str(),
                "duration_seconds": round(duration, 2),
                "total_actions": total,
                "successful_actions": successful,
                "failed_actions": failed,
                "action_timeline": action_results,
                "network_logs": network_logs,
                "console_logs": list(console_logs),
                "screenshots": screenshots,
                "ai_summary": ai_summary,
                "performance": perf.dict(),
            }}
        )

        await broadcast(execution_id, {
            "type": "execution_complete",
            "status": final_status,
            "duration_seconds": round(duration, 2),
            "actions_successful": successful,
            "actions_total": total,
            "ai_summary": ai_summary,
        })

        logger.info(f"[{execution_id}] Completed: {final_status} ({successful}/{total} actions, {duration:.1f}s)")

    except Exception as e:
        logger.error(f"[{execution_id}] Execution error: {e}")
        duration = time.time() - start_time
        await db.executions.update_one(
            {"execution_id": execution_id},
            {"$set": {
                "status": "FAILURE",
                "completed_at": utcnow_str(),
                "duration_seconds": round(duration, 2),
                "error_message": str(e),
            }}
        )
        await broadcast(execution_id, {
            "type": "execution_complete",
            "status": "FAILURE",
            "error": str(e),
        })
    finally:
        await agent.close()
        _active_executions.pop(execution_id, None)

    return execution_id


async def execute_blueprint(
    execution_id: str,
    blueprint_id: str,
    variables: Optional[Dict[str, str]] = None,
    options: Optional[Dict[str, Any]] = None,
) -> str:
    """Execute a blueprint with variable injection."""
    db = get_db()
    variables = variables or {}
    options = options or {}

    # Load blueprint
    bp_doc = await db.blueprints.find_one({"blueprint_id": blueprint_id})
    if not bp_doc:
        raise ValueError(f"Blueprint not found: {blueprint_id}")

    # Inject variables into actions
    actions = bp_doc.get("actions", [])
    injected_actions = []
    for action in actions:
        injected = dict(action)
        for key in ["url", "value", "selector"]:
            if injected.get(key):
                val = injected[key]
                for var_name, var_val in variables.items():
                    val = val.replace(f"{{{{{var_name}}}}}", var_val)
                injected[key] = val
        injected_actions.append(injected)

    # Build command from blueprint name
    command = f"Run blueprint: {bp_doc.get('name', blueprint_id)}"

    _active_executions[execution_id] = True
    start_time = time.time()
    llm = get_llm_client()

    # Create execution document
    exec_doc = Execution(
        execution_id=execution_id,
        status="RUNNING",
        command=command,
        blueprint_id=blueprint_id,
        blueprint_name=bp_doc.get("name"),
        total_actions=len(injected_actions),
        options=options,
    )
    await db.executions.insert_one(exec_doc.dict())

    async def on_update(event_type: str, data: Dict):
        await broadcast(execution_id, {"type": event_type, **data})

    agent = BrowserAgent(
        execution_id=execution_id,
        headless=options.get("headless", True),
        on_update=on_update,
    )
    interceptor = NetworkInterceptor(execution_id=execution_id, on_update=on_update)

    try:
        page = await agent.start()
        interceptor.attach_to_page(page)

        action_results = []
        successful = 0
        failed = 0
        screenshots = []

        for i, action in enumerate(injected_actions):
            if is_cancelled(execution_id):
                break

            await broadcast(execution_id, {
                "type": "action_start",
                "index": i,
                "total": len(injected_actions),
                "action": action.get("type"),
                "selector": action.get("selector"),
            })

            result = await agent.execute_action(action)
            result["action_index"] = i
            ss = await agent.take_screenshot(f"bp_{i+1}")
            if ss:
                result["screenshot_path"] = ss
                screenshots.append(ss)

            action_results.append(result)
            if result["status"] == "success":
                successful += 1
            else:
                failed += 1

            await broadcast(execution_id, {
                "type": "action_complete",
                "index": i,
                "total": len(injected_actions),
                "status": result["status"],
                "duration_ms": result["duration_ms"],
                "screenshot_url": result.get("screenshot_path"),
            })

            if result["status"] == "failure" and not action.get("optional", False):
                if not options.get("continue_on_error", False):
                    break

        duration = time.time() - start_time
        total = len(injected_actions)

        if is_cancelled(execution_id):
            final_status = "CANCELLED"
        elif failed == 0:
            final_status = "SUCCESS"
        elif successful == 0:
            final_status = "FAILURE"
        else:
            final_status = "PARTIAL"

        network_logs = interceptor.get_network_logs()
        console_logs = interceptor.get_console_logs()
        ai_summary = await llm.generate_summary({
            "status": final_status, "command": command,
            "duration_seconds": round(duration, 2),
            "total_actions": total, "successful_actions": successful,
            "failed_actions": failed, "network_logs": network_logs,
        })

        await db.executions.update_one(
            {"execution_id": execution_id},
            {"$set": {
                "status": final_status,
                "completed_at": utcnow_str(),
                "duration_seconds": round(duration, 2),
                "total_actions": total,
                "successful_actions": successful,
                "failed_actions": failed,
                "action_timeline": action_results,
                "network_logs": network_logs,
                "console_logs": list(console_logs),
                "screenshots": screenshots,
                "ai_summary": ai_summary,
            }}
        )

        # Update blueprint usage stats
        await db.blueprints.update_one(
            {"blueprint_id": blueprint_id},
            {"$inc": {"metadata.usage_count": 1}}
        )

        await broadcast(execution_id, {
            "type": "execution_complete",
            "status": final_status,
            "duration_seconds": round(duration, 2),
            "actions_successful": successful,
            "actions_total": total,
        })

    except Exception as e:
        logger.error(f"[{execution_id}] Blueprint execution error: {e}")
        duration = time.time() - start_time
        await db.executions.update_one(
            {"execution_id": execution_id},
            {"$set": {"status": "FAILURE", "completed_at": utcnow_str(),
                      "duration_seconds": round(duration, 2), "error_message": str(e)}}
        )
        await broadcast(execution_id, {"type": "execution_complete", "status": "FAILURE", "error": str(e)})
    finally:
        await agent.close()
        _active_executions.pop(execution_id, None)

    return execution_id
