import json
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from core.orchestrator import register_ws, unregister_ws
from utils.logger import get_logger

router = APIRouter(tags=["websocket"])
logger = get_logger(__name__)


@router.websocket("/ws/execution/{execution_id}")
async def ws_execution(ws: WebSocket, execution_id: str):
    """WebSocket endpoint for real-time execution updates."""
    await ws.accept()
    register_ws(execution_id, ws)
    logger.info(f"WebSocket connected: {execution_id}")

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
                data = await ws.receive_text()
                msg = json.loads(data) if data else {}
                if msg.get("type") == "ping":
                    await ws.send_json({"type": "pong"})
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
        unregister_ws(execution_id, ws)
        logger.info(f"WebSocket disconnected: {execution_id}")
