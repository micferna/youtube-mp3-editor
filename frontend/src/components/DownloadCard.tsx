import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  Download,
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

  // Also update if lastMessage changes externally
  useEffect(() => {
    if (lastMessage && typeof lastMessage === 'object') {
      onUpdate(download.id, lastMessage)
    }
  }, [lastMessage]) // eslint-disable-line react-hooks/exhaustive-deps

  const statusIcon = () => {
    switch (download.status) {
      case 'downloading':
      case 'queued':
        return <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-secondary)' }} />
      case 'completed':
        return <CheckCircle2 size={24} style={{ color: '#4ade80' }} />
      case 'error':
        return <XCircle size={24} style={{ color: 'var(--accent-primary)' }} />
    }
  }

  const statusBadge = () => {
    const base = 'px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide'
    switch (download.status) {
      case 'downloading':
        return <span className={base} style={{ background: 'rgba(83, 216, 251, 0.15)', color: 'var(--accent-secondary)' }}>Downloading</span>
      case 'queued':
        return <span className={base} style={{ background: 'rgba(160, 160, 176, 0.15)', color: 'var(--text-secondary)' }}>Queued</span>
      case 'completed':
        return <span className={base} style={{ background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80' }}>Completed</span>
      case 'error':
        return <span className={base} style={{ background: 'rgba(233, 69, 96, 0.15)', color: 'var(--accent-primary)' }}>Error</span>
    }
  }

  const isActive = download.status === 'downloading' || download.status === 'queued'

  return (
    <div
      className="relative flex items-center gap-4 rounded-xl p-4 transition-all duration-300 hover:scale-[1.005]"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Status icon */}
      <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg"
        style={{ background: 'rgba(255, 255, 255, 0.04)' }}
      >
        {statusIcon()}
      </div>

      {/* Center content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="text-sm font-medium truncate"
            style={{ color: 'var(--text-primary)' }}
            title={download.name || download.title}
          >
            {download.name || download.title}
          </span>
          {statusBadge()}
        </div>

        {/* Progress bar */}
        <div
          className="relative h-2 rounded-full overflow-hidden"
          style={{ background: 'rgba(255, 255, 255, 0.06)' }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.min(download.progress, 100)}%`,
              background: download.status === 'error'
                ? 'var(--accent-primary)'
                : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
            }}
          />
          {/* Shimmer overlay when downloading */}
          {isActive && download.progress > 0 && (
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${Math.min(download.progress, 100)}%`,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s ease-in-out infinite',
              }}
            />
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {download.progress.toFixed(1)}%
          </span>
          {download.speed && isActive && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {download.speed}
            </span>
          )}
          {download.eta && isActive && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              ETA: {download.eta}
            </span>
          )}
          {download.error && (
            <span className="text-xs" style={{ color: 'var(--accent-primary)' }}>
              {download.error}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {download.status === 'completed' && (
          <>
            <a
              href={`/api/files/${download.file_id || download.id}/stream`}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, var(--accent-secondary), #2980b9)',
                color: '#fff',
              }}
            >
              <Download size={14} />
              Save
            </a>
            <button
              onClick={() => navigate(`/editor?file=${download.file_id || download.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, var(--accent-primary), #c0392b)',
                color: '#fff',
              }}
            >
              <ExternalLink size={14} />
              Editor
            </button>
          </>
        )}
        <button
          onClick={() => onDelete(download.id)}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 hover:scale-110 cursor-pointer"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Inline keyframes for shimmer */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
}
