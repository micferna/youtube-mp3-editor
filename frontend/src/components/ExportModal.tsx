import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, Check, Loader2, Music } from 'lucide-react'
import Modal from './Modal'

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

  useEffect(() => {
    if (isOpen) {
      setStatus('idle')
      setProgress(0)
      setExportId(null)
      setErrorMessage('')
      setExportMode(initialMode)
    }
  }, [isOpen, initialMode])

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
        cuts: cuts.map((c) => ({ file_id: c.fileId, start: c.start, end: c.end })),
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
      if (!res.ok) throw new Error('Export request failed')

      const data = await res.json()
      const eid = data.id ?? data.export_id
      setExportId(eid)

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export audio" icon={<Music size={17} />}>
      <div className="space-y-5">
        {/* Mode */}
        <div>
          <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--muted)' }}>
            Mode
          </label>
          <div className="u-seg w-full">
            {(['separate', 'merge'] as const).map((m) => (
              <button
                key={m}
                data-active={exportMode === m}
                onClick={() => setExportMode(m)}
                className="u-seg-item flex-1 justify-center"
              >
                {m === 'separate' ? 'Separate files' : 'Merge into one'}
              </button>
            ))}
          </div>
        </div>

        {/* Format */}
        <div>
          <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--muted)' }}>
            Format
          </label>
          <div className="flex gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFormat(f.value)}
                data-active={format === f.value}
                className="u-seg-item flex-1 justify-center"
                style={{
                  background: format === f.value ? 'var(--iris-tint)' : 'var(--paper-2)',
                  color: format === f.value ? 'var(--iris-600)' : 'var(--muted)',
                  border: `1px solid ${format === f.value ? 'var(--iris-200)' : 'var(--line)'}`,
                  boxShadow: 'none',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bitrate */}
        {format === 'mp3' && (
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--muted)' }}>
              Quality <span className="u-mono">(kbps)</span>
            </label>
            <div className="flex gap-2">
              {BITRATES.map((b) => (
                <button
                  key={b}
                  onClick={() => setBitrate(b)}
                  className="u-mono flex-1 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer"
                  style={{
                    background: bitrate === b ? 'var(--iris)' : 'var(--paper-2)',
                    color: bitrate === b ? '#fff' : 'var(--muted)',
                    border: `1px solid ${bitrate === b ? 'var(--iris)' : 'var(--line)'}`,
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fade */}
        {exportMode === 'merge' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFadeEnabled(!fadeEnabled)}
              className="relative w-9 h-5 rounded-full transition-all cursor-pointer flex-shrink-0"
              style={{ background: fadeEnabled ? 'var(--iris)' : 'var(--line-strong)' }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: fadeEnabled ? '18px' : '2px', boxShadow: 'var(--shadow-sm)' }}
              />
            </button>
            <span className="text-xs" style={{ color: 'var(--ink)' }}>Crossfade</span>
            {fadeEnabled && (
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="number"
                  value={fadeDuration}
                  onChange={(e) => setFadeDuration(Number(e.target.value))}
                  min={50}
                  max={5000}
                  step={50}
                  className="u-input u-mono w-20 px-2 py-1 text-xs text-center"
                />
                <span className="u-mono text-[10px]" style={{ color: 'var(--muted)' }}>ms</span>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div
          className="flex items-center justify-between px-3 py-2.5 rounded-[10px]"
          style={{ background: 'var(--paper-2)' }}
        >
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {cuts.length} cut{cuts.length !== 1 ? 's' : ''}
          </span>
          <span className="u-mono text-xs" style={{ color: 'var(--iris-600)' }}>
            {formatDuration(totalDuration)} total
          </span>
        </div>

        {/* Progress */}
        {status === 'exporting' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Exporting…</span>
              <span className="u-mono text-xs" style={{ color: 'var(--iris-600)' }}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--paper-2)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'var(--iris)' }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div
            className="px-3 py-2 rounded-[10px] text-xs"
            style={{ background: 'var(--danger-tint)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.2)' }}
          >
            {errorMessage || 'Export failed. Please try again.'}
          </div>
        )}

        {/* Action */}
        {status === 'done' ? (
          <button onClick={handleDownload} className="u-btn w-full h-11" style={{ background: 'var(--ok)', color: '#fff' }}>
            <Check size={16} />
            Download
          </button>
        ) : (
          <button
            onClick={handleExport}
            disabled={cuts.length === 0 || status === 'exporting'}
            className="u-btn u-btn-primary w-full h-11"
          >
            {status === 'exporting' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {status === 'exporting' ? 'Exporting…' : 'Export'}
          </button>
        )}
      </div>
    </Modal>
  )
}
