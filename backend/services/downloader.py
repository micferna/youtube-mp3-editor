from __future__ import annotations

import asyncio
import re
from pathlib import Path
from typing import Any, Callable, Coroutine

from backend.storage.manager import DIRS

DOWNLOAD_DIR = DIRS["downloads"]


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
    ) -> dict[str, Any]:
        output_template = str(DOWNLOAD_DIR / "%(title)s.%(ext)s")

        if fmt == "audio":
            cmd = [
                "yt-dlp",
                "-x",
                "--audio-format", "mp3",
                "--audio-quality", "0",
                "-o", output_template,
                "--progress-template",
                "download:%(progress._percent_str)s %(progress._speed_str)s %(progress._eta_str)s",
                "--newline",
                "--no-playlist",
                url,
            ]
        else:
            cmd = [
                "yt-dlp",
                "-f", "bestvideo+bestaudio/best",
                "--merge-output-format", "mp4",
                "-o", output_template,
                "--progress-template",
                "download:%(progress._percent_str)s %(progress._speed_str)s %(progress._eta_str)s",
                "--newline",
                "--no-playlist",
                url,
            ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        title = "Unknown"
        percent_re = re.compile(r"download:\s*([\d.]+)%\s*([\S]*)\s*([\S]*)")
        dest_re = re.compile(r"\[(?:Merger|ExtractAudio|download)\].*?Destination:\s*(.+)")
        already_re = re.compile(r"\[download\]\s+(.+?) has already been downloaded")
        merge_re = re.compile(r'\[Merger\] Merging formats into "(.+?)"')
        title_re = re.compile(r"\[download\] Downloading item \d+ of \d+|^\[youtube\].*?:\s*Downloading|^\[info\].*?")

        final_path: str | None = None

        assert proc.stdout is not None
        while True:
            line_bytes = await proc.stdout.readline()
            if not line_bytes:
                break
            line = line_bytes.decode("utf-8", errors="replace").strip()

            # Try to capture the output file path
            m = dest_re.search(line)
            if m:
                final_path = m.group(1)

            m = already_re.search(line)
            if m:
                final_path = m.group(1)

            m = merge_re.search(line)
            if m:
                final_path = m.group(1)

            # Progress
            m = percent_re.search(line)
            if m and progress_callback:
                pct_str = m.group(1)
                try:
                    pct = float(pct_str)
                except ValueError:
                    pct = 0.0
                await progress_callback(
                    {"percent": pct, "speed": m.group(2), "eta": m.group(3)}
                )

        await proc.wait()

        if proc.returncode != 0:
            raise RuntimeError(f"yt-dlp exited with code {proc.returncode}")

        # Resolve final path — scan downloads dir for newest file if we didn't capture it
        if final_path is None or not Path(final_path).exists():
            files = sorted(DOWNLOAD_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
            if files:
                final_path = str(files[0])
            else:
                raise RuntimeError("Download completed but output file not found")

        title = Path(final_path).stem
        duration = await _get_duration(final_path)
        file_type = "audio" if fmt == "audio" else "video"

        return {
            "title": title,
            "path": final_path,
            "duration": duration,
            "type": file_type,
        }
