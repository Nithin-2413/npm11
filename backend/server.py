import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR))

from dotenv import load_dotenv
load_dotenv(ROOT_DIR / ".env")

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from utils.database import connect_db, close_db
from utils.logger import get_logger
from core.blueprint import seed_blueprints
from core.scheduler import start_scheduler, stop_scheduler

from api.execute import router as execute_router
from api.websocket import router as ws_router
from api.blueprints import router as blueprints_router
from api.reports import router as reports_router
from api.network import router as network_router
from api.secrets import router as secrets_router
from api.schedules import router as schedules_router
from api.workspaces import router as workspaces_router
from api.webhooks import router as webhooks_router
from api.analytics import router as analytics_router

logger = get_logger("server")

SCREENSHOT_DIR = Path(os.environ.get("SCREENSHOT_DIR", "./screenshots"))
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


async def _ensure_db_indexes():
    """Create indexes for efficient queries on all collections."""
    from utils.database import get_db
    db = get_db()
    try:
        await db.executions.create_index("execution_id", unique=True)
        await db.executions.create_index("timestamp")
        await db.executions.create_index("blueprint_id")
        await db.executions.create_index("status")
        await db.blueprints.create_index("blueprint_id", unique=True)
        await db.blueprints.create_index("metadata.tags")
        await db.secrets.create_index("secret_id", unique=True)
        await db.secrets.create_index("name")
        await db.secrets.create_index("domain")
        await db.schedules.create_index("schedule_id", unique=True)
        await db.schedules.create_index("blueprint_id")
        await db.schedules.create_index("is_active")
        await db.workspaces.create_index("workspace_id", unique=True)
        await db.webhooks.create_index("webhook_id", unique=True)
        await db.network_logs.create_index("execution_id")
        logger.info("Database indexes created")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("  NPM Backend - Neural Precision Monitor v2.0")
    logger.info("=" * 60)
    await connect_db()
    await _ensure_db_indexes()
    await seed_blueprints()

    # Install Playwright browsers if needed
    try:
        import subprocess
        result = subprocess.run(
            ["python", "-m", "playwright", "install", "chromium"],
            capture_output=True, text=True, cwd=str(ROOT_DIR)
        )
        if result.returncode == 0:
            logger.info("Playwright Chromium ready")
        else:
            logger.warning(f"Playwright install warning: {result.stderr[:200]}")
    except Exception as e:
        logger.warning(f"Playwright setup: {e}")

    # Start APScheduler (PART 3)
    try:
        await start_scheduler()
        logger.info("Scheduler started")
    except Exception as e:
        logger.warning(f"Scheduler start failed (non-critical): {e}")

    logger.info("NPM Backend v2.0 ready!")
    yield

    await stop_scheduler()
    await close_db()
    logger.info("NPM Backend shutdown complete")


app = FastAPI(
    title="NPM - Neural Precision Monitor",
    description="AI-powered browser automation and QA testing platform",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS - Critical for external frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# OPTIONS handler MUST come before routers
@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    """Handle CORS preflight OPTIONS requests for all paths."""
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
        },
    )

# All routers
app.include_router(execute_router)
app.include_router(ws_router)
app.include_router(blueprints_router)
app.include_router(reports_router)
app.include_router(network_router)
app.include_router(secrets_router)
app.include_router(schedules_router)
app.include_router(workspaces_router)
app.include_router(webhooks_router)
app.include_router(analytics_router)

# Serve screenshots
app.mount(
    "/api/screenshots",
    StaticFiles(directory=str(SCREENSHOT_DIR), check_dir=False),
    name="screenshots",
)


@app.get("/")
async def root():
    return {
        "service": "NPM Backend",
        "version": "2.0.0",
        "status": "operational",
        "docs": "/api/docs",
        "features": ["execution", "blueprints", "reports", "secrets", "schedules", "workspaces", "webhooks", "analytics"],
    }


@app.get("/api/health")
async def health():
    from utils.database import get_db
    try:
        db = get_db()
        await db.command("ping")
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"

    from core.scheduler import get_scheduler
    sched = get_scheduler()

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "llm_model": os.environ.get("LLM_MODEL", "llama-3.3-70b-versatile"),
        "groq_configured": bool(os.environ.get("GROQ_API_KEY")),
        "scheduler_running": bool(sched and sched.running),
        "version": "2.0.0",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", 8001)),
        reload=bool(os.environ.get("DEBUG", "true").lower() == "true"),
        log_level="info",
    )
