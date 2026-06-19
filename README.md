# 🎵 YouTube MP3/Video Editor

A self-hosted web app to download audio/video from YouTube, cut & trim segments on a
waveform, reassemble cuts, and export to multiple formats — all from your browser.

[![CI](https://github.com/micferna/youtube-mp3-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/micferna/youtube-mp3-editor/actions/workflows/ci.yml) ![stack](https://img.shields.io/badge/backend-FastAPI-009688) ![stack](https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite%208-61dafb) ![media](https://img.shields.io/badge/media-ffmpeg%20%2B%20yt--dlp-orange) ![license](https://img.shields.io/badge/license-MIT-green)

## Features

- **Download** from YouTube (audio → MP3, or video → MP4) with real-time progress
  (percentage / speed / ETA) over WebSocket.
- **Library** of downloaded and uploaded files, with grid/list views and search.
- **Waveform editor** (wavesurfer.js): mark in/out, create draggable/resizable cut
  regions, zoom, keyboard shortcuts, per-cut preview.
- **Assembly timeline**: reorder cuts (drag & drop) and reassemble them.
- **Export**: separate files or a single merged file, with optional **crossfade**,
  in MP3 / WAV / FLAC / OGG (selectable bitrate for MP3). Multiple outputs are zipped.
- **Upload** your own audio/video files to edit.

## Stack

- **Backend**: Python 3.13, FastAPI, `yt-dlp`, `ffmpeg`/`ffprobe`, WebSockets.
- **Frontend**: Vite + React + TypeScript, Tailwind CSS, wavesurfer.js, Zustand.
- **Storage**: local filesystem + a single `projects.json` (no database).

## Run with Docker (recommended)

```bash
docker compose up -d --build
```

Then open **http://localhost:8000** — a single container serves both the API and the
built frontend. Downloads, exports and state are persisted on the host under `./data`.

```bash
docker compose logs -f   # follow logs
docker compose down      # stop
```

> The container runs as root, so files it writes into `./data` are root-owned on the
> host. To map them to your user, add `user: "1000:1000"` to the service in
> `docker-compose.yml`.

## Run locally (dev)

Requires `python3`, `node`, `ffmpeg` and `yt-dlp` on your `PATH`.

```bash
./start.sh          # dev: backend :8000 + Vite dev server :5173
./start.sh prod     # build frontend and serve everything from :8000
```

## Project layout

```
backend/      FastAPI app — routers (downloads, files, exports), services
              (downloader, audio/video processors), storage, websocket
frontend/     React + Vite single-page app
data/         downloads / exports / temp / waveforms + projects.json (gitignored)
```

## Notes

- `yt-dlp` is intentionally left unpinned so each image build pulls the newest
  release (YouTube frequently breaks older versions).
- This tool is for personal use; respect YouTube's Terms of Service and copyright.

## License

Released under the [MIT License](LICENSE).
