import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Scissors,
  Download,
  Clock,
} from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocket'

export interface DownloadItem {
  id: string
  name: string
  title?: string
  status: 'downloading' | 'completed' | 'error' | 'queued'
  progress: number
  speed?: string
  eta?: string
  format: 'audio' | 'video'
  file_id?: string
  error?: string
}

interface DownloadCardProps {
  download: DownloadItem
  onUpdate: (id: string, data: Partial<DownloadItem>) => void
  onDelete: (id: string) => void
}

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`

const TONE = {
  downloading: { fg: 'var(--iris-600)', bg: 'var(--iris-tint)' },
  queued: { fg: 'var(--muted)', bg: 'var(--paper-2)' },
  completed: { fg: 'var(--ok)', bg: 'var(--ok-tint)' },
  error: { fg: 'var(--danger)', bg: 'var(--danger-tint)' },
} as const

export default function DownloadCard({ download, onUpdate, onDelete }: DownloadCardProps) {
  const navigate = useNavigate()

  const wsUrl =
    download.status === 'downloading' || download.status === 'queued'
      ? `${WS_BASE}/ws/download/${download.id}`
      : null

  const { lastMessage } = useWebSocket(wsUrl, {
    onMessage: (data) => {
      if (data && typeof data === 'object') {
        onUpdate(download.id, data)
      }
    },
    autoReconnect: true,
    reconnectInterval: 2000,
  })

  useEffect(() => {
    if (lastMessage && typeof lastMessage === 'object') {
      onUpdate(download.id, lastMessage)
    }
  }, [lastMessage]) // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = download.status === 'downloading' || download.status === 'queued'
  const tone = TONE[download.status]

  const statusIcon = () => {
    switch (download.status) {
      case 'downloading':
      case 'queued':
        return <Loader2 size={18} className="animate-spin" style={{ color: tone.fg }} />
      case 'completed':
        return <CheckCircle2 size={18} style={{ color: tone.fg }} />
      case 'error':
        return <XCircle size={18} style={{ color: tone.fg }} />
    }
  }

  const statusLabel = {
    downloading: 'Downloading',
    queued: 'Queued',
    completed: 'Ready',
    error: 'Failed',
  }[download.status]

  return (
    <div
      className="group u-card p-3.5 transition-all duration-200 hover:shadow-[var(--shadow)]"
      style={{ ['--tw-shadow-color' as string]: 'transparent' }}
    >
      <div className="flex items-center gap-3.5">
        {/* Status icon */}
        <div
          className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-[10px]"
          style={{ background: tone.bg }}
        >
          {statusIcon()}
        </div>

        {/* Center */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-sm font-medium truncate"
              style={{ color: 'var(--ink)' }}
              title={download.name || download.title}
            >
              {download.name || download.title}
            </span>
            <span
              className="u-badge flex-shrink-0"
              style={{ background: tone.bg, color: tone.fg }}
            >
              {statusLabel}
            </span>
          </div>

          {/* Progress (active) or meta (done) */}
          {isActive ? (
            <>
              <div
                className="relative h-1.5 rounded-full overflow-hidden"
                style={{ background: 'var(--paper-2)' }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(download.progress, 100)}%`,
                    background: 'var(--iris)',
                  }}
                />
              </div>
              <div className="flex items-center gap-3 mt-1.5 u-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                <span style={{ color: 'var(--iris-600)' }}>{download.progress.toFixed(1)}%</span>
                {download.speed && <span>{download.speed}</span>}
                {download.eta && (
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> {download.eta}
                  </span>
                )}
              </div>
            </>
          ) : download.status === 'error' ? (
            <p className="text-[11px] leading-snug line-clamp-2" style={{ color: 'var(--danger)' }}>
              {download.error || 'Download failed.'}
            </p>
          ) : (
            <span className="u-mono text-[11px] uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
              {download.format}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {download.status === 'completed' && (
            <>
              <a
                href={`/api/files/${download.file_id || download.id}/stream`}
                download
                className="u-btn u-btn-ghost h-8 px-2.5 text-xs"
                title="Save to disk"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Save</span>
              </a>
              <button
                onClick={() => navigate(`/editor?file=${download.file_id || download.id}`)}
                className="u-btn u-btn-primary h-8 px-2.5 text-xs"
                title="Open in editor"
              >
                <Scissors size={14} />
                <span className="hidden sm:inline">Edit</span>
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(download.id)}
            className="u-btn u-btn-quiet h-8 w-8 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            title="Remove"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
