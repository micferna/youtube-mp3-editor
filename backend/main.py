from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.routers import downloads, exports, files
from backend.storage.manager import StorageManager

app = FastAPI(title="YouTube MP3/Video Editor API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(downloads.router)
app.include_router(files.router)
app.include_router(exports.router)


@app.on_event("startup")
async def startup() -> None:
    # Ensure storage is initialised
    StorageManager()


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve frontend static files if built
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
