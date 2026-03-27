# YouTube MP3 Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app for downloading YouTube audio/video, cutting segments visually, assembling cuts, and exporting in multiple formats.

**Architecture:** FastAPI backend handles downloads (yt-dlp), audio/video processing (ffmpeg), and file management. React frontend with wavesurfer.js provides waveform visualization, cut editing, and assembly. WebSocket for real-time progress.

**Tech Stack:** Python/FastAPI, yt-dlp, ffmpeg/pydub, React/TypeScript/Vite, Tailwind CSS, wavesurfer.js, Zustand, React Router, @dnd-kit

---

## Phase 1: Backend Foundation

### Task 1: Project scaffolding and backend setup

**Files:**
- Create: `backend/main.py`
- Create: `backend/requirements.txt`
- Create: `backend/models/schemas.py`
- Create: `backend/storage/manager.py`
- Create: `data/.gitkeep`

- [ ] **Step 1: Create `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
yt-dlp==2024.12.23
pydub==0.25.1
python-multipart==0.0.9
websockets==13.0
aiofiles==24.1.0
```

- [ ] **Step 2: Create `backend/models/schemas.py`**

Pydantic models for: DownloadRequest (url, format), FileInfo (id, name, source_url, path, type, duration, created_at), CutInfo (id, file_id, start, end, name), ExportRequest (cuts list, mode merge/separate, format, quality), ExportStatus.

- [ ] **Step 3: Create `backend/storage/manager.py`**

StorageManager class:
- `__init__`: creates `data/` dirs (downloads, exports, temp), loads/creates `data/projects.json`
- `add_file(file_info)`: adds to projects.json
- `get_files()`: returns all files
- `get_file(id)`: returns single file
- `delete_file(id)`: removes file + entry
- `save()`: writes projects.json

- [ ] **Step 4: Create `backend/main.py`**

FastAPI app with CORS middleware (allow all origins for dev), mount routers (added in later tasks), startup event to init StorageManager.

- [ ] **Step 5: Install deps and verify server starts**

```bash
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- [ ] **Step 6: Commit**

```bash
git init && git add -A && git commit -m "feat: backend scaffolding with FastAPI, models, storage manager"
```

---

### Task 2: Download router + yt-dlp service

**Files:**
- Create: `backend/services/downloader.py`
- Create: `backend/routers/downloads.py`
- Create: `backend/ws/progress.py`

- [ ] **Step 1: Create `backend/services/downloader.py`**

DownloaderService class:
- `download(url, format, progress_callback)`: runs yt-dlp as subprocess, parses progress output, calls callback with (percent, speed, eta). Saves to `data/downloads/`. Returns file path + metadata (title, duration).
- Audio: `yt-dlp -x --audio-format mp3 --audio-quality 0`
- Video: `yt-dlp -f bestvideo+bestaudio --merge-output-format mp4`
- Uses `--progress-template` for parseable progress output.

- [ ] **Step 2: Create `backend/ws/progress.py`**

WebSocket manager:
- Dict of `download_id -> set of websocket connections`
- `connect(download_id, ws)`, `disconnect(download_id, ws)`, `broadcast(download_id, data)`

- [ ] **Step 3: Create `backend/routers/downloads.py`**

Endpoints:
- `POST /api/download`: validates URL, creates download ID (uuid4), starts download in background task, returns {id, status: "started"}
- `GET /api/downloads`: returns list from storage manager
- `DELETE /api/downloads/{id}`: deletes file + storage entry
- `WebSocket /ws/download/{id}`: connects to progress manager, sends JSON messages {percent, speed, eta, status}

- [ ] **Step 4: Wire router into main.py**

- [ ] **Step 5: Test manually with a short YouTube video**

```bash
curl -X POST http://localhost:8000/api/download -H "Content-Type: application/json" -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "format": "audio"}'
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: download router with yt-dlp service and WebSocket progress"
```

---

### Task 3: Files router + upload

**Files:**
- Create: `backend/routers/files.py`
- Create: `backend/services/audio_processor.py`

- [ ] **Step 1: Create `backend/services/audio_processor.py`**

AudioProcessor class:
- `generate_waveform_peaks(file_path, num_peaks=800)`: uses ffmpeg to extract audio samples, downsamples to peaks array. Returns list of floats.
- `cut(file_path, start, end, output_path)`: uses pydub to slice audio
- `merge(file_paths, output_path, fade_ms=0)`: concatenates audio files with optional crossfade
- `convert(file_path, format, quality, output_path)`: converts using pydub/ffmpeg
- `get_duration(file_path)`: returns duration in seconds

- [ ] **Step 2: Create `backend/routers/files.py`**

Endpoints:
- `GET /api/files`: list all files from storage
- `POST /api/files/upload`: accept multipart file upload, save to `data/downloads/`, add to storage, return FileInfo
- `DELETE /api/files/{id}`: delete file
- `GET /api/files/{id}/waveform`: generate and return waveform peaks (cache in `data/temp/`)

- [ ] **Step 3: Wire router into main.py**

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: files router with upload, waveform generation, audio processor"
```

---

### Task 4: Export router + video processor

**Files:**
- Create: `backend/routers/exports.py`
- Create: `backend/services/video_processor.py`

- [ ] **Step 1: Create `backend/services/video_processor.py`**

VideoProcessor class:
- `cut(file_path, start, end, output_path)`: uses ffmpeg subprocess for video cutting (stream copy for speed: `-ss start -to end -c copy`)
- `merge(file_paths, output_path)`: ffmpeg concat demuxer
- `get_duration(file_path)`: ffprobe duration

- [ ] **Step 2: Create `backend/routers/exports.py`**

Endpoints:
- `POST /api/cuts/preview`: takes file_id, start, end. Cuts a segment, returns file response for preview playback
- `POST /api/export`: takes ExportRequest. Background task: cut each segment, merge if mode=merge, convert to target format. Stores export in storage. Returns {id, status: "processing"}
- `GET /api/export/{id}/status`: returns export status
- `GET /api/export/{id}/download`: returns FileResponse for completed export

- [ ] **Step 3: Wire router into main.py**

- [ ] **Step 4: Test export manually**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: export router with cut, merge, convert, video processor"
```

---

## Phase 2: Frontend Foundation

### Task 5: Frontend scaffolding

**Files:**
- Create: `frontend/` (Vite project)
- Create: `frontend/src/styles/globals.css`
- Create: `frontend/tailwind.config.js`

- [ ] **Step 1: Scaffold Vite + React + TypeScript project**

```bash
cd /home/ocb/Documents/youtube-mp3
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install react-router-dom zustand wavesurfer.js lucide-react @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Configure Tailwind**

Setup `globals.css` with Tailwind directives and custom CSS variables for the color palette (#1a1a2e, #16213e, #e94560, #53d8fb).

- [ ] **Step 3: Configure Vite proxy**

In `vite.config.ts`, add proxy: `/api` and `/ws` → `http://localhost:8000`

- [ ] **Step 4: Create basic App.tsx with React Router**

Three routes: `/` (DownloadPage), `/editor` (EditorPage), `/library` (LibraryPage). Top navigation bar with tabs.

- [ ] **Step 5: Create placeholder pages**

Minimal DownloadPage.tsx, EditorPage.tsx, LibraryPage.tsx with just a title.

- [ ] **Step 6: Verify dev server runs**

```bash
npm run dev
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: frontend scaffolding with Vite, React, Tailwind, routing"
```

---

### Task 6: Navigation bar and layout

**Files:**
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/Navbar.tsx`

- [ ] **Step 1: Create Navbar component**

Top bar with app title/logo, 3 tab links (Download, Editor, Library) using React Router NavLink. Active tab highlighted with accent color. Modern style: glass-morphism or gradient background, rounded tabs.

- [ ] **Step 2: Create Layout component**

Wraps pages with Navbar + main content area. Full height, dark background.

- [ ] **Step 3: Update App.tsx to use Layout**

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: navigation bar and layout with modern colored design"
```

---

## Phase 3: Download Feature

### Task 7: Download page

**Files:**
- Create: `frontend/src/pages/DownloadPage.tsx`
- Create: `frontend/src/components/DownloadCard.tsx`
- Create: `frontend/src/hooks/useWebSocket.ts`

- [ ] **Step 1: Create useWebSocket hook**

Generic hook: `useWebSocket(url)` → returns { data, status, connect, disconnect }. Auto-reconnect on disconnect. Parses JSON messages.

- [ ] **Step 2: Create DownloadCard component**

Shows a single download: title, progress bar (animated gradient), speed, ETA, status badge (downloading/completed/error). Click to open in editor when complete.

- [ ] **Step 3: Create DownloadPage**

- URL input with paste button and format selector (Audio/Video toggle)
- Big "Download" button with accent gradient
- List of DownloadCards below
- Each card uses WebSocket for real-time progress
- Completed downloads show "Open in Editor" button (navigates to `/editor?file={id}`)

- [ ] **Step 4: Test end-to-end download flow**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: download page with real-time progress"
```

---

## Phase 4: Editor — Core

### Task 8: Waveform component

**Files:**
- Create: `frontend/src/components/Waveform.tsx`

- [ ] **Step 1: Create Waveform component**

Props: fileId, peaks (float array), cuts (array), onCutChange, onTimeUpdate.
- Initialize wavesurfer.js instance with custom colors (cyan→violet gradient, magenta cursor)
- Load peaks from API
- Render regions for each cut (colored, semi-transparent, draggable edges)
- Zoom controls (slider or +/- buttons)
- Click to seek, region drag to adjust cut boundaries
- Emit events: onRegionUpdate (when drag ends), onTimeUpdate (playback position)

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: waveform component with wavesurfer.js, regions, zoom"
```

---

### Task 9: Video player component

**Files:**
- Create: `frontend/src/components/VideoPlayer.tsx`

- [ ] **Step 1: Create VideoPlayer component**

Props: fileUrl, cuts, onTimeUpdate.
- HTML5 video element with custom controls (play/pause, volume, speed, fullscreen)
- Timeline bar below with colored cut regions (simplified, no waveform)
- Click on timeline to seek
- Sync playback position with parent

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: video player component with timeline and cut regions"
```

---

### Task 10: Editor store (Zustand)

**Files:**
- Create: `frontend/src/stores/editorStore.ts`

- [ ] **Step 1: Create editorStore**

State:
- `files`: map of open files (id → FileInfo + peaks)
- `activeFileId`: currently displayed file
- `cuts`: map of file_id → array of CutInfo
- `assemblyCuts`: ordered array of {file_id, cut_id} for assembly mode
- `isPlaying`, `currentTime`, `volume`, `playbackRate`

Actions:
- `loadFile(id)`: fetch file info + waveform peaks from API
- `addCut(file_id, start, end, name?)`: add cut
- `updateCut(cut_id, updates)`: update start/end/name
- `removeCut(cut_id)`: delete cut
- `reorderCuts(file_id, newOrder)`: reorder
- `addToAssembly(file_id, cut_id)`: add cut to assembly
- `removeFromAssembly(index)`: remove from assembly
- `reorderAssembly(newOrder)`: reorder assembly
- `undo()`: undo last action (simple history stack)

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: editor Zustand store with cuts, assembly, undo"
```

---

### Task 11: Cut panel component

**Files:**
- Create: `frontend/src/components/CutPanel.tsx`
- Create: `frontend/src/components/CutCard.tsx`

- [ ] **Step 1: Create CutCard component**

Single cut display:
- Color indicator (matches waveform region color)
- Start/end timestamps as editable inputs (mm:ss.ms format)
- Optional name field
- Play preview button (plays just that segment)
- Delete button
- Drag handle for reordering

- [ ] **Step 2: Create CutPanel component**

- List of CutCards for the active file
- "Add Cut" button (creates a new cut at current playback position ± 5s)
- Drag & drop reordering with @dnd-kit
- Connected to editorStore

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: cut panel with editable timestamps, drag reorder"
```

---

### Task 12: Editor page assembly

**Files:**
- Modify: `frontend/src/pages/EditorPage.tsx`
- Create: `frontend/src/hooks/useAudioEditor.ts`

- [ ] **Step 1: Create useAudioEditor hook**

Orchestration hook:
- Loads file from URL query param (`?file={id}`)
- Manages play/pause/seek via wavesurfer ref or video element ref
- Keyboard shortcuts: Space, I, O, Delete, Ctrl+Z
- Coordinates between waveform/video, cut panel, and store

- [ ] **Step 2: Build EditorPage layout**

Layout:
- Top: Waveform (if audio) or VideoPlayer (if video)
- Playback controls bar: play/pause, time display, volume, speed selector
- Right side or below: CutPanel
- Bottom: Assembly timeline (Task 13)
- Conditional rendering based on file type

- [ ] **Step 3: Test full editor flow**

Load a downloaded file, see waveform, create cuts, adjust, preview.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: editor page with waveform, playback controls, cut panel"
```

---

## Phase 5: Assembly and Export

### Task 13: Assembly timeline

**Files:**
- Create: `frontend/src/components/AssemblyTimeline.tsx`

- [ ] **Step 1: Create AssemblyTimeline component**

- Horizontal zone at bottom of editor
- Shows assembly cuts as colored blocks (file name + cut name + duration)
- Drag cuts from CutPanel into assembly (cross-component DnD)
- Drag to reorder within assembly
- Preview button: plays all cuts in sequence
- Total duration display
- Clear all button

- [ ] **Step 2: Integrate into EditorPage**

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: assembly timeline with cross-file drag and drop"
```

---

### Task 14: Export modal

**Files:**
- Create: `frontend/src/components/ExportModal.tsx`

- [ ] **Step 1: Create ExportModal component**

Modal dialog:
- Mode selector: "Export cuts separately" / "Merge into one file"
- Format dropdown: MP3, WAV, FLAC, OGG
- Quality selector (for MP3: 128, 192, 256, 320 kbps)
- Fade in/out toggle + duration (ms) for merge mode
- Summary: list of cuts to export with total duration
- Export button → calls API, shows progress
- Download button when complete

- [ ] **Step 2: Add export buttons to CutPanel and AssemblyTimeline**

- "Export selected" on CutPanel
- "Export assembly" on AssemblyTimeline
- Both open ExportModal with appropriate cuts

- [ ] **Step 3: Test full export flow**

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: export modal with format selection, progress, download"
```

---

## Phase 6: Library

### Task 15: Library page

**Files:**
- Modify: `frontend/src/pages/LibraryPage.tsx`

- [ ] **Step 1: Build LibraryPage**

- Grid/list view of all files (toggle)
- Each card: thumbnail (for video) or waveform mini-preview (for audio), title, duration, source, date
- Actions: Open in Editor, Delete, Rename
- Upload button: drag & drop zone + file picker for local files
- Search/filter bar

- [ ] **Step 2: Implement file upload**

Drag & drop zone or click to select. Calls `POST /api/files/upload`. Progress bar during upload.

- [ ] **Step 3: Test library flow**

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: library page with file grid, upload, search"
```

---

## Phase 7: Polish

### Task 16: Error handling and edge cases

- [ ] **Step 1: Backend error handling**

- Invalid YouTube URLs → clear error message
- yt-dlp failures → error status on download
- ffmpeg failures → error status on export
- File not found → 404 responses
- Concurrent access to projects.json → file lock

- [ ] **Step 2: Frontend error handling**

- Toast notifications for errors (download failed, export failed, upload failed)
- Loading states / skeletons for all async operations
- Empty states (no downloads yet, no files, no cuts)
- WebSocket reconnection on disconnect

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: error handling, loading states, toast notifications"
```

---

### Task 17: Final polish and startup script

- [ ] **Step 1: Create start script**

Create `start.sh`:
- Checks for python, node, ffmpeg, yt-dlp
- Installs backend deps if needed
- Installs frontend deps if needed
- Starts backend (uvicorn) and frontend (vite dev) concurrently
- In production mode: builds frontend, serves static files from FastAPI

- [ ] **Step 2: Update backend to serve frontend build**

In `main.py`, mount `frontend/dist` as static files when the directory exists (production mode).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: start script, production static file serving"
```
