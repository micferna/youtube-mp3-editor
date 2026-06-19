from __future__ import annotations

from pydantic import BaseModel, computed_field


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

    @computed_field  # type: ignore[prop-decorator]
    @property
    def source(self) -> str:
        """Frontend-facing origin label derived from the source URL."""
        url = (self.source_url or "").lower()
        if "youtube.com" in url or "youtu.be" in url:
            return "youtube"
        return "local"


class CutInfo(BaseModel):
    file_id: str
    start: float
    end: float


class ExportRequest(BaseModel):
    cuts: list[CutInfo]
    mode: str  # "merge" or "separate"
    format: str
    quality: int = 320
    # crossfade duration in milliseconds, only used in "merge" mode
    fade: int = 0


class ExportStatus(BaseModel):
    id: str
    status: str  # "processing", "completed", "error"
    progress: float = 0
    output_paths: list[str] = []
    message: str | None = None


class DownloadStatus(BaseModel):
    id: str
    name: str
    status: str  # "queued", "downloading", "completed", "error"
    progress: float = 0
    file_id: str | None = None
    format: str = "audio"
    speed: str | None = None
    eta: str | None = None
    error: str | None = None
