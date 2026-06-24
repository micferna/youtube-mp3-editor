import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Loader2,
  FileAudio,
  Download,
  Library,
} from 'lucide-react'
import { useAudioEditor } from '../hooks/useAudioEditor'
import Waveform from '../components/Waveform'
import VideoPlayer from '../components/VideoPlayer'
import CutPanel from '../components/CutPanel'
import AssemblyTimeline from '../components/AssemblyTimeline'
import { useEditorStore } from '../stores/editorStore'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 100)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

export default function EditorPage() {
  const navigate = useNavigate()
  const {
    fileId,
    file,
    cuts,
    isLoading,
    error,
    isPlaying,
    currentTime,
    volume,
    playbackRate,
    waveformRef,
    togglePlay,
    handleSeek,
    handleTimeUpdate,
    setVolume,
    setPlaybackRate,
  } = useAudioEditor()

  const handleCutUpdate = useCallback(
    (cutId: string, start: number, end: number) => {
      if (file) {
        useEditorStore.getState().updateCut(file.id, cutId, { start, end })
      }
    },
    [file]
  )

  const handleVolumeChange = useCallback(
    (val: number) => {
      setVolume(val)
    },
    [setVolume]
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin mb-4" style={{ color: 'var(--iris)' }} />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div
          className="px-4 py-3 rounded-[10px] text-sm mb-4"
          style={{ background: 'var(--danger-tint)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.2)' }}
        >
          {error}
        </div>
        <button onClick={() => navigate('/library')} className="u-btn u-btn-ghost h-9 px-4">
          Go to Library
        </button>
      </div>
    )
  }

  // No file state
  if (!fileId || !file) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <FileAudio size={44} className="mb-5" style={{ color: 'var(--faint)' }} />
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--ink)' }}>
          No file selected
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          Open a file from the Library, or download one first.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="u-btn u-btn-primary h-10 px-5">
            <Download size={16} />
            Download
          </button>
          <button onClick={() => navigate('/library')} className="u-btn u-btn-ghost h-10 px-5">
            <Library size={16} />
            Library
          </button>
        </div>
      </div>
    )
  }

  const isVideo = file.type === 'video'
  const isMuted = volume === 0

  return (
    <div className="flex flex-col gap-4 min-h-[calc(100vh-9rem)] fade-up">
      {/* File name header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-[9px]" style={{ background: 'var(--iris-tint)' }}>
          <FileAudio size={16} style={{ color: 'var(--iris)' }} />
        </div>
        <h1 className="text-base font-semibold truncate tracking-tight" style={{ color: 'var(--ink)' }}>
          {file.name}
        </h1>
        <span className="u-badge u-mono" style={{ background: 'var(--paper-2)', color: 'var(--muted)' }}>
          {file.type.toUpperCase()}
        </span>
      </div>

      {/* Main content area */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Left: Media + Controls */}
        <div className="flex-[7] flex flex-col gap-3 min-w-0">
          {/* Media player */}
          {isVideo ? (
            <VideoPlayer
              fileUrl={`/api/files/${file.id}/stream`}
              cuts={cuts}
              currentTime={currentTime}
              onTimeUpdate={handleTimeUpdate}
              onSeek={handleSeek}
            />
          ) : (
            <Waveform
              ref={waveformRef}
              fileId={file.id}
              peaks={file.peaks}
              cuts={cuts}
              onCutUpdate={handleCutUpdate}
              onTimeUpdate={handleTimeUpdate}
            />
          )}

          {/* Controls bar */}
          <div className="u-card flex items-center gap-4 px-4 py-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="flex items-center justify-center w-10 h-10 rounded-full transition-all hover:-translate-y-0.5 flex-shrink-0"
              style={{ background: 'var(--iris)', color: '#fff', boxShadow: '0 6px 18px rgba(79,70,229,.28)' }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>

            {/* Time display */}
            <div className="u-mono text-sm">
              <span style={{ color: 'var(--iris-600)' }}>{formatTime(currentTime)}</span>
              <span style={{ color: 'var(--faint)' }}> / {formatTime(file.duration)}</span>
            </div>

            <div className="flex-1" />

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVolume(isMuted ? 0.8 : 0)}
                className="u-btn u-btn-quiet h-8 w-8 p-0"
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-20 h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--iris) ${volume * 100}%, var(--line) ${volume * 100}%)`,
                }}
              />
            </div>

            {/* Speed selector */}
            <div className="u-seg hidden sm:inline-flex">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackRate(s)}
                  data-active={playbackRate === s}
                  className="u-seg-item u-mono px-2 py-1 text-[11px]"
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Keyboard hints */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
            {[
              { key: 'Space', action: 'Play / Pause' },
              { key: 'I', action: 'Mark in' },
              { key: 'O', action: 'Mark out' },
              { key: 'Ctrl+Z', action: 'Undo' },
            ].map(({ key, action }) => (
              <span key={key} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>
                <kbd
                  className="u-mono px-1.5 py-0.5 rounded-[6px] text-[10px]"
                  style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                >
                  {key}
                </kbd>
                {action}
              </span>
            ))}
          </div>
        </div>

        {/* Right: Cut Panel */}
        <div className="lg:flex-[3] w-full lg:min-w-[280px] lg:max-w-[380px]">
          <CutPanel fileId={file.id} waveformRef={waveformRef} />
        </div>
      </div>

      {/* Bottom: Assembly Timeline */}
      <AssemblyTimeline />
    </div>
  )
}
