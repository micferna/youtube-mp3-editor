from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

from backend.models.schemas import DownloadStatus, ExportStatus, FileInfo

BASE_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent.parent / "data"))

DIRS = {
    "downloads": BASE_DIR / "downloads",
    "exports": BASE_DIR / "exports",
    "temp": BASE_DIR / "temp",
    "waveforms": BASE_DIR / "waveforms",
}

PROJECTS_FILE = BASE_DIR / "projects.json"

_MARKER = os.sep + "data" + os.sep


def to_rel(path: str | os.PathLike[str]) -> str:
    """Convert a path into a form relative to the data dir for storage.

    Absolute paths captured on another machine (e.g. /home/x/.../data/downloads/y)
    are normalised to ``downloads/y`` so they resolve correctly regardless of
    where the data directory is mounted (host vs. container).
    """
    p = str(path)
    try:
        return str(Path(p).resolve().relative_to(BASE_DIR.resolve()))
    except ValueError:
        idx = p.rfind(_MARKER)
        if idx != -1:
            return p[idx + len(_MARKER):]
        return p


def to_abs(path: str | os.PathLike[str]) -> str:
    """Resolve a stored (relative) path back to an absolute on-disk path."""
    p = Path(path)
    return str(p if p.is_absolute() else (BASE_DIR / p))


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
        self._save_lock = threading.RLock()
        for d in DIRS.values():
            d.mkdir(parents=True, exist_ok=True)
        if PROJECTS_FILE.exists():
            with open(PROJECTS_FILE, "r") as f:
                self._data: dict[str, Any] = json.load(f)
            self._migrate_paths()
        else:
            self._data = {"files": {}, "downloads": {}, "exports": {}}
            self.save()

    def _migrate_paths(self) -> None:
        """Normalise any legacy absolute paths to data-relative ones."""
        changed = False
        for info in self._data.get("files", {}).values():
            rel = to_rel(info.get("path", ""))
            if rel != info.get("path"):
                info["path"] = rel
                changed = True
        for exp in self._data.get("exports", {}).values():
            new_paths = [to_rel(p) for p in exp.get("output_paths", [])]
            if new_paths != exp.get("output_paths", []):
                exp["output_paths"] = new_paths
                changed = True
        if changed:
            self.save()

    # ------------------------------------------------------------------
    # Files
    # ------------------------------------------------------------------

    def add_file(self, file_info: FileInfo) -> None:
        with self._save_lock:
            data = file_info.model_dump()
            data["path"] = to_rel(data["path"])
            self._data["files"][file_info.id] = data
            self._write()

    def get_files(self) -> list[FileInfo]:
        return [self._hydrate_file(v) for v in self._data["files"].values()]

    def get_file(self, file_id: str) -> FileInfo | None:
        raw = self._data["files"].get(file_id)
        return self._hydrate_file(raw) if raw else None

    def _hydrate_file(self, raw: dict[str, Any]) -> FileInfo:
        data = dict(raw)
        data["path"] = to_abs(data["path"])
        return FileInfo(**data)

    def delete_file(self, file_id: str) -> bool:
        with self._save_lock:
            if file_id not in self._data["files"]:
                return False
            info = self._data["files"].pop(file_id)
            path = Path(to_abs(info["path"]))
            if path.exists():
                path.unlink()
            # Drop the cached waveform peaks as well
            wave = DIRS["waveforms"] / f"{file_id}.json"
            if wave.exists():
                wave.unlink()
            self._write()
            return True

    # ------------------------------------------------------------------
    # Downloads
    # ------------------------------------------------------------------

    def add_download(self, status: DownloadStatus) -> None:
        with self._save_lock:
            self._data["downloads"][status.id] = status.model_dump()
            self._write()

    def update_download(self, download_id: str, **kwargs: Any) -> None:
        with self._save_lock:
            if download_id in self._data["downloads"]:
                self._data["downloads"][download_id].update(kwargs)
                self._write()

    def get_downloads(self) -> list[DownloadStatus]:
        return [DownloadStatus(**v) for v in self._data["downloads"].values()]

    def delete_download(self, download_id: str) -> bool:
        with self._save_lock:
            if download_id in self._data["downloads"]:
                del self._data["downloads"][download_id]
                self._write()
                return True
            return False

    # ------------------------------------------------------------------
    # Exports
    # ------------------------------------------------------------------

    def add_export(self, status: ExportStatus) -> None:
        with self._save_lock:
            self._data["exports"][status.id] = status.model_dump()
            self._write()

    def update_export(self, export_id: str, **kwargs: Any) -> None:
        with self._save_lock:
            if export_id in self._data["exports"]:
                if "output_paths" in kwargs:
                    kwargs["output_paths"] = [to_rel(p) for p in kwargs["output_paths"]]
                self._data["exports"][export_id].update(kwargs)
                self._write()

    def get_export(self, export_id: str) -> ExportStatus | None:
        raw = self._data["exports"].get(export_id)
        if not raw:
            return None
        data = dict(raw)
        data["output_paths"] = [to_abs(p) for p in data.get("output_paths", [])]
        return ExportStatus(**data)

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _write(self) -> None:
        tmp = PROJECTS_FILE.with_suffix(".json.tmp")
        with open(tmp, "w") as f:
            json.dump(self._data, f, indent=2)
        os.replace(tmp, PROJECTS_FILE)

    def save(self) -> None:
        with self._save_lock:
            self._write()
