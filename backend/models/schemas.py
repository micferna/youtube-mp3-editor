from __future__ import annotations

from pydantic import BaseModel


class DownloadRequest(BaseModel):
    url: str
    format: str  # "audio" or "video"


class FileInfo(BaseModel):
    id: str
    name: str
    source_url: str
    path: str
    type: str  # "audio" or "video"
    duration: float
    created_at: str


class CutInfo(BaseModel):
    file_id: str
    start: float
    end: float


class ExportRequest(BaseModel):
    cuts: list[CutInfo]
    mode: str  # "merge" or "separate"
    format: str
    quality: int = 320


class ExportStatus(BaseModel):
    id: str
    status: str  # "processing", "completed", "error"
    output_paths: list[str] = []


class DownloadStatus(BaseModel):
    id: str
    name: str
    status: str  # "pending", "downloading", "completed", "error"
    progress: float = 0
    file_id: str | None = None
