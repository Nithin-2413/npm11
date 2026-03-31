import asyncio
import os
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from faker import Faker
from utils.logger import get_logger

logger = get_logger(__name__)
fake = Faker()

SCREENSHOT_DIR = Path(os.environ.get("SCREENSHOT_DIR", "./screenshots"))
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


def resolve_faker_value(value: str) -> str:
    """Replace {{FAKER:type}} placeholders with real fake data."""
    if not value or "{{FAKER:" not in value:
        return value
    import re
    def replacer(match):
        faker_type = match.group(1).lower()
        mapping = {
            "email": fake.email(),
            "name": fake.name(),
            "first_name": fake.first_name(),
            "last_name": fake.last_name(),
            "phone": fake.phone_number(),
            "address": fake.address().replace("\n", ", "),
            "company": fake.company(),
            "username": fake.user_name(),
            "password": fake.password(length=12),
            "url": fake.url(),
            "city": fake.city(),
            "country": fake.country(),
            "zip": fake.zipcode(),
            "date": fake.date(),
            "text": fake.text(max_nb_chars=100),
            "sentence": fake.sentence(),
            "word": fake.word(),
            "number": str(fake.random_int(1, 1000)),
            "uuid": str(uuid.uuid4()),
        }
        return mapping.get(faker_type, fake.word())
    return re.sub(r'\{\{FAKER:([^}]+)\}\}', replacer, value)


class BrowserAgent:
    def __init__(
        self,
        execution_id: str,
        headless: bool = True,
        slow_mo: int = 0,
        on_update: Optional[Callable] = None,
    ):
        self.execution_id = execution_id
        self.headless = headless
        self.slow_mo = slow_mo
        self.on_update = on_update
        self._browser = None
        self._context = None
        self._page = None
        self._playwright = None

    async def start(self):
        from playwright.async_api import async_playwright
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=self.headless,
            slow_mo=self.slow_mo,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        )
        self._context = await self._browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        )
        self._page = await self._context.new_page()
        timeout = int(os.environ.get("BROWSER_TIMEOUT", 30000))
        self._page.set_default_timeout(timeout)
        logger.info(f"[{self.execution_id}] Browser started (headless={self.headless})")
        return self._page

    async def close(self):
        try:
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
            logger.info(f"[{self.execution_id}] Browser closed")
        except Exception as e:
            logger.warning(f"Browser close error: {e}")

    async def take_screenshot(self, label: str = "") -> Optional[str]:
        """Capture screenshot and return file path."""
        try:
            ts = datetime.utcnow().strftime("%H%M%S")
            safe_label = label.replace(" ", "_")[:20] if label else ""  
            filename = f"{self.execution_id}_{ts}_{safe_label}.png".strip("_")
            filepath = SCREENSHOT_DIR / filename
            await self._page.screenshot(path=str(filepath), full_page=False)
            logger.info(f"Screenshot: {filename}")
            return f"/api/screenshots/{filename}"
        except Exception as e:
            logger.error(f"Screenshot failed: {e}")
            return None

    async def get_page_html(self) -> str:
        try:
            return await self._page.content()
        except Exception:
            return ""

    async def execute_action(self, action: Dict[str, Any], max_retries: int = 3) -> Dict[str, Any]:
        """Execute a single action with retry logic."""
        action_type = action.get("type", "")
        started_at = datetime.utcnow().isoformat() + "Z"
        start_time = time.time()

        result = {
            "action_type": action_type,
            "selector": action.get("selector"),
            "value": action.get("value"),
            "status": "failure",
            "started_at": started_at,
            "duration_ms": 0,
            "error_message": None,
            "details": None,
        }

        last_error = None
        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    await asyncio.sleep(2 ** attempt)  # exponential backoff
                    logger.info(f"Retry {attempt}/{max_retries} for {action_type}")

                await self._run_action(action)
                result["status"] = "success"
                result["completed_at"] = datetime.utcnow().isoformat() + "Z"
                result["duration_ms"] = int((time.time() - start_time) * 1000)
                last_error = None
                break
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Action {action_type} failed (attempt {attempt+1}): {e}")
                # Screenshot on error
                if attempt == max_retries - 1:
                    screenshot = await self.take_screenshot(f"error_{action_type}")
                    result["screenshot_path"] = screenshot

        if last_error:
            result["status"] = "failure"
            result["error_message"] = last_error
            result["duration_ms"] = int((time.time() - start_time) * 1000)

        return result

    async def _run_action(self, action: Dict[str, Any]) -> None:
        action_type = action.get("type", "")
        page = self._page

        if action_type == "navigate":
            url = action.get("url", action.get("value", ""))
            logger.info(f"Navigating to {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)

        elif action_type == "fill":
            selector = action["selector"]
            value = resolve_faker_value(action.get("value", ""))
            await page.wait_for_selector(selector, state="visible", timeout=10000)
            await page.fill(selector, value)

        elif action_type == "click":
            selector = action["selector"]
            await page.wait_for_selector(selector, state="visible", timeout=10000)
            await page.click(selector)

        elif action_type == "select":
            selector = action["selector"]
            value = action.get("value", "")
            await page.wait_for_selector(selector, timeout=10000)
            # Try native select first
            try:
                await page.select_option(selector, label=value)
            except Exception:
                try:
                    await page.select_option(selector, value=value)
                except Exception:
                    # Custom dropdown: click to open, find option
                    await page.click(selector)
                    await asyncio.sleep(0.5)
                    await page.get_by_text(value).first.click()

        elif action_type == "wait":
            ms = action.get("ms", 1000)
            selector = action.get("selector")
            condition = action.get("condition")
            timeout = action.get("timeout", 30000)

            if condition == "networkidle":
                # FIX 3: Wait for network to be idle
                try:
                    await page.wait_for_load_state("networkidle", timeout=timeout)
                except Exception:
                    # Fallback: just wait a bit
                    await asyncio.sleep(2)
            elif selector:
                await page.wait_for_selector(selector, timeout=timeout)
            else:
                await asyncio.sleep(ms / 1000)

        elif action_type == "screenshot":
            await self.take_screenshot(action.get("filename", ""))

        elif action_type == "press":
            key = action.get("key", "Enter")
            await page.keyboard.press(key)

        elif action_type == "hover":
            selector = action["selector"]
            await page.hover(selector)

        elif action_type == "scroll":
            direction = action.get("direction", "down")
            selector = action.get("selector")
            if selector:
                await page.locator(selector).scroll_into_view_if_needed()
            else:
                delta = 500 if direction == "down" else -500
                await page.mouse.wheel(0, delta)

        elif action_type == "upload":
            selector = action["selector"]
            file_path = resolve_faker_value(action.get("value", action.get("file_path", "")))
            await page.wait_for_selector(selector, timeout=10000)
            await page.set_input_files(selector, file_path)
            logger.info(f"Uploaded file '{file_path}' to {selector}")

        elif action_type == "iframe":
            iframe_selector = action.get("selector", "iframe")
            inner_selector = action.get("value", action.get("inner_selector", ""))
            inner_action = action.get("inner_action", "click")
            inner_value = action.get("inner_value", "")

            frame_loc = page.frame_locator(iframe_selector)
            if inner_action == "click":
                await frame_loc.locator(inner_selector).click()
            elif inner_action == "fill":
                await frame_loc.locator(inner_selector).fill(inner_value)
            elif inner_action == "assert":
                text = await frame_loc.locator(inner_selector).inner_text()
                expected = action.get("text", "")
                if expected and expected.lower() not in text.lower():
                    raise AssertionError(f"Expected '{expected}' not found in iframe element")
            else:
                await frame_loc.locator(inner_selector).click()
            logger.info(f"Iframe action '{inner_action}' on {inner_selector} inside {iframe_selector}")

        elif action_type == "assert":
            selector = action["selector"]
            expected_text = action.get("text")
            await page.wait_for_selector(selector, state="visible", timeout=10000)
            if expected_text:
                elem = page.locator(selector)
                text = await elem.inner_text()
                if expected_text.lower() not in text.lower():
                    raise AssertionError(f"Expected '{expected_text}' not found in '{text[:100]}'")
        else:
            logger.warning(f"Unknown action type: {action_type}")

    async def execute_actions(
        self,
        actions: List[Dict[str, Any]],
        on_action_result: Optional[Callable] = None,
        continue_on_error: bool = False,
    ) -> List[Dict[str, Any]]:
        results = []
        for i, action in enumerate(actions):
            logger.info(f"Executing action {i+1}/{len(actions)}: {action.get('type')}")
            if self.on_update:
                await self.on_update("action_start", {
                    "index": i,
                    "action": action.get("type"),
                    "selector": action.get("selector"),
                    "url": action.get("url"),
                })

            result = await self.execute_action(action)
            result["action_index"] = i

            # Take screenshot after each action
            screenshot = await self.take_screenshot(f"step_{i+1}_{action.get('type')}")
            result["screenshot_path"] = screenshot

            results.append(result)

            if on_action_result:
                await on_action_result(i, result)

            if self.on_update:
                await self.on_update("action_complete", {
                    "index": i,
                    "status": result["status"],
                    "duration_ms": result["duration_ms"],
                    "screenshot_url": screenshot,
                    "error": result.get("error_message"),
                })

            if result["status"] == "failure" and not continue_on_error:
                if action.get("optional", False):
                    logger.info(f"Optional action {i} failed - continuing")
                else:
                    logger.error(f"Action {i} failed - stopping execution")
                    break

        return results
