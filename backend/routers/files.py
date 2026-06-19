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

VIDEO_EXTS = (".mp4", ".mkv", ".webm", ".avi", ".mov")


@router.get("")
async def list_files():
    return StorageManager().get_files()


@router.post("/upload")
async def upload_files(files: list[UploadFile]):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    storage = StorageManager()
    created: list[FileInfo] = []

    for file in files:
        if not file.filename:
            continue

        # Strip any directory components to prevent path traversal.
        safe_name = Path(file.filename).name
        dest = DOWNLOAD_DIR / safe_name
        # Avoid clobbering an existing file with the same name.
        if dest.exists():
            dest = DOWNLOAD_DIR / f"{dest.stem}_{uuid.uuid4().hex[:8]}{dest.suffix}"

        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)

        duration = await audio_processor.get_duration(str(dest))
        ext = dest.suffix.lower()
        file_type = "video" if ext in VIDEO_EXTS else "audio"

        info = FileInfo(
            id=str(uuid.uuid4()),
            name=dest.stem,
            source_url="upload",
            path=str(dest),
            type=file_type,
            duration=duration,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        storage.add_file(info)
        created.append(info)

    if not created:
        raise HTTPException(status_code=400, detail="No valid files uploaded")
    return created


@router.get("/{file_id}")
async def get_file(file_id: str):
    info = StorageManager().get_file(file_id)
    if not info:
        raise HTTPException(status_code=404, detail="File not found")
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
