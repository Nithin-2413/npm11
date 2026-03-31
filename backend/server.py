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
from api.execute import router as execute_router
from api.websocket import router as ws_router
from api.blueprints import router as blueprints_router
from api.reports import router as reports_router
from api.network import router as network_router

logger = get_logger("server")

SCREENSHOT_DIR = Path(os.environ.get("SCREENSHOT_DIR", "./screenshots"))
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("  NPM Backend - Neural Precision Monitor")
    logger.info("=" * 60)
    await connect_db()
    await seed_blueprints()

    # Install Playwright browsers if needed
    try:
        import subprocess
        # First check if chromium is already installed
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

    logger.info("NPM Backend ready!")
    yield
    await close_db()
    logger.info("NPM Backend shutdown complete")


app = FastAPI(
    title="NPM - Neural Precision Monitor",
    description="AI-powered browser automation and QA testing platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(execute_router)
app.include_router(ws_router)
app.include_router(blueprints_router)
app.include_router(reports_router)
app.include_router(network_router)

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
        "version": "1.0.0",
        "status": "operational",
        "docs": "/api/docs",
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

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "llm_model": os.environ.get("LLM_MODEL", "llama-3.3-70b-versatile"),
        "groq_configured": bool(os.environ.get("GROQ_API_KEY")),
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
