import asyncio
import time
import uuid
from collections import deque
from typing import Any, Callable, Deque, Dict, List, Optional
from utils.logger import get_logger

logger = get_logger(__name__)


class NetworkInterceptor:
    def __init__(self, execution_id: str, on_update: Optional[Callable] = None):
        self.execution_id = execution_id
        self.on_update = on_update
        self.network_logs: List[Dict[str, Any]] = []
        self.console_logs: Deque[Dict[str, Any]] = deque(maxlen=100)
        self._request_timings: Dict[str, float] = {}
        self._lock = asyncio.Lock()

    def attach_to_page(self, page) -> None:
        """Attach interceptors to a Playwright page."""
        page.on("request", self._on_request)
        page.on("response", self._on_response)
        page.on("requestfailed", self._on_request_failed)
        page.on("console", self._on_console)
        logger.info(f"[{self.execution_id}] Network interceptor attached")

    def _on_request(self, request) -> None:
        self._request_timings[request.url] = time.time()

    def _on_response(self, response) -> None:
        asyncio.create_task(self._handle_response(response))

    def _on_request_failed(self, request) -> None:
        asyncio.create_task(self._handle_failed_request(request))

    def _on_console(self, msg) -> None:
        log_entry = {
            "type": msg.type,
            "text": msg.text,
            "timestamp": time.time(),
        }
        self.console_logs.append(log_entry)
        if self.on_update:
            asyncio.create_task(self._emit("console_log", {
                "log_type": msg.type,
                "text": msg.text,
            }))

    async def _handle_response(self, response) -> None:
        start = self._request_timings.pop(response.url, time.time())
        duration_ms = int((time.time() - start) * 1000)
        status = response.status
        url = response.url

        # Skip browser internals / extensions
        if url.startswith(("chrome-extension://", "data:")):
            return

        try:
            body = None
            if status < 300 and "json" in (response.headers.get("content-type") or ""):
                try:
                    body = await asyncio.wait_for(response.text(), timeout=3)
                    if len(body) > 2000:
                        body = body[:2000] + "...[truncated]"
                except Exception:
                    pass
        except Exception:
            pass

        log = {
            "request_id": str(uuid.uuid4())[:8],
            "execution_id": self.execution_id,
            "url": url,
            "method": response.request.method,
            "status": status,
            "content_type": response.headers.get("content-type", ""),
            "duration_ms": duration_ms,
            "size_bytes": int(response.headers.get("content-length") or 0),
            "timestamp": time.time(),
            "response_body": body,
            "is_error": status >= 400,
        }

        async with self._lock:
            self.network_logs.append(log)

        if self.on_update:
            await self._emit("network_request", {
                "url": url,
                "method": log["method"],
                "status": status,
                "duration_ms": duration_ms,
                "is_error": status >= 400,
            })

    async def _handle_failed_request(self, request) -> None:
        url = request.url
        if url.startswith(("chrome-extension://", "data:")):
            return
        log = {
            "request_id": str(uuid.uuid4())[:8],
            "execution_id": self.execution_id,
            "url": url,
            "method": request.method,
            "status": 0,
            "content_type": "",
            "duration_ms": 0,
            "size_bytes": 0,
            "timestamp": time.time(),
            "is_error": True,
            "error_message": request.failure or "Request failed",
        }
        async with self._lock:
            self.network_logs.append(log)

    async def _emit(self, event_type: str, data: Dict) -> None:
        if self.on_update:
            try:
                await self.on_update(event_type, data)
            except Exception:
                pass

    def get_network_logs(self) -> List[Dict[str, Any]]:
        return list(self.network_logs)

    def get_console_logs(self) -> List[Dict[str, Any]]:
        return list(self.console_logs)
