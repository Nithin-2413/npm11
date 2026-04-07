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
    
    # Heartbeat task to keep connection alive - ping every 20 seconds
    import asyncio
    async def heartbeat():
        try:
            while True:
                await asyncio.sleep(20)  # Ping every 20 seconds (increased frequency)
                try:
                    await ws.send_json({"type": "ping", "timestamp": asyncio.get_event_loop().time()})
                except Exception as e:
                    logger.debug(f"Heartbeat send failed: {e}")
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
        # Increased timeout to 120 seconds to avoid premature disconnections
        while True:
            try:
                data = await asyncio.wait_for(ws.receive_text(), timeout=120.0)
                msg = json.loads(data) if data else {}
                if msg.get("type") == "ping":
                    await ws.send_json({"type": "pong"})
                elif msg.get("type") == "pong":
                    # Client responded to our ping
                    logger.debug(f"Received pong from client for {execution_id}")
                    continue
            except asyncio.TimeoutError:
                # No message received in 120s, but heartbeat keeps connection alive
                logger.debug(f"WS timeout for {execution_id}, but heartbeat active")
                continue
            except WebSocketDisconnect:
                logger.info(f"Client disconnected: {execution_id}")
                break
            except Exception as e:
                logger.warning(f"WS receive error for {execution_id}: {e}")
                break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WS error for {execution_id}: {e}")
    finally:
        heartbeat_task.cancel()
        unregister_ws(execution_id, ws)
        logger.info(f"WebSocket disconnected: {execution_id}")
