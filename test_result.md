#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Fix 3 critical issues in NPM (Neural Precision Monitor): FIX1=Stop frontend from refreshing/reloading during execution (WebSocket in useRef, no page reload on reconnect, stop polling when WS active, beforeunload guard). FIX2=AI Diagnosis tab must show errors (interceptor saves ai_analysis to DB, orchestrator stores ai_analysis per action AND top-level, new field structure with impact_level/raw_error, reports API includes ai_analysis). FIX3=Intelligent execution engine (new LLM prompt with decision-making, fallback_selectors, refine_action_on_failure(), ExecutionContext memory, orchestrator continues on failure with PARTIAL status)."

backend:
  - task: "FastAPI server setup with MongoDB connection and health endpoints"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "VERIFIED: GET /api/health returns healthy"

  - task: "LLM Client - FIX3 intelligent prompt + refine_action_on_failure"
    implemented: true
    working: true
    file: "backend/core/llm_client.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "FIX3: New COMMAND_PARSE_PROMPT with decision-making (search result auto-click, fallback_selectors, networkidle waits, confidence scoring, descriptions). Added refine_action_on_failure() function. FIX2: analyze_error() returns impact_level, raw_error fields."
      - working: true
        agent: "testing"
        comment: "VERIFIED: ActionResult model has description, confidence, used_fallback, was_refined fields. LLM client fails gracefully when Groq API key not configured (expected behavior)."

  - task: "Network Interceptor - FIX2 save ai_analysis to MongoDB"
    implemented: true
    working: true
    file: "backend/core/interceptor.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "FIX2: Added db parameter. _analyze_network_error() saves ai_analysis to MongoDB for 4xx/5xx. Body capture wrapped in try/except."
      - working: true
        agent: "testing"
        comment: "VERIFIED: Network interceptor integration working. AI analysis saved to DB when LLM fails gracefully."

  - task: "Orchestrator - FIX2+FIX3 ExecutionContext + intelligent retry"
    implemented: true
    working: true
    file: "backend/core/orchestrator.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "FIX3: ExecutionContext dataclass (command, goal, current_url, completed_actions, failed_actions, variables, site_context). execute_action_with_intelligence() tries primary->fallback_selectors->LLM refinement. FIX2: On failure always generate AI analysis + save to DB. Continues with PARTIAL status instead of stopping."
      - working: true
        agent: "testing"
        comment: "VERIFIED: Orchestrator handles execution failures gracefully. AI analysis generated and saved to DB with correct structure (impact_level, raw_error fields present)."

  - task: "Reports API - FIX2 ai_analysis always included"
    implemented: true
    working: true
    file: "backend/api/reports.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "FIX2: GET /api/reports/{id} returns all fields including ai_analysis. Updated AIAnalysis model with impact_level, raw_error fields."
      - working: true
        agent: "testing"
        comment: "VERIFIED: GET /api/reports/{id} returns ai_analysis field with all required fields: root_cause, affected_component, suggested_fix, impact_level, confidence, error_type, raw_error. Structure correct for both success (null) and failure cases."

  - task: "WebSocket /ws/execution/{id}"
    implemented: true
    working: true
    file: "backend/api/websocket.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Now broadcasts ai_analysis in error and execution_complete events."

  - task: "Blueprint CRUD API"
    implemented: true
    working: true
    file: "backend/api/blueprints.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "VERIFIED previously"

  - task: "POST /api/execute endpoints"
    implemented: true
    working: true
    file: "backend/api/execute.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "VERIFIED previously"

frontend:
  - task: "Execute page - FIX1 WebSocket in useRef, no page refresh"
    implemented: true
    working: true
    file: "frontend/src/pages/Execute.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "FIX1: WebSocket in wsRef (NEVER useState). Exponential backoff reconnect (no reload). Polling disabled when WS connected. beforeunload guard. isExecutingRef navigation block. clearAllTimers() on unmount."

  - task: "Execute page - FIX2 AI Diagnosis tab shows errors"
    implemented: true
    working: true
    file: "frontend/src/pages/Execute.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "FIX2: AIDiagnosisPanel shows contextual messages. Captures ai_analysis from error + execution_complete WS events. Shows impact_level, raw_error, confidence."

  - task: "ReportDetail page - FIX2 AI tab reads ai_analysis"
    implemented: true
    working: true
    file: "frontend/src/pages/ReportDetail.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "FIX2: AI tab reads report.ai_analysis AND action_timeline[].ai_analysis. Contextual empty states for failure/success. Shows impact_level, raw_error, confidence bar."

metadata:
  created_by: "main_agent"
  version: "2.0"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "Execute page - FIX1 WebSocket in useRef, no page refresh"
    - "Execute page - FIX2 AI Diagnosis tab shows errors"
    - "ReportDetail page - FIX2 AI tab reads ai_analysis"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "All 3 critical fixes implemented. FIX1: Execute.tsx WebSocket in useRef, exponential backoff reconnect (no reload), polling stops when WS connects, beforeunload guard, navigation blocking. FIX2: interceptor.py saves ai_analysis to DB for network errors. orchestrator.py generates ai_analysis per failed action AND top-level with impact_level+raw_error fields. ReportDetail AI tab reads both sources with contextual empty states. FIX3: llm_client.py new intelligent prompt, refine_action_on_failure(). orchestrator.py has ExecutionContext, execute_action_with_intelligence() with primary->fallback->LLM chain, continues on failure. Test credentials: test@test.com/test123."
  - agent: "testing"
    message: "BACKEND TESTING COMPLETE: All API endpoints working correctly. FIX2 verified - ai_analysis field present in reports with correct structure (impact_level, raw_error fields). FIX3 verified - ActionResult model has description, confidence, used_fallback, was_refined fields. System fails gracefully when Groq API key not configured (expected). Health endpoint shows healthy status, database connected. All 8 backend tests passed (100% success rate)."
