# YouTube MP3 Editor — Design Spec

## Overview

Web application for downloading audio/video from YouTube, cutting/trimming segments, reassembling cuts, and exporting in multiple formats.

## Stack

- **Backend**: Python, FastAPI, yt-dlp, ffmpeg/pydub
- **Frontend**: Vite + React + TypeScript, Tailwind CSS, wavesurfer.js, Zustand
- **Communication**: REST API + WebSocket (download/export progress)
- **Storage**: Local filesystem + `projects.json` (no database)

## Features

### Download
- Paste YouTube URL, choose audio or video format
- Real-time progress via WebSocket (%, speed, ETA)
- Multiple concurrent downloads
- List of downloads (in progress, completed, errors)

### Editor
- **Waveform** (audio): wavesurfer.js, server-side peak generation via ffmpeg, colored regions for cuts, drag edges to adjust, zoom in/out
- **Video**: HTML5 player + simplified timeline with cut regions, optional audio track extraction
- **Cut panel**: cards with editable start/end timestamps (mm:ss.ms), optional name, play preview, delete, drag to reorder
- **Assembly mode**: dedicated zone at bottom, drag cuts from panel or other files, reorder, preview assembled result, optional fade in/out between cuts
- **Keyboard shortcuts**: Space (play/pause), I (mark start), O (mark end), Delete (remove cut), Ctrl+Z (undo)
- **Timestamps**: visual selection on waveform + manual input for precision

### Export
- Export cuts separately or merged into one file
- Formats: MP3, WAV, FLAC, OGG
- Quality selection (bitrate for MP3)
- Progress tracking

### Library
- List all downloaded files
- Upload local files (not just YouTube)
- Delete, rename, open in editor

## Pages

1. **Download Page** — URL input, format choice, progress, download list
2. **Editor Page** — waveform/video player, cut panel, assembly timeline, export
3. **Library Page** — file browser, upload, manage

**Navigation**: Top bar with 3 tabs (Download, Editor, Library)

## API Endpoints

### Downloads
- `POST /api/download` — start download (url, format)
- `GET /api/downloads` — list downloads
- `DELETE /api/downloads/{id}` — delete download + files
- `WebSocket /ws/download/{id}` — real-time progress

### Files
- `GET /api/files` — list all files
- `POST /api/files/upload` — upload local file
- `DELETE /api/files/{id}` — delete file
- `GET /api/files/{id}/waveform` — pre-computed waveform peaks

### Export
- `POST /api/cuts/preview` — preview a single cut
- `POST /api/export` — export cuts (list of cuts, mode merge/separate, format, quality)
- `GET /api/export/{id}/status` — export status
- `GET /api/export/{id}/download` — download exported file

## Data Model

No database. `projects.json` stores metadata:
- Files: id, name, source URL, path, type (audio/video), duration, created_at
- Cuts: id, file_id, start, end, name
- Exports: id, cuts, mode, format, status, output_path

Migratable to SQLite later if needed.

## Design

### Palette
- Background: #1a1a2e (dark grey-blue)
- Secondary: #16213e (night blue)
- Accent primary: #e94560 (magenta)
- Accent secondary: #53d8fb (cyan)
- Text: #eee / grey

### Style
- Rounded corners, subtle shadows
- Gradient buttons with animated hover
- Cards with thin colored borders
- Icons: Lucide React
- Smooth transitions

### Waveform
- Cyan → violet gradient
- Semi-transparent colored regions for cuts
- Magenta playback cursor

### Responsive
- Desktop-first (editing tool)
- Tablet: cut panel moves below
- Mobile: library browsable, editing limited

## Project Structure

```
youtube-mp3/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── routers/
│   │   ├── downloads.py
│   │   ├── files.py
│   │   └── exports.py
│   ├── services/
│   │   ├── downloader.py
│   │   ├── audio_processor.py
│   │   └── video_processor.py
│   ├── models/
│   │   └── schemas.py
│   ├── storage/
│   │   └── manager.py
│   └── ws/
│       └── progress.py
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── pages/
│   │   │   ├── DownloadPage.tsx
│   │   │   ├── EditorPage.tsx
│   │   │   └── LibraryPage.tsx
│   │   ├── components/
│   │   │   ├── Waveform.tsx
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── CutPanel.tsx
│   │   │   ├── AssemblyTimeline.tsx
│   │   │   ├── ExportModal.tsx
│   │   │   └── DownloadCard.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   └── useAudioEditor.ts
│   │   ├── stores/
│   │   │   └── editorStore.ts
│   │   └── styles/
│   │       └── globals.css
├── data/
│   └── projects.json
└── README.md
```

## Dependencies

### Backend
- fastapi, uvicorn
- yt-dlp
- pydub (ffmpeg wrapper)
- websockets
- python-multipart (file upload)

### Frontend
- react, react-dom, react-router-dom
- wavesurfer.js
- zustand
- tailwindcss
- lucide-react
- @dnd-kit (drag and drop)
