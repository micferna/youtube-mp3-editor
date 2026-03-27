from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

from backend.models.schemas import DownloadStatus, ExportStatus, FileInfo

BASE_DIR = Path(__file__).resolve().parent.parent.parent / "data"

DIRS = {
    "downloads": BASE_DIR / "downloads",
    "exports": BASE_DIR / "exports",
    "temp": BASE_DIR / "temp",
    "waveforms": BASE_DIR / "waveforms",
}

PROJECTS_FILE = BASE_DIR / "projects.json"


class StorageManager:
    """Thread-safe singleton that persists project state to projects.json."""

    _instance: StorageManager | None = None
    _lock = threading.Lock()

    def __new__(cls) -> StorageManager:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    inst = super().__new__(cls)
                    inst._init_storage()
                    cls._instance = inst
        return cls._instance

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------

    def _init_storage(self) -> None:
        self._save_lock = threading.Lock()
        for d in DIRS.values():
            d.mkdir(parents=True, exist_ok=True)
        if PROJECTS_FILE.exists():
            with open(PROJECTS_FILE, "r") as f:
                self._data: dict[str, Any] = json.load(f)
        else:
            self._data = {"files": {}, "downloads": {}, "exports": {}}
            self.save()

    # ------------------------------------------------------------------
    # Files
    # ------------------------------------------------------------------

    def add_file(self, file_info: FileInfo) -> None:
        self._data["files"][file_info.id] = file_info.model_dump()
        self.save()

    def get_files(self) -> list[FileInfo]:
        return [FileInfo(**v) for v in self._data["files"].values()]

    def get_file(self, file_id: str) -> FileInfo | None:
        raw = self._data["files"].get(file_id)
        return FileInfo(**raw) if raw else None

    def delete_file(self, file_id: str) -> bool:
        if file_id in self._data["files"]:
            info = self._data["files"].pop(file_id)
            path = Path(info["path"])
            if path.exists():
                path.unlink()
            self.save()
            return True
        return False

    # ------------------------------------------------------------------
    # Downloads
    # ------------------------------------------------------------------

    def add_download(self, status: DownloadStatus) -> None:
        self._data["downloads"][status.id] = status.model_dump()
        self.save()

    def update_download(self, download_id: str, **kwargs: Any) -> None:
        if download_id in self._data["downloads"]:
            self._data["downloads"][download_id].update(kwargs)
            self.save()

    def get_downloads(self) -> list[DownloadStatus]:
        return [DownloadStatus(**v) for v in self._data["downloads"].values()]

    def delete_download(self, download_id: str) -> bool:
        if download_id in self._data["downloads"]:
            del self._data["downloads"][download_id]
            self.save()
            return True
        return False

    # ------------------------------------------------------------------
    # Exports
    # ------------------------------------------------------------------

    def add_export(self, status: ExportStatus) -> None:
        self._data["exports"][status.id] = status.model_dump()
        self.save()

    def update_export(self, export_id: str, **kwargs: Any) -> None:
        if export_id in self._data["exports"]:
            self._data["exports"][export_id].update(kwargs)
            self.save()

    def get_export(self, export_id: str) -> ExportStatus | None:
        raw = self._data["exports"].get(export_id)
        return ExportStatus(**raw) if raw else None

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self) -> None:
        with self._save_lock:
            with open(PROJECTS_FILE, "w") as f:
                json.dump(self._data, f, indent=2)
