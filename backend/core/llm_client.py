import json
import os
from typing import Any, Dict, List, Optional
from groq import AsyncGroq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from utils.logger import get_logger

logger = get_logger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 3: New intelligent system prompt with decision-making rules
# ─────────────────────────────────────────────────────────────────────────────
COMMAND_PARSE_PROMPT = """You are an expert browser automation agent with human-level decision making.
You convert natural language commands into Playwright action sequences.

CORE INTELLIGENCE RULES:

1. SEARCH RESULTS: When a user searches for a product and multiple results appear,
   ALWAYS click the FIRST result that best matches the search term.
   Never stop at a search results page. Use this action pattern:
   {"type": "click", "selector": ".s-result-item:first-child h2 a", "fallback_selectors": [
     "[data-component-type='s-search-result']:first-child h2 a",
     ".product-title:first-child",
     "[data-testid='product-title']:first-child"
   ], "description": "Click first matching search result", "confidence": 0.85}

2. FALLBACK SELECTORS: Every click and fill action MUST include a "fallback_selectors"
   array with 3 alternative selectors. The agent will try each in order if the primary fails.

3. WAITING INTELLIGENTLY: After navigation and after clicks that load new pages,
   always add: {"type": "wait", "condition": "networkidle", "timeout": 5000}
   This waits for the page to fully settle before the next action.

4. DROPDOWNS AND DYNAMIC ELEMENTS: If an action involves a dropdown or dynamically
   loaded element, add a wait_for_selector action before interacting with it.

5. ADD TO CART PATTERN: For e-commerce add-to-cart flows, use this sequence:
   - Click product -> wait for networkidle -> check for size/variant selectors ->
     select first available variant if required -> wait -> click add-to-cart button

6. CONFIDENCE SCORING: For each action, add a "confidence" field (0.0 to 1.0)
   indicating how certain you are the selector is correct.

7. DESCRIPTION: Every action must have a "description" field explaining what it does
   in plain English. This is shown to the user in the live execution view.

8. FAKE DATA: When tasks require login/signup/form submission with user data,
   use {{FAKER:email}}, {{FAKER:name}}, {{FAKER:password}} etc as field values.
   These get replaced automatically with realistic fake data.

Supported action types:
- navigate: {"type": "navigate", "url": "https://...", "description": "...", "confidence": 0.99}
- fill: {"type": "fill", "selector": "#id", "value": "text", "fallback_selectors": [...], "description": "...", "confidence": 0.9}
- click: {"type": "click", "selector": "button", "fallback_selectors": [...], "description": "...", "confidence": 0.85}
- select: {"type": "select", "selector": "select#id", "value": "option", "description": "...", "confidence": 0.9}
- wait: {"type": "wait", "condition": "networkidle", "timeout": 5000} OR {"type": "wait", "ms": 2000}
- wait_for_selector: {"type": "wait", "selector": ".element", "description": "Wait for element"}
- screenshot: {"type": "screenshot", "filename": "name", "description": "Capture current state"}
- press: {"type": "press", "key": "Enter", "description": "Submit form"}
- hover: {"type": "hover", "selector": ".menu", "description": "...", "confidence": 0.8}
- scroll: {"type": "scroll", "direction": "down", "description": "Scroll page"}
- assert: {"type": "assert", "selector": ".success", "text": "expected", "description": "Verify result", "confidence": 0.9}
- upload: {"type": "upload", "selector": "input[type='file']", "value": "/path", "description": "..."}

Common selectors for popular sites:
- Amazon search box: #twotabsearchtextbox, fallback: input[name='field-keywords'], [data-testid='search-box']
- Amazon search button: #nav-search-submit-button, fallback: input[type='submit'][value='Go']
- Amazon first result: .s-result-item:first-child h2 a, fallback: [data-component-type='s-search-result']:first-child h2 a
- Amazon add to cart: #add-to-cart-button, fallback: [id*='add-to-cart'], input[value*='Add to Cart']
- Google search: input[name='q'], fallback: textarea[name='q'], #APjFqb
- Google search button: input[name='btnK'], fallback: [role='button'][jsname='LgbsSe']
- Flipkart search: input[name='q'], fallback: .search-bar__input

Return a JSON object with this EXACT structure:
{
  "actions": [...list of action objects...],
  "goal_summary": "one sentence describing what this automation will do",
  "estimated_steps": number,
  "site_detected": "amazon|flipkart|google|generic",
  "complexity": "simple|medium|complex"
}
"""

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2: Enhanced ERROR_ANALYSIS_PROMPT with deep contextual RCA
# ─────────────────────────────────────────────────────────────────────────────
ERROR_ANALYSIS_PROMPT = """You are an expert QA engineer and browser automation specialist with deep debugging experience.

**YOUR MISSION:** Perform a thorough root cause analysis (RCA) of this execution failure. Go beyond surface-level symptoms to identify the ACTUAL underlying cause.

**ANALYSIS FRAMEWORK:**

1. **ROOT CAUSE IDENTIFICATION:**
   - Don't just repeat the error message - explain WHY it happened
   - Consider: Was the selector wrong? Did the page structure change? Timing issue? Network failure?
   - Example: Instead of "Element not found", say "The product title selector '.product-name' no longer exists because Amazon redesigned their search results page to use '.puis-title' instead"

2. **CONTEXTUAL INVESTIGATION:**
   - Analyze the action sequence: What actions led up to this failure?
   - Check timing: Did we wait for the page to load? Did AJAX content finish loading?
   - Network context: Were there API failures? Slow responses? CORS errors?
   - Page state: Was there a popup blocking the element? Overlay? Modal?

3. **ACTIONABLE FIX:**
   - Provide SPECIFIC, implementable solutions
   - Include exact selector updates, wait times, or sequence changes
   - Example: "Add a 'wait for networkidle' after the search click, then update selector to '.puis-title .a-text-normal'"

4. **IMPACT ASSESSMENT:**
   - Critical: Complete execution blocker, no workaround possible
   - High: Major feature broken, requires immediate fix
   - Medium: Degraded functionality, workaround available
   - Low: Minor issue, doesn't block core flow

**RETURN JSON with these EXACT fields:**
{
  "root_cause": "Deep technical explanation of WHY the failure occurred (2-3 sentences)",
  "affected_component": "Specific page element, API endpoint, or system component that failed",
  "suggested_fix": "Exact, actionable steps to fix this issue (be specific with selectors, timing, etc)",
  "impact_level": "Critical|High|Medium|Low",
  "confidence": 0.85,
  "error_type": "network|selector|timeout|assertion|javascript|authentication|unknown",
  "raw_error": "The original raw error message",
  "full_analysis": "Comprehensive 4-5 sentence technical breakdown covering: what failed, why it failed, what was expected vs actual, and environmental factors",
  "similar_errors": ["List of related errors that might have the same root cause"],
  "prevention_tips": "How to prevent this error in future executions"
}

**EXAMPLES OF GOOD vs BAD ANALYSIS:**

❌ BAD: "Element not found. Try using a different selector."
✅ GOOD: "The checkout button selector '#checkout-btn' failed because Shopify's dynamic cart uses client-side rendering that takes 2-3 seconds to inject the button. The element exists in the DOM but wasn't yet rendered when we tried to click. Add a 'wait for selector' with timeout 5000ms before clicking."

❌ BAD: "Network error occurred."
✅ GOOD: "POST request to /api/cart failed with 503 Service Unavailable. The backend API is experiencing high load (>2s response times in previous requests). This is a transient infrastructure issue. Recommended: Implement retry logic with exponential backoff (3 attempts, 2s/4s/8s delays)."

**ANALYZE WITH INTELLIGENCE:** Use the provided context (error message, action timeline, network logs, console errors) to build a complete picture of what went wrong and how to fix it.
"""

SUMMARY_PROMPT = """You are a QA report writer. Generate a concise 2-3 sentence summary of this test execution.
Focus on: what was tested, the outcome, and any notable issues or successes.
Be specific, factual, and professional.
Return just the summary text (no JSON, no markdown).
"""

# FIX 3: Prompt for refining a failed action
REFINE_ACTION_PROMPT = """This Playwright action failed. Here is the error, the page HTML, and the page URL.
Find the correct selector and return a fixed action JSON.
Do not explain, return only the corrected action JSON as a single JSON object.

The corrected action must:
1. Use a valid CSS selector found in the provided HTML
2. Include "fallback_selectors" with 2-3 alternatives
3. Keep all other fields from the original action
4. Add "was_refined": true to the response
"""


class LLMClient:
    def __init__(self):
        api_key = os.environ.get("GROQ_API_KEY", "")
        self.model = os.environ.get("LLM_MODEL", "llama-3.3-70b-versatile")
        self.client = AsyncGroq(api_key=api_key)
        logger.info(f"LLM Client initialized with model: {self.model}")

    @retry(
        retry=retry_if_exception_type(Exception),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def expand_command_with_implicit_steps(self, command: str) -> str:
        """
        PART 1B: Pre-processing step that expands a high-level command into a
        detailed step list with all implicit actions added.
        """
        try:
            logger.info(f"Expanding command with implicit steps: {command[:60]}...")
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": IMPLICIT_STEPS_PROMPT},
                    {"role": "user", "content": f"Expand this command: {command}"},
                ],
                temperature=0.2,
                max_tokens=1024,
            )
            expanded = response.choices[0].message.content.strip()
            logger.info(f"Expanded to {len(expanded.splitlines())} steps")
            return expanded
        except Exception as e:
            logger.error(f"Command expansion failed: {e}")
            return command  # Fall back to original command

    async def parse_command_to_actions(self, command: str, available_secrets: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Convert natural language command to list of Playwright actions with full metadata."""
        try:
            # PART 1B: Expand command with implicit steps first
            expanded_command = await self.expand_command_with_implicit_steps(command)

            # PART 2C: Build secrets hint for prompt
            secrets_hint = ""
            if available_secrets:
                secrets_list = "\n".join(f"  - {s}" for s in available_secrets)
                secrets_hint = f"""
STORED CREDENTIALS AVAILABLE:
{secrets_list}

If the command mentions logging in or references a site matching stored credentials,
inject a use_secret action: {{"type": "use_secret", "secret_name": "Secret Name", "description": "Use stored credentials", "fields": ["username", "password"]}}
"""

            logger.info(f"Parsing expanded command ({len(expanded_command.splitlines())} steps)...")
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": COMMAND_PARSE_PROMPT + secrets_hint},
                    {"role": "user", "content": f"Original command: {command}\n\nExpanded steps:\n{expanded_command}"},
                ],
                temperature=0.1,
                max_tokens=4000,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            data = json.loads(content)

            actions = data.get("actions", [])

            for action in actions:
                if "confidence" not in action:
                    action["confidence"] = 0.8
                if "description" not in action:
                    action["description"] = f"{action.get('type', 'action')} on {action.get('selector', action.get('url', ''))}"
                if "fallback_selectors" not in action and action.get("type") in ("click", "fill", "assert", "hover"):
                    action["fallback_selectors"] = []

            goal = data.get("goal_summary", "")
            site = data.get("site_detected", "generic")
            complexity = data.get("complexity", "medium")
            if goal:
                logger.info(f"Goal: {goal} | Site: {site} | Complexity: {complexity}")
            logger.info(f"Parsed {len(actions)} actions")
            return actions
        except Exception as e:
            logger.error(f"Command parse failed: {e}")
            raise

    async def analyze_error(self, error_context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze an execution error and return comprehensive AI diagnosis with deep RCA."""
        try:
            context_str = json.dumps(error_context, indent=2)[:6000]  # Increased for more context
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": ERROR_ANALYSIS_PROMPT},
                    {"role": "user", "content": f"Analyze this failure:\n{context_str}"},
                ],
                temperature=0.3,  # Slightly higher for creative RCA
                max_tokens=1500,  # More tokens for comprehensive analysis
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            result = json.loads(content)

            # Ensure all required fields are present with correct structure
            raw_error = error_context.get("error_message", "")
            normalized = {
                "root_cause": result.get("root_cause", "Unknown failure"),
                "affected_component": result.get("affected_component", "Unknown component"),
                "suggested_fix": result.get("suggested_fix", "Check server logs for details"),
                "impact_level": result.get("impact_level", "High"),
                "confidence": float(result.get("confidence", 0.5)),
                "error_type": result.get("error_type", "unknown"),
                "raw_error": result.get("raw_error", str(raw_error)),
                "full_analysis": result.get("full_analysis", result.get("root_cause", "")),
                "similar_errors": result.get("similar_errors", []),
                "prevention_tips": result.get("prevention_tips", ""),
            }
            logger.info(f"Deep RCA completed: {normalized.get('error_type')} | impact={normalized['impact_level']} | confidence={normalized['confidence']}")
            return normalized
        except Exception as e:
            logger.error(f"Error analysis failed: {e}")
            raw_err = error_context.get("error_message", str(e))
            return {
                "root_cause": f"Automated analysis unavailable. Raw error: {raw_err}",
                "affected_component": "Unknown",
                "suggested_fix": "Check execution logs and retry with modified selectors",
                "impact_level": "High",
                "confidence": 0.0,
                "error_type": "unknown",
                "raw_error": str(raw_err),
                "full_analysis": f"AI analysis failed due to: {e}. Manual investigation required for error: {raw_err}",
                "similar_errors": [],
                "prevention_tips": "Enable debug logging and capture page state before failure",
            }

    async def refine_action_on_failure(
        self,
        failed_action: Dict[str, Any],
        error_message: str,
        page_html: str,
        page_url: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        FIX 3: When an action fails, ask the LLM to find the correct selector
        from the actual page HTML and return a fixed action.
        """
        try:
            # Truncate HTML to first 8000 chars
            html_snippet = page_html[:8000] if page_html else ""

            context_info = ""
            if context:
                completed = context.get("completed_actions", [])
                context_info = f"\nCompleted steps so far: {len(completed)}\n"
                context_info += f"Goal: {context.get('goal', 'unknown')}\n"
                context_info += f"Site: {context.get('site_context', 'generic')}\n"

            prompt = f"""Failed action:
{json.dumps(failed_action, indent=2)}

Error message: {error_message}

Page URL: {page_url}
{context_info}
Page HTML (first 8000 chars):
{html_snippet}

Find the correct CSS selector in this HTML and return the fixed action JSON only."""

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": REFINE_ACTION_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=512,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            refined = json.loads(content)

            # Merge with original action (keep type, add new selector)
            result = {**failed_action, **refined, "was_refined": True}
            logger.info(f"Action refined: {failed_action.get('type')} -> selector: {refined.get('selector', 'unknown')}")
            return result
        except Exception as e:
            logger.error(f"Action refinement failed: {e}")
            return None

    async def generate_summary(self, execution_data: Dict[str, Any]) -> str:
        """Generate a natural language summary of an execution."""
        try:
            exec_str = json.dumps({
                "status": execution_data.get("status"),
                "command": execution_data.get("command"),
                "duration_seconds": execution_data.get("duration_seconds"),
                "total_actions": execution_data.get("total_actions"),
                "successful_actions": execution_data.get("successful_actions"),
                "failed_actions": execution_data.get("failed_actions"),
                "network_requests": len(execution_data.get("network_logs", [])),
                "network_errors": sum(1 for r in execution_data.get("network_logs", []) if r.get("is_error")),
                "error_message": execution_data.get("error_message"),
                "goal": execution_data.get("goal", ""),
            }, indent=2)

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SUMMARY_PROMPT},
                    {"role": "user", "content": f"Execution data:\n{exec_str}"},
                ],
                temperature=0.3,
                max_tokens=256,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Summary generation failed: {e}")
            return f"Execution {'completed successfully' if execution_data.get('status') == 'SUCCESS' else 'failed'} in {execution_data.get('duration_seconds', 0):.1f}s."


# ─────────────────────────────────────────────────────────────────────────────
# PART 1B: Implicit Step Inference
# ─────────────────────────────────────────────────────────────────────────────
IMPLICIT_STEPS_PROMPT = """You are a browser automation expert. A user has given a high-level command.
Your job is to expand it into a complete, unambiguous step list by adding all the implicit steps a human would naturally do.

IMPLICIT STEP RULES:
1. After typing in a search box → always add "press Enter or click the search button"
2. After navigating to a page → always add "wait for the page to fully load"
3. Before clicking a button that may be below the fold → add "scroll to make it visible"
4. After clicking a product in search results → add "wait for product page to load"
5. Before filling a form field → add "click the field to focus it"
6. After clicking Add to Cart → add "wait for cart confirmation"
7. If a login wall might appear → add "check if login is required, if so use stored credentials"
8. For dropdown/select elements → add "wait for options to appear before selecting"
9. If a popup or modal might block the action → add "close any popup or cookie banner first"
10. After any action that loads new content → add "wait for network to be idle"
11. For product searches → add "click on the first relevant search result"
12. For multi-step forms → add "wait for each step to load before proceeding"

Return the expanded step list as a clean numbered list. Be thorough but not redundant.
Keep the user's original intent exactly. Do not change what they asked for.
Return ONLY the numbered list, no extra text."""


_llm_client: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client
