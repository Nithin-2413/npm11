import asyncio
import time
from dataclasses import dataclass, field
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
        try:
            _ws_connections[execution_id].remove(ws)
        except ValueError:
            pass


def cancel_execution(execution_id: str) -> None:
    _active_executions[execution_id] = False


def is_cancelled(execution_id: str) -> bool:
    return not _active_executions.get(execution_id, True)


# ─────────────────────────────────────────────────────────────────────────────
# FIX 3: ExecutionContext — short-term memory for the execution engine
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class ExecutionContext:
    execution_id: str
    command: str
    goal: str = ""
    current_url: str = ""
    page_title: str = ""
    completed_actions: List[Dict] = field(default_factory=list)
    failed_actions: List[Dict] = field(default_factory=list)
    variables: Dict[str, Any] = field(default_factory=dict)
    site_context: str = "generic"

    def to_dict(self) -> Dict:
        return {
            "execution_id": self.execution_id,
            "command": self.command,
            "goal": self.goal,
            "current_url": self.current_url,
            "page_title": self.page_title,
            "completed_actions": self.completed_actions,
            "failed_actions": self.failed_actions,
            "variables": self.variables,
            "site_context": self.site_context,
        }


# ─────────────────────────────────────────────────────────────────────────────
# FIX 3: Intelligent action execution with fallback selectors + LLM refinement
# ─────────────────────────────────────────────────────────────────────────────
async def execute_action_with_intelligence(
    agent: BrowserAgent,
    action: Dict[str, Any],
    ctx: ExecutionContext,
    llm,
) -> Dict[str, Any]:
    """
    Execute an action with:
    1. Primary selector attempt
    2. Fallback selectors if primary fails
    3. LLM refinement if all fallbacks fail
    4. Mark as optional/skip if truly unresolvable
    """
    action_type = action.get("type", "")
    fallback_selectors = action.get("fallback_selectors", [])

    # First attempt with primary selector
    result = await agent.execute_action(action)

    if result["status"] == "success":
        # Update context with success
        ctx.completed_actions.append({
            "type": action_type,
            "selector": action.get("selector"),
            "description": action.get("description", ""),
        })
        return result

    # Primary failed — try fallback selectors
    if fallback_selectors and action.get("type") in ("click", "fill", "assert", "hover", "wait"):
        for i, fallback_sel in enumerate(fallback_selectors):
            logger.info(f"[{ctx.execution_id}] Trying fallback selector {i+1}: {fallback_sel}")
            fallback_action = {**action, "selector": fallback_sel}
            fallback_result = await agent.execute_action(fallback_action)
            if fallback_result["status"] == "success":
                fallback_result["used_fallback"] = True
                fallback_result["fallback_index"] = i
                ctx.completed_actions.append({
                    "type": action_type,
                    "selector": fallback_sel,
                    "description": action.get("description", "") + f" (fallback {i+1})",
                })
                logger.info(f"[{ctx.execution_id}] Fallback selector {i+1} succeeded")
                return fallback_result

    # All fallbacks failed — ask LLM to refine the action
    logger.info(f"[{ctx.execution_id}] All selectors failed, asking LLM to refine action...")
    try:
        page_html = await agent.get_page_html()
        page_url = ctx.current_url or "unknown"
        error_msg = result.get("error_message", "Element not found")

        refined_action = await llm.refine_action_on_failure(
            failed_action=action,
            error_message=error_msg,
            page_html=page_html,
            page_url=page_url,
            context=ctx.to_dict(),
        )

        if refined_action:
            logger.info(f"[{ctx.execution_id}] LLM refined action, retrying...")
            refined_result = await agent.execute_action(refined_action)
            if refined_result["status"] == "success":
                refined_result["was_refined"] = True
                ctx.completed_actions.append({
                    "type": action_type,
                    "selector": refined_action.get("selector"),
                    "description": action.get("description", "") + " (LLM refined)",
                })
                logger.info(f"[{ctx.execution_id}] LLM-refined action succeeded!")
                return refined_result
            else:
                logger.warning(f"[{ctx.execution_id}] LLM-refined action also failed")
                result = refined_result  # Use the refined result for error reporting
    except Exception as e:
        logger.error(f"[{ctx.execution_id}] LLM refinement error: {e}")

    # All attempts exhausted
    ctx.failed_actions.append({
        "type": action_type,
        "selector": action.get("selector"),
        "error": result.get("error_message"),
        "description": action.get("description", ""),
    })
    return result


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
    interceptor = NetworkInterceptor(execution_id=execution_id, on_update=on_update, db=db)

    # FIX 3: Initialize ExecutionContext
    ctx = ExecutionContext(
        execution_id=execution_id,
        command=command,
    )

    try:
        # Step 1: Parse command with LLM
        await broadcast(execution_id, {"type": "status", "message": "Parsing command with AI..."})
        actions = await llm.parse_command_to_actions(command)

        if not actions:
            raise ValueError("LLM returned no actions")

        # Extract goal metadata if available (from new LLM response format)
        # The actions list is already processed by llm_client.parse_command_to_actions

        await broadcast(execution_id, {
            "type": "actions_parsed",
            "count": len(actions),
            "actions": [{"type": a.get("type"), "description": a.get("description", ""), "confidence": a.get("confidence", 0.8)} for a in actions],
        })

        # Step 2: Start browser
        await broadcast(execution_id, {"type": "status", "message": "Starting browser..."})
        page = await agent.start()
        interceptor.attach_to_page(page)

        # Step 3: Execute actions with intelligence
        action_results = []
        successful = 0
        failed = 0
        screenshots = []
        ai_analysis = None

        for i, action in enumerate(actions):
            if is_cancelled(execution_id):
                logger.info(f"[{execution_id}] Execution cancelled at action {i}")
                break

            # Update context with current page state
            try:
                ctx.current_url = page.url if page.url else ""
                ctx.page_title = await page.title() if page else ""
            except Exception:
                pass

            action_desc = action.get("description", f"{action.get('type')} action")
            action_confidence = action.get("confidence", 0.8)

            await broadcast(execution_id, {
                "type": "action_start",
                "index": i,
                "total": len(actions),
                "action": action.get("type"),
                "selector": action.get("selector"),
                "url": action.get("url"),
                "value": action.get("value"),
                "description": action_desc,
                "confidence": action_confidence,
            })

            # FIX 3: Use intelligent execution with fallbacks
            result = await execute_action_with_intelligence(agent, action, ctx, llm)
            result["action_index"] = i
            result["description"] = action_desc

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
                "description": action_desc,
                "used_fallback": result.get("used_fallback", False),
                "was_refined": result.get("was_refined", False),
            })

            # FIX 2+3: If failed — perform AI analysis and decide whether to stop
            if result["status"] == "failure":
                is_optional = action.get("optional", False)
                continue_on_error = options.get("continue_on_error", False)

                # Always generate AI analysis for failed actions
                page_html = await agent.get_page_html()
                error_context = {
                    "command": command,
                    "goal": ctx.goal,
                    "failed_action": {k: v for k, v in action.items() if k != "fallback_selectors"},
                    "error_message": result.get("error_message"),
                    "action_index": i,
                    "previous_actions": [a.get("type") for a in actions[:i]],
                    "completed_actions": ctx.completed_actions,
                    "console_logs": interceptor.get_console_logs()[-10:],
                    "page_html_snippet": page_html[:2000] if page_html else "",
                    "page_url": ctx.current_url,
                    "site_context": ctx.site_context,
                }
                ai_analysis = await llm.analyze_error(error_context)

                # FIX 2: Store ai_analysis in action timeline entry too
                result["ai_analysis"] = ai_analysis

                await broadcast(execution_id, {
                    "type": "error",
                    "action_index": i,
                    "error_message": result.get("error_message"),
                    "ai_analysis": ai_analysis,
                    "description": action_desc,
                })

                # FIX 2: Save AI analysis to DB immediately
                await db.executions.update_one(
                    {"execution_id": execution_id},
                    {"$set": {"ai_analysis": ai_analysis}},
                )

                if not is_optional and not continue_on_error:
                    # Required action failed → mark as PARTIAL and continue remaining
                    # (changed from "stop" to "mark PARTIAL, continue")
                    logger.warning(f"[{execution_id}] Required action {i} failed — marking PARTIAL, continuing")
                    # Update DB with current state
                    await db.executions.update_one(
                        {"execution_id": execution_id},
                        {"$set": {
                            "status": "PARTIAL",
                            "total_actions": len(actions),
                            "successful_actions": successful,
                            "failed_actions": failed,
                            "action_timeline": action_results,
                            "screenshots": screenshots,
                            "ai_analysis": ai_analysis,
                        }}
                    )
                    # Don't break — continue remaining actions
                elif is_optional:
                    logger.info(f"[{execution_id}] Optional action {i} failed — skipping")

            # Update DB progress after each action
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

        # Generate AI summary with full context
        exec_data = {
            "status": final_status,
            "command": command,
            "goal": ctx.goal,
            "duration_seconds": round(duration, 2),
            "total_actions": total,
            "successful_actions": successful,
            "failed_actions": failed,
            "network_logs": network_logs,
            "completed_actions": ctx.completed_actions,
            "failed_action_details": ctx.failed_actions,
        }
        ai_summary = await llm.generate_summary(exec_data)

        # Final DB update — FIX 2: ensure ai_analysis is always included
        final_update = {
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
        }
        if ai_analysis:
            final_update["ai_analysis"] = ai_analysis

        await db.executions.update_one(
            {"execution_id": execution_id},
            {"$set": final_update}
        )

        await broadcast(execution_id, {
            "type": "execution_complete",
            "status": final_status,
            "duration_seconds": round(duration, 2),
            "actions_successful": successful,
            "actions_total": total,
            "ai_summary": ai_summary,
            "ai_analysis": ai_analysis,
        })

        logger.info(f"[{execution_id}] Completed: {final_status} ({successful}/{total} actions, {duration:.1f}s)")

    except Exception as e:
        logger.error(f"[{execution_id}] Execution error: {e}")
        duration = time.time() - start_time

        # Generate AI analysis for unexpected errors
        error_ai = None
        try:
            error_ai = await llm.analyze_error({
                "command": command,
                "error_message": str(e),
                "error_type": "execution_crash",
            })
        except Exception:
            pass

        update = {
            "status": "FAILURE",
            "completed_at": utcnow_str(),
            "duration_seconds": round(duration, 2),
            "error_message": str(e),
        }
        if error_ai:
            update["ai_analysis"] = error_ai

        await db.executions.update_one(
            {"execution_id": execution_id},
            {"$set": update}
        )
        await broadcast(execution_id, {
            "type": "execution_complete",
            "status": "FAILURE",
            "error": str(e),
            "ai_analysis": error_ai,
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
    interceptor = NetworkInterceptor(execution_id=execution_id, on_update=on_update, db=db)

    # FIX 3: ExecutionContext for blueprints too
    ctx = ExecutionContext(
        execution_id=execution_id,
        command=command,
        goal=f"Execute blueprint: {bp_doc.get('name', blueprint_id)}",
    )

    ai_analysis = None

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

            try:
                ctx.current_url = page.url if page.url else ""
            except Exception:
                pass

            await broadcast(execution_id, {
                "type": "action_start",
                "index": i,
                "total": len(injected_actions),
                "action": action.get("type"),
                "selector": action.get("selector"),
                "description": action.get("description", ""),
            })

            # FIX 3: Use intelligent execution for blueprints too
            result = await execute_action_with_intelligence(agent, action, ctx, llm)
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

            if result["status"] == "failure":
                is_optional = action.get("optional", False)
                if not is_optional:
                    # FIX 2: Always generate AI analysis
                    page_html = await agent.get_page_html()
                    error_context = {
                        "command": command,
                        "failed_action": action,
                        "error_message": result.get("error_message"),
                        "action_index": i,
                    }
                    ai_analysis = await llm.analyze_error(error_context)
                    result["ai_analysis"] = ai_analysis
                    await db.executions.update_one(
                        {"execution_id": execution_id},
                        {"$set": {"ai_analysis": ai_analysis}},
                    )
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

        final_update = {
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
        }
        if ai_analysis:
            final_update["ai_analysis"] = ai_analysis

        await db.executions.update_one(
            {"execution_id": execution_id},
            {"$set": final_update}
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
            "ai_analysis": ai_analysis,
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
