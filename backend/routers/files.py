from __future__ import annotations

import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse

from backend.models.schemas import FileInfo
from backend.services.audio_processor import AudioProcessor
from backend.storage.manager import DIRS, StorageManager

router = APIRouter(prefix="/api/files", tags=["files"])

audio_processor = AudioProcessor()
DOWNLOAD_DIR = DIRS["downloads"]


@router.get("")
async def list_files():
    return StorageManager().get_files()


@router.post("/upload")
async def upload_file(file: UploadFile):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    file_id = str(uuid.uuid4())
    dest = DOWNLOAD_DIR / file.filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    duration = await audio_processor.get_duration(str(dest))
    ext = Path(file.filename).suffix.lower()
    file_type = "video" if ext in (".mp4", ".mkv", ".webm", ".avi", ".mov") else "audio"

    info = FileInfo(
        id=file_id,
        name=Path(file.filename).stem,
        source_url="upload",
        path=str(dest),
        type=file_type,
        duration=duration,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    StorageManager().add_file(info)
    return info


@router.delete("/{file_id}")
async def delete_file(file_id: str):
    if not StorageManager().delete_file(file_id):
        raise HTTPException(status_code=404, detail="File not found")
    return {"ok": True}


@router.get("/{file_id}/waveform")
async def get_waveform(file_id: str):
    info = StorageManager().get_file(file_id)
    if not info:
        raise HTTPException(status_code=404, detail="File not found")
    peaks = await audio_processor.generate_waveform_peaks(info.path, file_id)
    return {"peaks": peaks}


@router.get("/{file_id}/stream")
async def stream_file(file_id: str):
    info = StorageManager().get_file(file_id)
    if not info:
        raise HTTPException(status_code=404, detail="File not found")
    path = Path(info.path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    media_type = "audio/mpeg" if info.type == "audio" else "video/mp4"
    return FileResponse(str(path), media_type=media_type, filename=path.name)
