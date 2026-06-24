from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from backend.models.schemas import CookiesRequest
from backend.storage.manager import COOKIES_FILE

router = APIRouter(prefix="/api", tags=["settings"])


def _cookie_count(text: str) -> int:
    """Count cookie entries — Netscape lines carry 7 tab-separated fields."""
    count = 0
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        if line.count("\t") >= 6:
            count += 1
    return count


def _looks_like_netscape(text: str) -> bool:
    stripped = text.lstrip()
    if stripped.startswith("# Netscape HTTP Cookie File") or stripped.startswith(
        "# HTTP Cookie File"
    ):
        return True
    # Otherwise accept it if it has at least one valid tab-separated cookie line.
    return _cookie_count(text) > 0


@router.get("/cookies")
async def get_cookies_status():
    """Report whether cookies are configured — never returns their contents."""
    if not COOKIES_FILE.exists() or COOKIES_FILE.stat().st_size == 0:
        return {"present": False, "count": 0, "updated_at": None}
    text = COOKIES_FILE.read_text(encoding="utf-8", errors="replace")
    mtime = datetime.fromtimestamp(COOKIES_FILE.stat().st_mtime, tz=timezone.utc)
    return {"present": True, "count": _cookie_count(text), "updated_at": mtime.isoformat()}


@router.put("/cookies")
async def set_cookies(req: CookiesRequest):
    text = req.content.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Cookies content is empty")
    if not _looks_like_netscape(text):
        raise HTTPException(
            status_code=400,
            detail=(
                "This doesn't look like a Netscape cookies.txt export. Use a "
                "'Get cookies.txt' browser extension on youtube.com, then paste "
                "the exported file here."
            ),
        )
    # Trailing newline so yt-dlp parses the final cookie line.
    COOKIES_FILE.write_text(text + "\n", encoding="utf-8")
    return {"present": True, "count": _cookie_count(text)}


@router.delete("/cookies")
async def clear_cookies():
    if COOKIES_FILE.exists():
        COOKIES_FILE.unlink()
    return {"ok": True}
