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
    setPlaying,
  } = useAudioEditor()

  const updateCut = useEditorStore((s) => s.updateCut)

  const handleCutUpdate = useCallback(
    (cutId: string, start: number, end: number) => {
      if (file) {
        updateCut(file.id, cutId, { start, end })
      }
    },
    [file, updateCut]
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
        <Loader2
          size={40}
          className="animate-spin mb-4"
          style={{ color: 'var(--accent-secondary)' }}
        />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading...
        </p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div
          className="px-4 py-3 rounded-xl text-sm mb-4"
          style={{
            background: 'rgba(233, 69, 96, 0.1)',
            color: 'var(--accent-primary)',
            border: '1px solid rgba(233, 69, 96, 0.2)',
          }}
        >
          {error}
        </div>
        <button
          onClick={() => navigate('/library')}
          className="text-sm underline"
          style={{ color: 'var(--accent-secondary)' }}
        >
          Go to Library
        </button>
      </div>
    )
  }

  // No file state
  if (!fileId || !file) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <FileAudio
          size={56}
          className="mb-6 opacity-20"
          style={{ color: 'var(--text-secondary)' }}
        />
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          No File Selected
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Open a file from the Library or download one first
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, var(--accent-primary), #c23152)',
              color: 'white',
            }}
          >
            <Download size={16} />
            Download
          </button>
          <button
            onClick={() => navigate('/library')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/10"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--accent-secondary)',
              border: '1px solid rgba(83, 216, 251, 0.2)',
            }}
          >
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
    <div className="flex flex-col gap-4 -mx-6 -my-8 px-4 py-4 min-h-[calc(100vh-64px)]">
      {/* File name header */}
      <div className="flex items-center gap-3 px-2">
        <FileAudio size={18} style={{ color: 'var(--accent-secondary)' }} />
        <h1 className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {file.name}
        </h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{
          background: 'rgba(255, 255, 255, 0.05)',
          color: 'var(--text-secondary)',
        }}>
          {file.type.toUpperCase()}
        </span>
      </div>

      {/* Main content area */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Media + Controls (70%) */}
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
              onSeek={handleSeek}
            />
          )}

          {/* Controls bar */}
          <div
            className="flex items-center gap-4 px-4 py-3 rounded-xl"
            style={{
              background: 'rgba(22, 33, 62, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="flex items-center justify-center w-10 h-10 rounded-full transition-all hover:brightness-110 hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, var(--accent-primary), #c23152)',
                color: 'white',
              }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>

            {/* Time display */}
            <div className="font-mono text-sm tabular-nums" style={{ color: 'var(--text-primary)' }}>
              <span style={{ color: 'var(--accent-secondary)' }}>{formatTime(currentTime)}</span>
              <span style={{ color: 'var(--text-secondary)' }}> / {formatTime(file.duration)}</span>
            </div>

            <div className="flex-1" />

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVolume(isMuted ? 0.8 : 0)}
                className="p-1.5 rounded-lg transition-all hover:bg-white/10"
                style={{ color: 'var(--text-secondary)' }}
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
                  background: `linear-gradient(to right, var(--accent-secondary) ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`,
                }}
              />
            </div>

            {/* Speed selector */}
            <div className="flex items-center gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackRate(s)}
                  className="px-2 py-1 rounded-md text-[11px] font-medium transition-all"
                  style={{
                    background: playbackRate === s
                      ? 'var(--accent-secondary)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: playbackRate === s ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Keyboard hints */}
          <div className="flex items-center gap-4 px-2">
            {[
              { key: 'Space', action: 'Play/Pause' },
              { key: 'I', action: 'Mark In' },
              { key: 'O', action: 'Mark Out' },
              { key: 'Ctrl+Z', action: 'Undo' },
            ].map(({ key, action }) => (
              <span key={key} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>
                <kbd
                  className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  {key}
                </kbd>
                {action}
              </span>
            ))}
          </div>
        </div>

        {/* Right: Cut Panel (30%) */}
        <div className="flex-[3] min-w-[280px] max-w-[380px]">
          <CutPanel fileId={file.id} waveformRef={waveformRef} />
        </div>
      </div>

      {/* Bottom: Assembly Timeline */}
      <AssemblyTimeline />
    </div>
  )
}
