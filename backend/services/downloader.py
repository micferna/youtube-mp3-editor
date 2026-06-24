from __future__ import annotations

import asyncio
import re
import shutil
from collections import deque
from pathlib import Path
from typing import Any, Callable, Coroutine

from backend.storage.manager import BASE_DIR, COOKIES_FILE, DIRS

DOWNLOAD_DIR = DIRS["downloads"]
# yt-dlp caches deciphered signatures and the EJS challenge-solver script here.
# It lives under the data volume so it survives container recreation and the
# solver is fetched from GitHub only once.
CACHE_DIR = BASE_DIR / "yt-dlp-cache"

# YouTube now requires a JavaScript runtime *and* the EJS challenge-solver
# script to decipher stream signatures and the "n" throttling parameter.
# Without them, extraction of many videos fails outright — surfacing to the user
# as "yt-dlp exited with code 1". We detect a runtime once at import time.
_NODE = shutil.which("node") or shutil.which("nodejs")
_DENO = shutil.which("deno")


def _js_args() -> list[str]:
    """yt-dlp flags enabling JS challenge solving, based on the runtime found."""
    # The EJS solver lib is downloaded from GitHub on first use, then cached.
    ejs = ["--remote-components", "ejs:github"]
    if _DENO:
        # deno is yt-dlp's default runtime; no --js-runtimes needed to select it.
        return ejs
    if _NODE:
        return ["--js-runtimes", f"node:{_NODE}", *ejs]
    # No runtime available — solving is skipped (degraded, same as before).
    return []


async def _get_duration(file_path: str) -> float:
    """Return duration in seconds via ffprobe."""
    proc = await asyncio.create_subprocess_exec(
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        file_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    if proc.returncode != 0:
        return 0.0
    import json
    data = json.loads(stdout.decode())
    return float(data.get("format", {}).get("duration", 0))


class DownloaderService:
    """Wraps yt-dlp to download audio/video with progress reporting."""

    async def download(
        self,
        url: str,
        fmt: str,
        download_id: str,
        progress_callback: Callable[[dict[str, Any]], Coroutine[Any, Any, None]] | None = None,
        playlist: bool = False,
    ) -> list[dict[str, Any]]:
        """Download one (or, when ``playlist`` is set, many) item(s).

        Returns one result dict per produced file. Even a single video yields a
        one-element list so callers can treat both modes uniformly.
        """
        output_template = str(DOWNLOAD_DIR / "%(title)s.%(ext)s")

        # Pass user-supplied YouTube cookies when configured — needed for
        # age-gated videos and "confirm you're not a bot" challenges.
        cookie_args: list[str] = []
        if COOKIES_FILE.exists() and COOKIES_FILE.stat().st_size > 0:
            cookie_args = ["--cookies", str(COOKIES_FILE)]

        common = [
            "-o", output_template,
            "--cache-dir", str(CACHE_DIR),
            # Print the absolute path of every finished file (one line per item),
            # so playlist downloads can be collected reliably. "after_move"
            # fires post-processing, so it does not imply --simulate.
            "--print", "after_move:filepath",
            # --print implies --quiet, so force the progress bar back on. The
            # "download:" type selector is consumed by yt-dlp, hence the literal
            # __PROG__ marker; the trailing |idx|count drive playlist progress.
            "--progress",
            "--progress-template",
            "download:__PROG__%(progress._percent_str)s %(progress._speed_str)s "
            "%(progress._eta_str)s|%(info.playlist_index)s|%(info.playlist_count)s",
            "--newline",
            "--yes-playlist" if playlist else "--no-playlist",
            "--no-update",
            *cookie_args,
            *_js_args(),
        ]

        if fmt == "audio":
            cmd = [
                "yt-dlp",
                "-x",
                "--audio-format", "mp3",
                "--audio-quality", "0",
                *common,
                url,
            ]
        else:
            cmd = [
                "yt-dlp",
                "-f", "bestvideo+bestaudio/best",
                "--merge-output-format", "mp4",
                *common,
                url,
            ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        # __PROG__<pct>% <speed> <eta>|<playlist_index>|<playlist_count>
        percent_re = re.compile(
            r"__PROG__\s*([\d.]+)%\s+(.*?)\s+(\S+)\|([^|]*)\|([^|]*)\s*$"
        )
        dl_prefix = str(DOWNLOAD_DIR)

        final_paths: list[str] = []
        # Keep the tail of yt-dlp's output so a failure can report *why* it
        # failed instead of a bare "exited with code 1".
        recent: deque[str] = deque(maxlen=25)
        errors: list[str] = []

        assert proc.stdout is not None
        while True:
            line_bytes = await proc.stdout.readline()
            if not line_bytes:
                break
            line = line_bytes.decode("utf-8", errors="replace").strip()
            if not line:
                continue
            recent.append(line)
            if line.startswith("ERROR"):
                errors.append(line)
                continue

            # A bare absolute path under the downloads dir is the "after_move"
            # print: one final file. Other yt-dlp lines start with "[" / "__PROG__".
            if line.startswith(dl_prefix) and line not in final_paths:
                final_paths.append(line)
                continue

            # Progress
            m = percent_re.search(line)
            if m and progress_callback:
                try:
                    pct = float(m.group(1))
                except ValueError:
                    pct = 0.0
                idx = int(m.group(4)) if m.group(4).isdigit() else 1
                count = int(m.group(5)) if m.group(5).isdigit() else 1
                # Spread per-item percent across the whole playlist.
                overall = ((idx - 1) + pct / 100) / count * 100 if count else pct
                await progress_callback(
                    {"percent": overall, "speed": m.group(2), "eta": m.group(3)}
                )

        await proc.wait()

        # Keep only paths that actually exist on disk.
        paths = [p for p in final_paths if Path(p).exists()]

        # Single-video fallback: yt-dlp may skip the "after_move" print when the
        # file already existed — grab the newest file in that case.
        if not playlist and not paths and proc.returncode == 0:
            files = sorted(
                DOWNLOAD_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True
            )
            if files:
                paths = [str(files[0])]

        # In playlist mode some items may fail (e.g. private/region-locked) while
        # others succeed — that's still a useful, partial success. Only error out
        # when we produced nothing at all.
        if not paths:
            detail = "\n".join(errors) if errors else "\n".join(recent)
            message = f"yt-dlp exited with code {proc.returncode}"
            if detail:
                message = f"{message}: {detail}"
            raise RuntimeError(message)

        file_type = "audio" if fmt == "audio" else "video"
        results: list[dict[str, Any]] = []
        for path in paths:
            results.append({
                "title": Path(path).stem,
                "path": path,
                "duration": await _get_duration(path),
                "type": file_type,
            })
        return results
