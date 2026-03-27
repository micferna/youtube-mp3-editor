from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect

from backend.models.schemas import DownloadRequest, DownloadStatus, FileInfo
from backend.services.downloader import DownloaderService
from backend.storage.manager import StorageManager
from backend.ws.progress import ConnectionManager

router = APIRouter(prefix="/api", tags=["downloads"])

downloader = DownloaderService()
ws_manager = ConnectionManager()

YOUTUBE_RE = re.compile(r"(youtube\.com|youtu\.be)")


async def _run_download(download_id: str, url: str, fmt: str) -> None:
    storage = StorageManager()
    storage.update_download(download_id, status="downloading")

    async def on_progress(data: dict) -> None:
        storage.update_download(download_id, progress=data.get("percent", 0))
        await ws_manager.broadcast(download_id, {
            "type": "progress",
            "download_id": download_id,
            **data,
        })

    try:
        result = await downloader.download(url, fmt, download_id, on_progress)

        file_id = str(uuid.uuid4())
        file_info = FileInfo(
            id=file_id,
            name=result["title"],
            source_url=url,
            path=result["path"],
            type=result["type"],
            duration=result["duration"],
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        storage.add_file(file_info)
        storage.update_download(
            download_id,
            status="completed",
            progress=100,
            file_id=file_id,
            name=result["title"],
        )
        await ws_manager.broadcast(download_id, {
            "type": "completed",
            "download_id": download_id,
            "file_id": file_id,
        })
    except Exception as exc:
        storage.update_download(download_id, status="error")
        await ws_manager.broadcast(download_id, {
            "type": "error",
            "download_id": download_id,
            "message": str(exc),
        })


@router.post("/download")
async def start_download(req: DownloadRequest, background_tasks: BackgroundTasks):
    if not YOUTUBE_RE.search(req.url):
        raise HTTPException(status_code=400, detail="URL must be a YouTube link")
    if req.format not in ("audio", "video"):
        raise HTTPException(status_code=400, detail="Format must be 'audio' or 'video'")

    download_id = str(uuid.uuid4())
    status = DownloadStatus(
        id=download_id,
        name="Pending…",
        status="pending",
        progress=0,
    )
    StorageManager().add_download(status)
    background_tasks.add_task(_run_download, download_id, req.url, req.format)
    return {"id": download_id, "status": "started"}


@router.get("/downloads")
async def list_downloads():
    return StorageManager().get_downloads()


@router.delete("/downloads/{download_id}")
async def delete_download(download_id: str):
    if not StorageManager().delete_download(download_id):
        raise HTTPException(status_code=404, detail="Download not found")
    return {"ok": True}


@router.websocket("/ws/download/{download_id}")
async def download_ws(websocket: WebSocket, download_id: str):
    await ws_manager.connect(download_id, websocket)
    try:
        while True:
            # Keep connection alive; client can send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(download_id, websocket)
