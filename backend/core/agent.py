import asyncio
import base64
import os
import re
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from faker import Faker
from utils.logger import get_logger
from core.smart_popup import SmartPopupDetector
from core.smart_checkbox import SmartCheckbox, SmartDropdown

logger = get_logger(__name__)
fake = Faker()

SCREENSHOT_DIR = Path(os.environ.get("SCREENSHOT_DIR", "./screenshots"))
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


def resolve_faker_value(value: str) -> str:
    """Replace {{FAKER:type}} placeholders with real fake data."""
    if not value or "{{FAKER:" not in value:
        return value

    def replacer(match):
        faker_type = match.group(1).lower()
        mapping = {
            "email": fake.email(), "name": fake.name(), "first_name": fake.first_name(),
            "last_name": fake.last_name(), "phone": fake.phone_number(),
            "address": fake.address().replace("\n", ", "), "company": fake.company(),
            "username": fake.user_name(), "password": fake.password(length=12),
            "url": fake.url(), "city": fake.city(), "country": fake.country(),
            "zip": fake.zipcode(), "date": fake.date(), "text": fake.text(max_nb_chars=100),
            "sentence": fake.sentence(), "word": fake.word(),
            "number": str(fake.random_int(1, 1000)), "uuid": str(uuid.uuid4()),
        }
        return mapping.get(faker_type, fake.word())

    return re.sub(r'\{\{FAKER:([^}]+)\}\}', replacer, value)


# ─────────────────────────────────────────────────────────────────────────────
# PART 1A: SmartLocator — 4-layer selector strategy
# ─────────────────────────────────────────────────────────────────────────────
class SmartLocatorError(Exception):
    def __init__(self, message: str, attempt_log: List[Dict]):
        super().__init__(message)
        self.attempt_log = attempt_log


class SmartLocator:
    """
    4-layer selector strategy:
    Layer 1 — Semantic/ARIA/role-based selectors (most reliable)
    Layer 2 — Text/placeholder/class pattern matching
    Layer 3 — ID/name/type attributes
    Layer 4 — Playwright resilient locators + LLM vision fallback
    """

    # Layer 1: Semantic selectors by intent keyword
    SEMANTIC_MAP: Dict[str, List[str]] = {
        "search": [
            "input[role='searchbox']", "[role='searchbox']", "input[type='search']",
            "[aria-label*='search' i]", "[aria-label*='Search' i]",
            "[data-testid*='search' i]", "[data-cy*='search' i]",
            "input[name='q']", "input[name='search']",
        ],
        "submit": [
            "button[type='submit']", "input[type='submit']",
            "[role='button'][type='submit']", "button:has-text('Submit')",
            "button:has-text('Search')", "button:has-text('Go')",
        ],
        "cart": [
            "[aria-label*='cart' i]", "[aria-label*='Cart' i]",
            "[data-testid*='cart' i]", "#add-to-cart-button",
            "button:has-text('Add to Cart')", "button:has-text('Add to cart')",
            "[id*='add-to-cart' i]", "input[value*='Add to Cart']",
        ],
        "login": [
            "button:has-text('Sign in')", "button:has-text('Log in')",
            "button:has-text('Login')", "[type='submit']:has-text('Sign')",
            "a:has-text('Sign in')", "[href*='login' i]", "[href*='signin' i]",
        ],
        "email": [
            "input[type='email']", "input[name*='email' i]",
            "[placeholder*='email' i]", "[aria-label*='email' i]",
        ],
        "password": [
            "input[type='password']", "input[name*='password' i]",
            "[aria-label*='password' i]",
        ],
        "username": [
            "input[name*='user' i]", "input[name*='email' i]",
            "input[type='email']", "[placeholder*='email' i]",
            "[placeholder*='username' i]", "[aria-label*='username' i]",
        ],
        "close": [
            "button[aria-label*='close' i]", "button[aria-label*='dismiss' i]",
            "[role='button']:has-text('×')", ".close-button", "[data-dismiss]",
            "button:has-text('✕')", "button:has-text('Close')",
        ],
        "accept": [
            "button:has-text('Accept')", "button:has-text('Accept All')",
            "button:has-text('Agree')", "button:has-text('OK')",
            "[aria-label*='accept' i]", "button:has-text('I agree')",
        ],
        "next": [
            "button:has-text('Next')", "a:has-text('Next')",
            "[aria-label*='next' i]", ".pagination-next", "[data-testid*='next']",
        ],
        "buy": [
            "button:has-text('Buy')", "button:has-text('Purchase')",
            "button:has-text('Checkout')", "[aria-label*='buy' i]",
            "#buy-now-button", "[id*='buy-now' i]",
        ],
    }

    async def find(self, page, intent: str, context: Dict = None) -> Any:
        """
        Find an element using 4-layer strategy.
        intent = "search box", "add to cart button", "close popup"
        Returns the Playwright locator or element handle.
        """
        attempt_log = []
        intent_lower = intent.lower()

        # Determine intent keywords
        intent_key = None
        for key in self.SEMANTIC_MAP:
            if key in intent_lower:
                intent_key = key
                break

        # ── Layer 1: Semantic/ARIA/Role selectors ──────────────────────────
        layer1_selectors = self.SEMANTIC_MAP.get(intent_key, []) if intent_key else []
        for sel in layer1_selectors:
            try:
                loc = page.locator(sel).first
                if await loc.count() > 0:
                    if await loc.is_visible():
                        attempt_log.append({"layer": 1, "selector": sel, "result": "found"})
                        logger.info(f"SmartLocator L1 found '{intent}' via: {sel}")
                        return loc
            except Exception as e:
                attempt_log.append({"layer": 1, "selector": sel, "error": str(e)})

        # ── Layer 2: Text/placeholder/class pattern matching ───────────────
        # Extract nouns from intent
        words = re.findall(r'\b\w{3,}\b', intent_lower)
        layer2_attempts = []
        for word in words:
            layer2_attempts.extend([
                f"[placeholder*='{word}' i]",
                f"[class*='{word}' i]",
                f"[aria-placeholder*='{word}' i]",
            ])
        for sel in layer2_attempts:
            try:
                loc = page.locator(sel).first
                if await loc.count() > 0 and await loc.is_visible():
                    attempt_log.append({"layer": 2, "selector": sel, "result": "found"})
                    logger.info(f"SmartLocator L2 found '{intent}' via: {sel}")
                    return loc
            except Exception as e:
                attempt_log.append({"layer": 2, "selector": sel, "error": str(e)[:50]})

        # ── Layer 3: ID and attribute based ───────────────────────────────
        layer3_attempts = []
        for word in words:
            layer3_attempts.extend([
                f"[id*='{word}' i]",
                f"[name*='{word}' i]",
                f"[data-testid*='{word}' i]",
                f"[data-cy*='{word}' i]",
            ])
        for sel in layer3_attempts:
            try:
                loc = page.locator(sel).first
                if await loc.count() > 0 and await loc.is_visible():
                    attempt_log.append({"layer": 3, "selector": sel, "result": "found"})
                    logger.info(f"SmartLocator L3 found '{intent}' via: {sel}")
                    return loc
            except Exception as e:
                attempt_log.append({"layer": 3, "selector": sel, "error": str(e)[:50]})

        # ── Layer 4: Playwright resilient locators ─────────────────────────
        # Try page.get_by_role, get_by_text, get_by_placeholder
        layer4_attempts = [
            ("get_by_placeholder", words[0] if words else intent),
            ("get_by_text", intent),
        ]
        # Role-based heuristics
        if any(k in intent_lower for k in ["button", "click", "submit", "buy", "cart", "login"]):
            try:
                loc = page.get_by_role("button", name=re.compile("|".join(words[:2]), re.I)).first
                if await loc.count() > 0 and await loc.is_visible():
                    attempt_log.append({"layer": 4, "method": "get_by_role(button)", "result": "found"})
                    logger.info(f"SmartLocator L4 found '{intent}' via get_by_role(button)")
                    return loc
            except Exception:
                pass

        if any(k in intent_lower for k in ["search", "type", "enter", "input", "fill"]):
            for word in words:
                try:
                    loc = page.get_by_placeholder(re.compile(word, re.I)).first
                    if await loc.count() > 0 and await loc.is_visible():
                        attempt_log.append({"layer": 4, "method": f"get_by_placeholder({word})", "result": "found"})
                        logger.info(f"SmartLocator L4 found '{intent}' via get_by_placeholder")
                        return loc
                except Exception:
                    pass

        # Try get_by_text for clickable elements
        for word in words:
            try:
                loc = page.get_by_text(re.compile(word, re.I)).first
                if await loc.count() > 0 and await loc.is_visible():
                    attempt_log.append({"layer": 4, "method": f"get_by_text({word})", "result": "found"})
                    logger.info(f"SmartLocator L4 found '{intent}' via get_by_text")
                    return loc
            except Exception:
                pass

        # All layers failed
        attempt_log.append({"layer": "all", "result": "not_found", "intent": intent})
        logger.warning(f"SmartLocator: Could not find '{intent}' after all 4 layers")
        raise SmartLocatorError(f"Element not found: '{intent}'", attempt_log)

    async def find_with_selector(self, page, selector: str, intent: str = "") -> Any:
        """
        Try a specific selector, falling back to SmartLocator if it fails.
        """
        try:
            loc = page.locator(selector).first
            if await loc.count() > 0 and await loc.is_visible():
                return loc
        except Exception:
            pass
        # Fall back to SmartLocator
        if intent:
            return await self.find(page, intent)
        raise Exception(f"Selector '{selector}' not found")


# ─────────────────────────────────────────────────────────────────────────────
# BrowserAgent — main execution engine with SmartLocator integrated
# ─────────────────────────────────────────────────────────────────────────────
class BrowserAgent:
    def __init__(
        self,
        execution_id: str,
        headless: bool = True,
        slow_mo: int = 0,
        stealth_mode: bool = False,
        on_update: Optional[Callable] = None,
    ):
        self.execution_id = execution_id
        self.headless = headless
        self.slow_mo = slow_mo
        self.stealth_mode = stealth_mode
        self.on_update = on_update
        self._browser = None
        self._context = None
        self._page = None
        self._playwright = None
        self.smart_locator = SmartLocator()

    async def start(self):
        from playwright.async_api import async_playwright
        
        self._playwright = await async_playwright().start()
        
        # Enhanced browser args for stealth
        browser_args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ]
        
        if self.stealth_mode:
            # Additional stealth args
            browser_args.extend([
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-web-security",
            ])
        
        self._browser = await self._playwright.chromium.launch(
            headless=self.headless,
            slow_mo=self.slow_mo,
            args=browser_args,
        )
        
        # Enhanced user agent for stealth
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        
        self._context = await self._browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=user_agent,
            locale="en-US",
            timezone_id="America/New_York",
        )
        
        # Apply stealth mode if enabled
        if self.stealth_mode:
            try:
                from playwright_stealth import Stealth
                stealth = Stealth()
                await stealth.apply_stealth_async(self._context)
                logger.info(f"[{self.execution_id}] Stealth mode ENABLED - bot detection evasion active")
            except Exception as e:
                logger.warning(f"Stealth mode failed to apply: {e}")
        
        self._page = await self._context.new_page()
        timeout = int(os.environ.get("BROWSER_TIMEOUT", 30000))
        self._page.set_default_timeout(timeout)
        
        logger.info(f"[{self.execution_id}] Browser started (headless={self.headless}, stealth={self.stealth_mode})")
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

    async def take_screenshot_b64(self) -> str:
        """Take screenshot and return as base64 for LLM analysis."""
        try:
            data = await self._page.screenshot(type="jpeg", quality=40)
            return base64.b64encode(data).decode()
        except Exception:
            return ""

    async def get_page_html(self) -> str:
        try:
            return await self._page.content()
        except Exception:
            return ""

    async def handle_popups_and_banners(self) -> List[str]:
        """
        PART 1C: Detect and dismiss common popups, cookie banners, modals.
        Returns list of actions taken.
        """
        actions_taken = []
        page = self._page

        # Cookie consent banners
        cookie_selectors = [
            "button:has-text('Accept All')", "button:has-text('Accept all')",
            "button:has-text('Accept Cookies')", "button:has-text('Accept cookies')",
            "button:has-text('Accept')", "button:has-text('Agree')",
            "button:has-text('Allow All')", "button:has-text('I Agree')",
            "#acceptBtn", "#cookie-accept", "[id*='accept-cookie' i]",
            "[class*='cookie'] button:has-text('OK')",
        ]
        for sel in cookie_selectors:
            try:
                loc = page.locator(sel).first
                if await loc.count() > 0 and await loc.is_visible():
                    await loc.click(timeout=3000)
                    actions_taken.append(f"Dismissed cookie banner: {sel}")
                    logger.info(f"Dismissed cookie banner: {sel}")
                    await asyncio.sleep(0.5)
                    break
            except Exception:
                pass

        # Newsletter/popup close buttons
        close_selectors = [
            "button[aria-label*='close' i]", "button[aria-label*='Close' i]",
            "button[aria-label*='dismiss' i]", "[data-dismiss='modal']",
            ".modal .close", ".popup-close", "[class*='close-btn' i]",
            "button:has-text('✕')", "button:has-text('×')", "button:has-text('✖')",
            ".modal-close", "[class*='popup'] button[class*='close' i]",
        ]
        for sel in close_selectors:
            try:
                loc = page.locator(sel).first
                if await loc.count() > 0 and await loc.is_visible():
                    await loc.click(timeout=3000)
                    actions_taken.append(f"Closed popup: {sel}")
                    logger.info(f"Closed popup: {sel}")
                    await asyncio.sleep(0.5)
                    break
            except Exception:
                pass

        return actions_taken

    async def execute_action(self, action: Dict[str, Any], max_retries: int = 2) -> Dict[str, Any]:
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
                    await asyncio.sleep(1.5 ** attempt)
                    logger.info(f"Retry {attempt}/{max_retries} for {action_type}")
                await self._run_action(action)
                result["status"] = "success"
                result["completed_at"] = datetime.utcnow().isoformat() + "Z"
                result["duration_ms"] = int((time.time() - start_time) * 1000)
                last_error = None
                break
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Action {action_type} attempt {attempt+1}: {str(e)[:100]}")

        if last_error:
            result["status"] = "failure"
            result["error_message"] = last_error
            result["duration_ms"] = int((time.time() - start_time) * 1000)
            # Screenshot on failure
            ss = await self.take_screenshot(f"fail_{action_type}")
            if ss:
                result["screenshot_path"] = ss

        return result

    async def _run_action(self, action: Dict[str, Any]) -> None:
        action_type = action.get("type", "")
        page = self._page
        intent = action.get("description", "")

        if action_type == "navigate":
            url = action.get("url", action.get("value", ""))
            logger.info(f"Navigating to {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            # Auto-handle popups after navigation
            await asyncio.sleep(0.8)
            await self.handle_popups_and_banners()

        elif action_type == "fill":
            selector = action.get("selector", "")
            value = resolve_faker_value(action.get("value", ""))

            # Try SmartLocator if selector fails
            try:
                await page.wait_for_selector(selector, state="visible", timeout=8000)
                await page.click(selector)
                await page.fill(selector, value)
            except Exception:
                try:
                    loc = await self.smart_locator.find(page, intent or "input field")
                    await loc.click()
                    await loc.fill(value)
                    logger.info(f"SmartLocator fill succeeded for intent: {intent}")
                except SmartLocatorError:
                    raise

        elif action_type == "click":
            selector = action.get("selector", "")
            try:
                await page.wait_for_selector(selector, state="visible", timeout=8000)
                await page.click(selector)
            except Exception:
                try:
                    loc = await self.smart_locator.find(page, intent or "clickable element")
                    await loc.click()
                    logger.info(f"SmartLocator click succeeded for intent: {intent}")
                except SmartLocatorError:
                    raise

        elif action_type == "select":
            selector = action.get("selector", "")
            value = action.get("value", "")
            await page.wait_for_selector(selector, timeout=10000)
            try:
                await page.select_option(selector, label=value)
            except Exception:
                try:
                    await page.select_option(selector, value=value)
                except Exception:
                    await page.click(selector)
                    await asyncio.sleep(0.5)
                    await page.get_by_text(value).first.click()

        elif action_type == "wait":
            ms = action.get("ms", 1000)
            selector = action.get("selector")
            condition = action.get("condition")
            timeout = action.get("timeout", 15000)
            if condition == "networkidle":
                try:
                    await page.wait_for_load_state("networkidle", timeout=timeout)
                except Exception:
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
            selector = action.get("selector", "")
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
            selector = action.get("selector", "")
            file_path = resolve_faker_value(action.get("value", ""))
            await page.wait_for_selector(selector, timeout=10000)
            await page.set_input_files(selector, file_path)

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
                    raise AssertionError(f"Expected '{expected}' not found in iframe")
            else:
                await frame_loc.locator(inner_selector).click()

        elif action_type == "assert":
            selector = action.get("selector", "")
            expected_text = action.get("text")
            await page.wait_for_selector(selector, state="visible", timeout=10000)
            if expected_text:
                text = await page.locator(selector).inner_text()
                if expected_text.lower() not in text.lower():
                    raise AssertionError(f"Expected '{expected_text}' not found in '{text[:100]}'")

        elif action_type == "use_secret":
            # PART 2C: Handle stored secret injection at runtime
            await self._inject_secret(action)

        elif action_type == "handle_popup":
            dismissed = await self.handle_popups_and_banners()
            if not dismissed:
                logger.info("No popups found to handle")

        else:
            logger.warning(f"Unknown action type: {action_type}")

    async def _inject_secret(self, action: Dict[str, Any]) -> None:
        """PART 2C: Fetch secret from DB and fill credentials on page."""
        from utils.database import get_db
        from utils.crypto import decrypt_value

        secret_name = action.get("secret_name", "")
        fields = action.get("fields", ["username", "password"])
        page = self._page

        db = get_db()
        secret_doc = await db.secrets.find_one({"name": secret_name})
        if not secret_doc:
            raise ValueError(f"Secret '{secret_name}' not found")

        data = secret_doc.get("data", {})

        if "username" in fields or "email" in fields:
            username = data.get("username") or data.get("email", "")
            if username:
                # Find email/username field
                try:
                    loc = await self.smart_locator.find(page, "email or username input")
                    await loc.click()
                    await loc.fill(username)
                except Exception:
                    pass

        if "password" in fields:
            encrypted_pw = data.get("password", "")
            if encrypted_pw:
                try:
                    password = decrypt_value(encrypted_pw)
                    loc = await self.smart_locator.find(page, "password input")
                    await loc.click()
                    await loc.fill(password)
                except Exception as e:
                    raise ValueError(f"Password decrypt failed: {e}")

        # Update last_used
        await db.secrets.update_one(
            {"name": secret_name},
            {"$set": {"last_used": datetime.utcnow().isoformat() + "Z"}}
        )
        logger.info(f"[Secret injected: {secret_name}] — credentials not logged")

    async def execute_actions(
        self,
        actions: List[Dict[str, Any]],
        on_action_result: Optional[Callable] = None,
        continue_on_error: bool = False,
    ) -> List[Dict[str, Any]]:
        results = []
        for i, action in enumerate(actions):
            logger.info(f"Action {i+1}/{len(actions)}: {action.get('type')}")
            if self.on_update:
                await self.on_update("action_start", {
                    "index": i, "action": action.get("type"),
                    "selector": action.get("selector"), "url": action.get("url"),
                })
            result = await self.execute_action(action)
            result["action_index"] = i
            screenshot = await self.take_screenshot(f"step_{i+1}_{action.get('type')}")
            result["screenshot_path"] = screenshot
            results.append(result)
            if on_action_result:
                await on_action_result(i, result)
            if self.on_update:
                await self.on_update("action_complete", {
                    "index": i, "status": result["status"],
                    "duration_ms": result["duration_ms"],
                    "screenshot_url": screenshot, "error": result.get("error_message"),
                })
            if result["status"] == "failure" and not continue_on_error:
                if not action.get("optional", False):
                    break
        return results
