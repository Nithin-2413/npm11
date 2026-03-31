# NPM (Neural Precision Monitor) - Product Requirements

## Overview
AI-powered browser automation and QA testing platform. Users enter natural language commands that are converted to Playwright actions via Groq LLM (Llama 3.3 70B). Features real-time WebSocket execution streaming, visual blueprint editor, network monitoring, and AI-powered error analysis.

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS (Glassmorphic dark theme)
- **Backend**: Python FastAPI + MongoDB (motor async) + Playwright
- **AI**: Groq API (Llama 3.3 70B Versatile) for NLP-to-action parsing
- **Auth**: Mock (any credentials accepted) — real JWT pending

## Core Architecture
```
Frontend (React/Vite :3000) → Vite Proxy → Backend (FastAPI :8001) → MongoDB
                             ↕ WebSocket
                             → Playwright (Chromium)
                             → Groq LLM API
```

## What's Implemented
- Full CRUD Blueprint API with visual ReactFlow editor connected to backend
- Natural language → Playwright action execution with WebSocket live streaming
- Network request interception and logging
- AI error analysis and execution summaries
- Dashboard with execution stats
- Reports with export (JSON/HTML)
- Browser commands: navigate, fill, click, select, wait, screenshot, press, hover, scroll, assert, upload, iframe
- Seed blueprints (Login Flow, Signup Flow, Search, Google Search, Form Validation)

## What's Remaining
- **P2**: Real JWT authentication (currently mock)
- **Future**: Scheduled/cron executions, team collaboration, CI/CD webhooks, cloud storage for screenshots, advanced analytics

## Key Fixes Applied
- 2026-03-31: Fixed Vite `allowedHosts` blocking preview access
- 2026-03-31: Fixed WebSocket `ws://` → `wss://` protocol mismatch on HTTPS
- 2026-03-31: Added `envPrefix: ["VITE_", "REACT_APP_"]` to vite.config.ts
- 2026-03-31: Connected BlueprintEditor to API (create/edit/view modes)
- 2026-03-31: Fixed Blueprints routing (/blueprints/create, /blueprints/{id}/edit)
- 2026-03-31: Added file upload and iframe browser commands
- 2026-03-31: Created BACKEND_STATUS.md documentation
- 2026-03-31: Fixed backend auto-reload killing running tests — added --reload-exclude for screenshots/, uploads/, tests/, *.png, *.jpg, *.log
