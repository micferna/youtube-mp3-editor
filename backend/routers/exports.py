from __future__ import annotations

import os
import uuid
import zipfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from backend.models.schemas import CutInfo, ExportRequest, ExportStatus
from backend.services.audio_processor import AudioProcessor
from backend.services.video_processor import VideoProcessor
from backend.storage.manager import DIRS, StorageManager

router = APIRouter(prefix="/api", tags=["exports"])

audio_processor = AudioProcessor()
video_processor = VideoProcessor()

EXPORT_DIR = DIRS["exports"]
TEMP_DIR = DIRS["temp"]


@router.post("/cuts/preview")
async def preview_cut(cut: CutInfo):
    storage = StorageManager()
    info = storage.get_file(cut.file_id)
    if not info:
        raise HTTPException(status_code=404, detail="File not found")

    ext = Path(info.path).suffix
    temp_path = str(TEMP_DIR / f"preview_{uuid.uuid4().hex}{ext}")

    try:
        if info.type == "audio":
            await audio_processor.cut(info.path, cut.start, cut.end, temp_path)
        else:
            await video_processor.cut(info.path, cut.start, cut.end, temp_path)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    media_type = "audio/mpeg" if info.type == "audio" else "video/mp4"
    return FileResponse(temp_path, media_type=media_type, filename=f"preview{ext}")


async def _run_export(export_id: str, req: ExportRequest) -> None:
    storage = StorageManager()
    try:
        cut_paths: list[str] = []
        file_type = "audio"

        for i, cut in enumerate(req.cuts):
            info = storage.get_file(cut.file_id)
            if not info:
                raise RuntimeError(f"File {cut.file_id} not found")
            file_type = info.type

            ext = Path(info.path).suffix
            seg_path = str(TEMP_DIR / f"export_{export_id}_seg{i}{ext}")

            if info.type == "audio":
                await audio_processor.cut(info.path, cut.start, cut.end, seg_path)
            else:
                await video_processor.cut(info.path, cut.start, cut.end, seg_path)
            cut_paths.append(seg_path)

        output_paths: list[str] = []

        if req.mode == "merge" and len(cut_paths) > 0:
            out_ext = f".{req.format}" if req.format else Path(cut_paths[0]).suffix
            merged_path = str(EXPORT_DIR / f"{export_id}_merged{out_ext}")

            if file_type == "audio":
                await audio_processor.merge(cut_paths, merged_path)
                # Convert if needed
                if req.format and not merged_path.endswith(f".{req.format}"):
                    final_path = str(EXPORT_DIR / f"{export_id}_final.{req.format}")
                    await audio_processor.convert(merged_path, req.format, req.quality, final_path)
                    os.remove(merged_path)
                    output_paths.append(final_path)
                else:
                    output_paths.append(merged_path)
            else:
                await video_processor.merge(cut_paths, merged_path)
                output_paths.append(merged_path)
        else:
            # Separate mode — convert each segment if needed
            for i, seg in enumerate(cut_paths):
                if file_type == "audio" and req.format:
                    final_path = str(EXPORT_DIR / f"{export_id}_part{i}.{req.format}")
                    await audio_processor.convert(seg, req.format, req.quality, final_path)
                    output_paths.append(final_path)
                else:
                    dest = str(EXPORT_DIR / f"{export_id}_part{i}{Path(seg).suffix}")
                    os.rename(seg, dest)
                    output_paths.append(dest)

        # Clean up temp segments
        for p in cut_paths:
            if os.path.exists(p):
                os.remove(p)

        storage.update_export(export_id, status="completed", output_paths=output_paths)

    except Exception as exc:
        storage.update_export(export_id, status="error", output_paths=[])
        raise exc


@router.post("/export")
async def start_export(req: ExportRequest, background_tasks: BackgroundTasks):
    if not req.cuts:
        raise HTTPException(status_code=400, detail="No cuts provided")
    if req.mode not in ("merge", "separate"):
        raise HTTPException(status_code=400, detail="Mode must be 'merge' or 'separate'")

    export_id = str(uuid.uuid4())
    status = ExportStatus(id=export_id, status="processing")
    StorageManager().add_export(status)
    background_tasks.add_task(_run_export, export_id, req)
    return {"id": export_id, "status": "processing"}


@router.get("/export/{export_id}/status")
async def export_status(export_id: str):
    status = StorageManager().get_export(export_id)
    if not status:
        raise HTTPException(status_code=404, detail="Export not found")
    return status


@router.get("/export/{export_id}/download")
async def export_download(export_id: str):
    status = StorageManager().get_export(export_id)
    if not status:
        raise HTTPException(status_code=404, detail="Export not found")
    if status.status != "completed" or not status.output_paths:
        raise HTTPException(status_code=400, detail="Export not ready")

    if len(status.output_paths) == 1:
        path = status.output_paths[0]
        return FileResponse(path, filename=Path(path).name)

    # Multiple files — create a zip
    zip_path = str(EXPORT_DIR / f"{export_id}.zip")
    with zipfile.ZipFile(zip_path, "w") as zf:
        for p in status.output_paths:
            zf.write(p, Path(p).name)
    return FileResponse(zip_path, media_type="application/zip", filename=f"export_{export_id}.zip")
