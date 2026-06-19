from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.routers import downloads, exports, files
from backend.storage.manager import StorageManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure storage (and data dirs) are initialised on startup
    StorageManager()
    yield


app = FastAPI(title="YouTube MP3/Video Editor API", lifespan=lifespan)

# CORS — wildcard origin cannot be combined with credentials per the spec.
# This app authenticates nothing, so credentials are disabled.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(downloads.router)
app.include_router(downloads.ws_router)
app.include_router(files.router)
app.include_router(exports.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve the built frontend (single-container deployment). Registered last so the
# API routers always take precedence. A catch-all keeps client-side routing
# working on hard refreshes / deep links.
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    _DIST_ROOT = FRONTEND_DIST.resolve()
    _INDEX = _DIST_ROOT / "index.html"

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if not full_path:
            return FileResponse(str(_INDEX))
        # Resolve the requested path and ensure it stays within the dist root,
        # otherwise fall back to index.html (prevents path traversal).
        try:
            candidate = (_DIST_ROOT / full_path).resolve()
            candidate.relative_to(_DIST_ROOT)
        except (ValueError, OSError):
            return FileResponse(str(_INDEX))
        if candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(_INDEX))
