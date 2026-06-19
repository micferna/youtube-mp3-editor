from __future__ import annotations

import asyncio
import json
from pathlib import Path


class VideoProcessor:
    """Video manipulation via ffmpeg / ffprobe."""

    async def get_duration(self, file_path: str) -> float:
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
        data = json.loads(stdout.decode())
        return float(data.get("format", {}).get("duration", 0))

    async def cut(self, file_path: str, start: float, end: float, output_path: str) -> str:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y",
            "-ss", str(start),
            "-to", str(end),
            "-i", file_path,
            "-c", "copy",
            output_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg video cut failed: {stderr.decode()}")
        return output_path

    async def merge(self, file_paths: list[str], output_path: str) -> str:
        if not file_paths:
            raise ValueError("No files to merge")

        concat_path = Path(output_path).parent / f"concat_{Path(output_path).stem}.txt"
        with open(concat_path, "w") as f:
            for fp in file_paths:
                safe = str(fp).replace("'", "'\\''")
                f.write(f"file '{safe}'\n")

        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_path),
            "-c", "copy",
            output_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        concat_path.unlink(missing_ok=True)
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg video merge failed: {stderr.decode()}")
        return output_path
