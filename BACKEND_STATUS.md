# NPM (Neural Precision Monitor) - Backend Status

## Overview
AI-powered browser automation and QA testing platform. The backend provides:
- Natural language to Playwright action conversion via Groq LLM (Llama 3.3 70B)
- Real-time browser execution with WebSocket streaming
- Network request interception and logging
- Persistent blueprint management (MongoDB)
- AI-powered error analysis and execution summaries

---

## Completed (Phases 1-4)

### Phase 1 - Core Infrastructure
- FastAPI application with lifespan management (`server.py`)
- MongoDB async driver (motor) with connection pooling (`utils/database.py`)
- Structured logging (`utils/logger.py`)
- Helper utilities: ID generation, timestamps, sanitization (`utils/helpers.py`)
- CORS middleware configured for all origins
- Environment-based configuration (`.env`)

### Phase 2 - Browser Automation Engine
- **Playwright BrowserAgent** (`core/agent.py`):
  - Chromium launch with configurable headless/headed mode
  - Action execution with retry logic (exponential backoff, max 3 retries)
  - Screenshot capture after every action step
  - Supported actions: `navigate`, `fill`, `click`, `select`, `wait`, `screenshot`, `press`, `hover`, `scroll`, `assert`, `upload`, `iframe`
  - Faker data generation for `{{FAKER:type}}` placeholders
- **Network Interceptor** (`core/interceptor.py`):
  - Captures all HTTP requests/responses during execution
  - Records URL, method, status, content-type, duration, size
  - Flags error responses (4xx/5xx)

### Phase 3 - AI Integration (Groq / Llama 3.3)
- **LLM Client** (`core/llm_client.py`):
  - `parse_command_to_actions()` — Converts natural language commands to structured Playwright action arrays (JSON mode)
  - `analyze_error()` — AI diagnosis of execution failures with root cause, fix suggestions, confidence score
  - `generate_summary()` — Natural language execution summaries
  - Retry logic with tenacity (3 attempts, exponential backoff)

### Phase 4 - API Layer & Real-time Updates
- **Execution API** (`api/execute.py`):
  - `POST /api/execute` — Run natural language command
  - `POST /api/execute/blueprint` — Run a saved blueprint with variable injection
  - `GET /api/execute/{id}/status` — Poll execution progress
  - `POST /api/execute/{id}/cancel` — Cancel running execution
- **Blueprint API** (`api/blueprints.py`):
  - Full CRUD: `GET/POST /api/blueprints`, `GET/PUT/DELETE /api/blueprints/{id}`
  - `POST /api/blueprints/{id}/duplicate` — Clone a blueprint
  - `POST /api/blueprints/{id}/inject` — Preview variable substitution
  - `GET /api/blueprints/{id}/executions` — Execution history for a blueprint
  - Search, tag filtering, pagination, sorting
- **Reports API** (`api/reports.py`):
  - `GET /api/reports` — List executions with filtering
  - `GET /api/reports/{id}` — Full execution detail
  - `DELETE /api/reports/{id}` — Remove execution record
  - `GET /api/reports/stats` — Aggregate statistics (success rate, top blueprints, recent errors)
  - `GET /api/reports/{id}/export?format=json|html` — Export reports
- **Network API** (`api/network.py`):
  - `GET /api/network/{execution_id}` — Network logs for an execution
- **WebSocket** (`api/websocket.py`):
  - `WS /ws/execution/{execution_id}` — Real-time action progress streaming
- **Orchestrator** (`core/orchestrator.py`):
  - Coordinates LLM parsing, browser execution, network capture, and DB persistence
  - Writes execution results to MongoDB with full action timeline
- **Static Files**:
  - `GET /api/screenshots/{filename}` — Serve captured screenshots
- **Health Check**:
  - `GET /api/health` — Database connectivity + LLM config status

### Database Collections (MongoDB)
| Collection | Key Fields |
|---|---|
| `blueprints` | blueprint_id, name, description, version, actions[], variables[], metadata (tags, success_rate, usage_count) |
| `executions` | execution_id, status, command, blueprint_id, action_timeline[], network_logs[], ai_analysis, ai_summary, performance |
| `network_logs` | execution_id, requests[] |

### Seed Data
- 3 sample blueprints auto-seeded on startup (`core/blueprint.py`): Login Flow, Search Products, Form Validation

---

## Remaining / Future Work

### Authentication (Not Implemented)
- Frontend uses mock auth (any email/password accepted via `AuthContext.tsx`)
- No backend auth endpoints exist yet
- **Needed**: User model, `/api/auth/login`, `/api/auth/register`, JWT middleware, role-based access

### Scheduling & Cron
- No scheduled/recurring execution support
- **Needed**: Blueprint scheduling (cron expressions), execution queue with worker

### Team Collaboration
- No multi-user or workspace support
- **Needed**: User workspaces, shared blueprints, execution permissions

### CI/CD Integration
- No webhook or pipeline trigger support
- **Needed**: Webhook endpoints for GitHub/GitLab, CLI tool for CI pipelines

### Advanced Reporting
- Basic stats endpoint exists but no trend analysis
- **Needed**: Time-series charts data, flaky test detection, performance regression alerts

### File Management
- Screenshots stored locally on disk
- **Needed**: Cloud storage (S3) for screenshots and uploaded files in production
