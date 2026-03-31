import asyncio
import time
import uuid
from collections import deque
from typing import Any, Callable, Deque, Dict, List, Optional
from utils.logger import get_logger

logger = get_logger(__name__)


class NetworkInterceptor:
    def __init__(self, execution_id: str, on_update: Optional[Callable] = None, db=None):
        self.execution_id = execution_id
        self.on_update = on_update
        self.db = db  # FIX 2: Database reference for saving AI analysis
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
        request = response.request

        # Skip browser internals / extensions
        if url.startswith(("chrome-extension://", "data:")):
            return

        # Capture request body (for POST/PUT/PATCH)
        request_body = None
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                post_data = request.post_data
                if post_data and len(post_data) < 10000:  # Limit to 10KB
                    request_body = post_data
                elif post_data:
                    request_body = post_data[:10000] + "...[truncated]"
            except Exception:
                pass

        # Capture response body (for all successful requests)
        response_body = None
        body_error = None
        try:
            content_type = response.headers.get("content-type", "").lower()
            # Capture text-based responses
            if any(t in content_type for t in ["json", "text", "html", "xml", "javascript", "css"]):
                try:
                    body_text = await asyncio.wait_for(response.text(), timeout=5)
                    if len(body_text) > 50000:  # Limit to 50KB
                        response_body = body_text[:50000] + "...[truncated]"
                    else:
                        response_body = body_text
                except asyncio.TimeoutError:
                    body_error = "body_read_timeout"
                except Exception as e:
                    body_error = str(e)
        except Exception as e:
            body_error = str(e)

        # For error responses, try to capture body for AI analysis
        error_body = None
        if status >= 400:
            try:
                error_body = await asyncio.wait_for(response.text(), timeout=3)
                if len(error_body) > 1000:
                    error_body = error_body[:1000] + "...[truncated]"
            except Exception:
                pass

        log = {
            "request_id": str(uuid.uuid4())[:8],
            "execution_id": self.execution_id,
            "url": url,
            "method": request.method,
            "status": status,
            "content_type": response.headers.get("content-type", ""),
            "duration_ms": duration_ms,
            "size_bytes": int(response.headers.get("content-length") or 0),
            "timestamp": time.time(),
            "request_body": request_body,
            "response_body": response_body,
            "is_error": status >= 400,
        }
        if body_error:
            log["body_read_error"] = body_error
        if error_body:
            log["error_body"] = error_body

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

        # FIX 2: For 4xx/5xx errors, trigger AI analysis and save to DB
        if status >= 400 and self.db is not None:
            asyncio.create_task(self._analyze_network_error(log))

    async def _analyze_network_error(self, log: Dict) -> None:
        """FIX 2: Analyze network errors with AI and save to execution document."""
        try:
            from core.llm_client import get_llm_client
            llm = get_llm_client()

            error_context = {
                "error_type": "network",
                "url": log.get("url"),
                "method": log.get("method"),
                "status": log.get("status"),
                "error_message": f"HTTP {log.get('status')} error on {log.get('method')} {log.get('url')}",
                "error_body": log.get("error_body", ""),
                "execution_id": self.execution_id,
            }

            diagnosis = await llm.analyze_error(error_context)

            # FIX 2: Save AI analysis to execution document in MongoDB
            await self.db.executions.update_one(
                {"execution_id": self.execution_id},
                {"$set": {"ai_analysis": diagnosis}},
            )
            logger.info(f"[{self.execution_id}] Network error AI analysis saved for {log.get('url')}")
        except Exception as e:
            logger.error(f"[{self.execution_id}] Network error AI analysis failed: {e}")

    async def _handle_failed_request(self, request) -> None:
        url = request.url
        if url.startswith(("chrome-extension://", "data:")):
            return

        # FIX 2: Safely get failure reason
        failure_reason = "Request failed"
        try:
            failure_reason = request.failure or "Request failed"
        except Exception:
            pass

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
            "error_message": failure_reason,
        }
        async with self._lock:
            self.network_logs.append(log)

        if self.on_update:
            await self._emit("network_request", {
                "url": url,
                "method": log["method"],
                "status": 0,
                "duration_ms": 0,
                "is_error": True,
                "error": failure_reason,
            })

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
