import { useState, useCallback, useEffect, useRef } from 'react'
import { X, Download, Check, Loader2, Music } from 'lucide-react'

interface ExportCut {
  fileId: string
  start: number
  end: number
}

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  cuts: ExportCut[]
  mode?: 'separate' | 'merge'
}

type Format = 'mp3' | 'wav' | 'flac' | 'ogg'
type ExportStatus = 'idle' | 'exporting' | 'done' | 'error'

const FORMATS: { value: Format; label: string }[] = [
  { value: 'mp3', label: 'MP3' },
  { value: 'wav', label: 'WAV' },
  { value: 'flac', label: 'FLAC' },
  { value: 'ogg', label: 'OGG' },
]

const BITRATES = [128, 192, 256, 320]

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function ExportModal({
  isOpen,
  onClose,
  cuts,
  mode: initialMode = 'separate',
}: ExportModalProps) {
  const [exportMode, setExportMode] = useState<'separate' | 'merge'>(initialMode)
  const [format, setFormat] = useState<Format>('mp3')
  const [bitrate, setBitrate] = useState(320)
  const [fadeEnabled, setFadeEnabled] = useState(false)
  const [fadeDuration, setFadeDuration] = useState(500)
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [exportId, setExportId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStatus('idle')
      setProgress(0)
      setExportId(null)
      setErrorMessage('')
      setExportMode(initialMode)
    }
  }, [isOpen, initialMode])

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const totalDuration = cuts.reduce((sum, c) => sum + Math.max(0, c.end - c.start), 0)

  const handleExport = useCallback(async () => {
    setStatus('exporting')
    setProgress(0)
    setErrorMessage('')

    try {
      const body = {
        cuts: cuts.map((c) => ({
          file_id: c.fileId,
          start: c.start,
          end: c.end,
        })),
        mode: exportMode,
        format,
        quality: bitrate,
        fade: fadeEnabled && exportMode === 'merge' ? fadeDuration : 0,
      }

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        throw new Error('Export request failed')
      }

      const data = await res.json()
      const eid = data.id ?? data.export_id
      setExportId(eid)

      // Poll for status
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/export/${eid}/status`)
          if (!statusRes.ok) throw new Error('Status check failed')
          const statusData = await statusRes.json()

          setProgress(statusData.progress ?? 0)

          if (statusData.status === 'done' || statusData.status === 'completed') {
            setStatus('done')
            setProgress(100)
            if (pollRef.current) clearInterval(pollRef.current)
          } else if (statusData.status === 'error' || statusData.status === 'failed') {
            setStatus('error')
            setErrorMessage(statusData.message ?? 'Export failed')
            if (pollRef.current) clearInterval(pollRef.current)
          }
        } catch {
          // continue polling
        }
      }, 1000)
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Export failed')
    }
  }, [cuts, exportMode, format, bitrate, fadeEnabled, fadeDuration])

  const handleDownload = useCallback(() => {
    if (!exportId) return
    window.open(`/api/export/${exportId}/download`, '_blank')
  }, [exportId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(22, 33, 62, 0.95) 0%, rgba(26, 26, 46, 0.98) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Music size={18} style={{ color: 'var(--accent-primary)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Export Audio
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all hover:bg-white/10"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Mode toggle */}
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
              Export Mode
            </label>
            <div
              className="flex rounded-lg overflow-hidden"
              style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
            >
              {(['separate', 'merge'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setExportMode(m)}
                  className="flex-1 py-2 text-xs font-medium transition-all"
                  style={{
                    background: exportMode === m
                      ? 'linear-gradient(135deg, var(--accent-primary), #c23152)'
                      : 'rgba(255, 255, 255, 0.03)',
                    color: exportMode === m ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {m === 'separate' ? 'Export Separately' : 'Merge into One'}
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
              Format
            </label>
            <div className="flex gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: format === f.value
                      ? 'var(--accent-secondary)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: format === f.value ? 'var(--bg-primary)' : 'var(--text-secondary)',
                    border: `1px solid ${format === f.value ? 'var(--accent-secondary)' : 'rgba(255, 255, 255, 0.08)'}`,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bitrate (MP3 only) */}
          {format === 'mp3' && (
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                Quality (kbps)
              </label>
              <div className="flex gap-2">
                {BITRATES.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBitrate(b)}
                    className="flex-1 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: bitrate === b
                        ? 'var(--accent-primary)'
                        : 'rgba(255, 255, 255, 0.05)',
                      color: bitrate === b ? 'white' : 'var(--text-secondary)',
                      border: `1px solid ${bitrate === b ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)'}`,
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fade (merge only) */}
          {exportMode === 'merge' && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  className="relative w-9 h-5 rounded-full transition-all cursor-pointer"
                  style={{
                    background: fadeEnabled ? 'var(--accent-secondary)' : 'rgba(255, 255, 255, 0.1)',
                  }}
                  onClick={() => setFadeEnabled(!fadeEnabled)}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                    style={{
                      left: fadeEnabled ? '18px' : '2px',
                      background: fadeEnabled ? 'white' : 'var(--text-secondary)',
                    }}
                  />
                </div>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Crossfade
                </span>
              </label>
              {fadeEnabled && (
                <input
                  type="number"
                  value={fadeDuration}
                  onChange={(e) => setFadeDuration(Number(e.target.value))}
                  min={50}
                  max={5000}
                  step={50}
                  className="w-20 px-2 py-1 rounded-lg text-xs text-center font-mono"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                  placeholder="ms"
                />
              )}
              {fadeEnabled && (
                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>ms</span>
              )}
            </div>
          )}

          {/* Summary */}
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded-lg"
            style={{ background: 'rgba(255, 255, 255, 0.03)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {cuts.length} cut{cuts.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--accent-secondary)' }}>
              {formatDuration(totalDuration)} total
            </span>
          </div>

          {/* Progress bar */}
          {status === 'exporting' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Exporting...
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--accent-secondary)' }}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: 'rgba(255, 255, 255, 0.05)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                  }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div
              className="px-3 py-2 rounded-lg text-xs"
              style={{
                background: 'rgba(233, 69, 96, 0.1)',
                color: 'var(--accent-primary)',
                border: '1px solid rgba(233, 69, 96, 0.2)',
              }}
            >
              {errorMessage || 'Export failed. Please try again.'}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {status === 'done' ? (
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                style={{
                  background: 'linear-gradient(135deg, #7ed321, #50e3c2)',
                  color: 'white',
                }}
              >
                <Check size={16} />
                Download
              </button>
            ) : status === 'exporting' ? (
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold opacity-60 cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  color: 'white',
                }}
              >
                <Loader2 size={16} className="animate-spin" />
                Exporting...
              </button>
            ) : (
              <button
                onClick={handleExport}
                disabled={cuts.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  color: 'white',
                }}
              >
                <Download size={16} />
                Export
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
