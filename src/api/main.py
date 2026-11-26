from contextlib import asynccontextmanager
import os
from pathlib import Path

import asyncio

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from src.api.routers import (
    chat,
    config,
    feedback,
    interview,
    job_suggest,
    jobs,
    knowledge,
    resume_writer,
    settings,
    system,
)
from src.api.auth_deps import require_admin, require_admin_for_writes, require_user, require_visitor
from src.api.user_middleware import UserContextMiddleware
from src.logging import get_logger
from src.services.user_context import user_data_dir

# Note: Don't set service_prefix here - start_web.py already adds [Backend] prefix
logger = get_logger("API")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle management
    Gracefully handle startup and shutdown events, avoid CancelledError
    """
    # Execute on startup
    logger.info("Application startup")

    # One-time move of pre-per-user shared data into the first admin's account
    # (no-op unless MIGRATE_LEGACY_DATA=1; idempotent)
    try:
        from src.services.data_migration import migrate_legacy_data

        await asyncio.to_thread(migrate_legacy_data)
    except Exception:
        logger.exception("Legacy data migration failed; continuing startup")

    # Initialize LLM client early to set environment variables for LightRAG
    # LightRAG reads OPENAI_API_KEY from os.environ internally, so we must
    # set it before any RAG operations can happen
    try:
        from src.services.llm import get_llm_client

        llm_client = get_llm_client()
        logger.info(f"LLM client initialized: model={llm_client.config.model}")
    except Exception as e:
        logger.warning(f"Failed to initialize LLM client at startup: {e}")

    # Delete guest data (signed-out visitors' CVs and chats) nobody has used
    # for a week, now and every 6 hours.
    async def clean_guest_data_periodically():
        from src.services.guest_data import cleanup_stale_guest_data

        while True:
            try:
                await asyncio.to_thread(cleanup_stale_guest_data)
            except Exception:
                logger.exception("Guest data cleanup failed")
            await asyncio.sleep(6 * 3600)

    guest_cleanup = asyncio.create_task(clean_guest_data_periodically())

    yield
    # Execute on shutdown
    guest_cleanup.cancel()
    logger.info("Application shutdown")


app = FastAPI(
    title="NovusOrbit API",
    version="1.0.0",
    lifespan=lifespan,
    # Disable automatic trailing slash redirects to prevent protocol downgrade issues
    # when deployed behind HTTPS reverse proxies (e.g., nginx).
    # Without this, FastAPI's 307 redirects may change HTTPS to HTTP.
    # See: https://github.com/NovusOrbit/NovusOrbit/issues/112
    redirect_slashes=False,
)

# Configure CORS
# Production serves the frontend and API from one origin (Caddy), so CORS only
# matters in local development, where the frontend (:3782) calls the backend
# (:8001) with the session cookie. Browsers reject "*" for credentialed
# requests, so allow localhost origins explicitly, plus any listed in
# CORS_ALLOW_ORIGINS (comma-separated).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "").split(",") if o.strip()],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

project_root = Path(__file__).parent.parent.parent
user_dir = project_root / "data" / "user"

# Initialize user directories on startup
try:
    from src.services.setup import init_user_directories

    init_user_directories(project_root)
except Exception:
    # Fallback: just create the main directory if it doesn't exist
    if not user_dir.exists():
        user_dir.mkdir(parents=True)

# Identify the signed-in user (NextAuth session cookie) for per-user data.
# The middleware never rejects requests; access rules are router dependencies.
app.add_middleware(UserContextMiddleware)


@app.get("/api/outputs/{file_path:path}", include_in_schema=False, dependencies=[Depends(require_user)])
async def get_output_file(file_path: str):
    """
    Serve generated files (e.g. narration audio) from the current user's data
    directory: /api/outputs/<path> -> data/user/accounts/<uid>/<path>.
    """
    base = user_data_dir().resolve()
    target = (base / file_path).resolve()
    if not target.is_relative_to(base) or not target.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(target)

# Include routers
# Access rules (src/api/auth_deps.py): guests may upload one CV and chat;
# every other tool needs an account; site-wide settings and model
# configuration can only be changed by an admin.
signed_in = [Depends(require_user)]
guests_welcome = [Depends(require_visitor)]
app.include_router(chat.router, prefix="/api/v1", tags=["chat"], dependencies=guests_welcome)
app.include_router(knowledge.router, prefix="/api/v1/portfolio", tags=["portfolio"], dependencies=guests_welcome)
app.include_router(resume_writer.router, prefix="/api/v1/resume_writer", tags=["resume_writer"], dependencies=signed_in)
app.include_router(jobs.router, prefix="/api/v1/jobs", tags=["jobs"], dependencies=signed_in)
app.include_router(interview.router, prefix="/api/v1/interview", tags=["interview"], dependencies=signed_in)
app.include_router(job_suggest.router, prefix="/api/v1/job-suggest", tags=["job-suggest"], dependencies=signed_in)
app.include_router(
    settings.router, prefix="/api/v1/settings", tags=["settings"], dependencies=[Depends(require_admin_for_writes)]
)
app.include_router(
    system.router, prefix="/api/v1/system", tags=["system"], dependencies=[Depends(require_admin_for_writes)]
)
app.include_router(config.router, prefix="/api/v1/config", tags=["config"], dependencies=[Depends(require_admin)])
app.include_router(feedback.router, prefix="/api", tags=["feedback"])


@app.get("/")
async def root():
    return {"message": "Welcome to NovusOrbit API"}


if __name__ == "__main__":
    from pathlib import Path

    import uvicorn

    # Get project root directory
    project_root = Path(__file__).parent.parent.parent

    # Ensure project root is in Python path
    import sys

    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    # Get port from configuration
    from src.services.setup import get_backend_port

    backend_port = get_backend_port(project_root)

    # Configure reload_excludes with absolute paths to properly exclude directories
    venv_dir = project_root / "venv"
    data_dir = project_root / "data"
    reload_excludes = [
        str(d)
        for d in [
            venv_dir,
            project_root / ".venv",
            data_dir,
            project_root / "web" / "node_modules",
            project_root / "web" / ".next",
            project_root / ".git",
        ]
        if d.exists()
    ]

    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=backend_port,
        reload=True,
        reload_excludes=reload_excludes,
    )
