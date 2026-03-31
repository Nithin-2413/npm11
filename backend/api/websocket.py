import json
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from core.orchestrator import register_ws, unregister_ws
from utils.logger import get_logger

router = APIRouter(tags=["websocket"])
logger = get_logger(__name__)


@router.websocket("/ws/execution/{execution_id}")
async def ws_execution(ws: WebSocket, execution_id: str):
    """WebSocket endpoint for real-time execution updates with heartbeat."""
    await ws.accept()
    register_ws(execution_id, ws)
    logger.info(f"WebSocket connected: {execution_id}")
    
    # Heartbeat task to keep connection alive
    import asyncio
    async def heartbeat():
        try:
            while True:
                await asyncio.sleep(30)  # Ping every 30 seconds
                try:
                    await ws.send_json({"type": "ping", "timestamp": ""})
                except Exception:
                    break
        except asyncio.CancelledError:
            pass
    
    heartbeat_task = asyncio.create_task(heartbeat())

    try:
        # Send initial status if execution exists
        from utils.database import get_db
        db = get_db()
        doc = await db.executions.find_one({"execution_id": execution_id}, {"_id": 0})
        if doc:
            await ws.send_json({
                "type": "connected",
                "execution_id": execution_id,
                "status": doc.get("status", "UNKNOWN"),
            })
        else:
            await ws.send_json({"type": "connected", "execution_id": execution_id, "status": "WAITING"})

        # Keep connection alive, receiving any client messages
        while True:
            try:
                data = await asyncio.wait_for(ws.receive_text(), timeout=60.0)
                msg = json.loads(data) if data else {}
                if msg.get("type") == "ping":
                    await ws.send_json({"type": "pong"})
                elif msg.get("type") == "pong":
                    # Client responded to our ping
                    continue
            except asyncio.TimeoutError:
                # No message received in 60s, heartbeat keeps connection alive
                continue
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.warning(f"WS receive error: {e}")
                break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WS error for {execution_id}: {e}")
    finally:
        heartbeat_task.cancel()
        unregister_ws(execution_id, ws)
        logger.info(f"WebSocket disconnected: {execution_id}")
