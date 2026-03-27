from __future__ import annotations

import asyncio
import json
import struct
from pathlib import Path

from backend.storage.manager import DIRS

WAVEFORM_DIR = DIRS["waveforms"]


class AudioProcessor:
    """Audio manipulation via ffmpeg / ffprobe."""

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

    async def generate_waveform_peaks(
        self, file_path: str, file_id: str, num_peaks: int = 800
    ) -> list[float]:
        cache_path = WAVEFORM_DIR / f"{file_id}.json"
        if cache_path.exists():
            with open(cache_path, "r") as f:
                return json.load(f)

        # Extract raw mono 16-bit PCM at 8 kHz
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-i", file_path,
            "-ac", "1",
            "-ar", "8000",
            "-f", "s16le",
            "-acodec", "pcm_s16le",
            "pipe:1",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        if proc.returncode != 0:
            return []

        # Parse samples
        num_samples = len(stdout) // 2
        if num_samples == 0:
            return []

        samples = struct.unpack(f"<{num_samples}h", stdout)
        samples_per_peak = max(1, num_samples // num_peaks)

        peaks: list[float] = []
        for i in range(0, num_samples, samples_per_peak):
            chunk = samples[i : i + samples_per_peak]
            peak = max(abs(s) for s in chunk) / 32768.0
            peaks.append(round(peak, 4))
            if len(peaks) >= num_peaks:
                break

        # Cache
        WAVEFORM_DIR.mkdir(parents=True, exist_ok=True)
        with open(cache_path, "w") as f:
            json.dump(peaks, f)

        return peaks

    async def cut(self, file_path: str, start: float, end: float, output_path: str) -> str:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y",
            "-ss", str(start),
            "-to", str(end),
            "-i", file_path,
            "-acodec", "copy",
            output_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg cut failed: {stderr.decode()}")
        return output_path

    async def merge(self, file_paths: list[str], output_path: str, fade_ms: int = 0) -> str:
        if not file_paths:
            raise ValueError("No files to merge")

        # Build concat file
        concat_path = Path(output_path).parent / "concat_list.txt"
        with open(concat_path, "w") as f:
            for fp in file_paths:
                f.write(f"file '{fp}'\n")

        cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_path),
            "-acodec", "copy",
            output_path,
        ]

        # If crossfade is requested, re-encode instead of copy
        if fade_ms > 0 and len(file_paths) >= 2:
            fade_s = fade_ms / 1000.0
            # For simplicity, use concat demuxer with re-encode for crossfade
            cmd = [
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(concat_path),
                "-af", f"afade=t=in:st=0:d={fade_s},afade=t=out:st=0:d={fade_s}",
                output_path,
            ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        concat_path.unlink(missing_ok=True)
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg merge failed: {stderr.decode()}")
        return output_path

    async def convert(self, file_path: str, fmt: str, quality: int, output_path: str) -> str:
        cmd = ["ffmpeg", "-y", "-i", file_path]
        if fmt == "mp3":
            cmd += ["-acodec", "libmp3lame", "-b:a", f"{quality}k"]
        elif fmt == "wav":
            cmd += ["-acodec", "pcm_s16le"]
        elif fmt == "flac":
            cmd += ["-acodec", "flac"]
        elif fmt == "ogg":
            cmd += ["-acodec", "libvorbis", "-b:a", f"{quality}k"]
        elif fmt == "aac":
            cmd += ["-acodec", "aac", "-b:a", f"{quality}k"]
        else:
            cmd += ["-acodec", "copy"]
        cmd.append(output_path)

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg convert failed: {stderr.decode()}")
        return output_path
