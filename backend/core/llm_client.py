import json
import os
from typing import Any, Dict, List, Optional
from groq import AsyncGroq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from utils.logger import get_logger

logger = get_logger(__name__)

COMMAND_PARSE_PROMPT = """You are an expert browser automation AI. Convert the user's natural language command into a JSON array of Playwright actions.

Supported action types:
- navigate: Go to a URL. Fields: {"type": "navigate", "url": "https://..."}
- fill: Type text into an input. Fields: {"type": "fill", "selector": "#id or .class", "value": "text"}
- click: Click an element. Fields: {"type": "click", "selector": "button#submit"}
- select: Choose a dropdown option. Fields: {"type": "select", "selector": "select#country", "value": "US"}
- wait: Wait for time or element. Fields: {"type": "wait", "ms": 2000} OR {"type": "wait", "selector": ".loaded"}
- screenshot: Capture screenshot. Fields: {"type": "screenshot", "filename": "optional_name"}
- press: Press a key. Fields: {"type": "press", "key": "Enter"}
- hover: Hover over element. Fields: {"type": "hover", "selector": ".menu-item"}
- scroll: Scroll page. Fields: {"type": "scroll", "selector": ".element" (optional), "direction": "down"}
- assert: Verify element exists or has text. Fields: {"type": "assert", "selector": ".success", "text": "optional expected text"}
- upload: Upload a file to a file input. Fields: {"type": "upload", "selector": "input[type='file']", "value": "/path/to/file.pdf"}
- iframe: Interact with an element inside an iframe. Fields: {"type": "iframe", "selector": "iframe#myframe", "value": "button#submit-inside", "inner_action": "click"} inner_action can be "click", "fill", or "assert". For fill, add "inner_value": "text".

Use realistic CSS selectors. For Amazon: use #twotabsearchtextbox for search, #nav-search-submit-button for search button.
For Google: use input[name='q'] for search, input[name='btnK'] for search button.

Return ONLY a JSON object with key "actions" containing the array. Example:
{"actions": [{"type": "navigate", "url": "https://amazon.com"}, {"type": "fill", "selector": "#twotabsearchtextbox", "value": "laptop"}]}
"""

ERROR_ANALYSIS_PROMPT = """You are an expert QA engineer and browser automation specialist. Analyze this execution failure and provide a detailed diagnosis.

Return a JSON object with these fields:
{
  "root_cause": "What specifically caused the failure",
  "affected_component": "Which page component or system is affected",
  "suggested_fix": "Specific actionable fix",
  "confidence": 0.85,
  "error_type": "selector_not_found|network_error|timeout|assertion_failed|javascript_error",
  "full_analysis": "Detailed multi-sentence analysis of the failure"
}
"""

SUMMARY_PROMPT = """You are a QA report writer. Generate a concise 2-3 sentence summary of this test execution.
Focus on: what was tested, the outcome, and any notable issues or successes.
Be specific, factual, and professional.
Return just the summary text (no JSON, no markdown).
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
    async def parse_command_to_actions(self, command: str) -> List[Dict[str, Any]]:
        """Convert natural language command to list of Playwright actions."""
        try:
            logger.info(f"Parsing command: {command[:80]}...")
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": COMMAND_PARSE_PROMPT},
                    {"role": "user", "content": command},
                ],
                temperature=0.1,
                max_tokens=2048,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            data = json.loads(content)
            actions = data.get("actions", [])
            logger.info(f"Parsed {len(actions)} actions")
            return actions
        except Exception as e:
            logger.error(f"Command parse failed: {e}")
            raise

    async def analyze_error(self, error_context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze an execution error and return AI diagnosis."""
        try:
            context_str = json.dumps(error_context, indent=2)[:4000]
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": ERROR_ANALYSIS_PROMPT},
                    {"role": "user", "content": f"Analyze this failure:\n{context_str}"},
                ],
                temperature=0.2,
                max_tokens=1024,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            result = json.loads(content)
            logger.info(f"Error analyzed: {result.get('error_type', 'unknown')}")
            return result
        except Exception as e:
            logger.error(f"Error analysis failed: {e}")
            return {
                "root_cause": str(e),
                "affected_component": "Unknown",
                "suggested_fix": "Check server logs for details",
                "confidence": 0.0,
                "error_type": "analysis_failed",
                "full_analysis": f"Analysis failed: {e}",
            }

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


_llm_client: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client
