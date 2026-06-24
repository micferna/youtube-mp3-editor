import { useState, useEffect, useCallback } from 'react'
import {
  Download,
  Music,
  Video,
  Clipboard,
  Loader2,
  ListMusic,
  Cookie,
} from 'lucide-react'
import DownloadCard, { type DownloadItem } from '../components/DownloadCard'
import CookiesModal from '../components/CookiesModal'

const API_BASE = '/api'

export default function DownloadPage() {
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState<'audio' | 'video'>('audio')
  const [playlist, setPlaylist] = useState(false)
  const [cookiesOpen, setCookiesOpen] = useState(false)
  const [cookiesActive, setCookiesActive] = useState(false)
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load existing downloads + cookie status on mount
  useEffect(() => {
    fetchDownloads()
    fetch(`${API_BASE}/cookies`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCookiesActive(d.present))
      .catch(() => {})
  }, [])

  const fetchDownloads = async () => {
    try {
      setLoadingList(true)
      const res = await fetch(`${API_BASE}/downloads`)
      if (!res.ok) throw new Error('Failed to load downloads')
      const data = await res.json()
      setDownloads(data)
    } catch (err: any) {
      console.error('Failed to fetch downloads:', err)
    } finally {
      setLoadingList(false)
    }
  }

  const handleSubmit = async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, format, playlist }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || body.error || 'Download request failed')
      }

      const newDownload: DownloadItem = await res.json()
      setDownloads((prev) => [newDownload, ...prev])
      setUrl('')
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
    } catch {
      // Clipboard API may fail without permission
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_BASE}/downloads/${id}`, { method: 'DELETE' })
      setDownloads((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      console.error('Failed to delete download:', err)
    }
  }

  const handleUpdate = useCallback((id: string, data: Partial<DownloadItem>) => {
    setDownloads((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...data } : d))
    )
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSubmitting) {
      handleSubmit()
    }
  }

  const activeCount = downloads.filter(
    (d) => d.status === 'downloading' || d.status === 'queued'
  ).length

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Hero section */}
      <div className="text-center mb-10">
        <h1
          className="text-4xl font-bold mb-2"
          style={{
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          YouTube Downloader
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Paste a link, pick a format, and download.
        </p>
      </div>

      {/* Input area */}
      <div
        className="rounded-2xl p-5 mb-4"
        style={{
          background: 'rgba(22, 33, 62, 0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* URL input row */}
        <div className="flex gap-2 mb-4">
          <div
            className="flex-1 flex items-center rounded-xl overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste a YouTube URL..."
              className="flex-1 bg-transparent px-4 py-3 text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              onClick={handlePaste}
              className="flex items-center justify-center px-3 py-3 transition-colors duration-200 cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              title="Paste from clipboard"
            >
              <Clipboard size={18} />
            </button>
          </div>
        </div>

        {/* Playlist toggle + cookies button */}
        <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={() => setPlaylist((p) => !p)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer"
          style={{
            background: playlist ? 'rgba(83, 216, 251, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${playlist ? 'rgba(83, 216, 251, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
            color: playlist ? 'var(--accent-secondary)' : 'var(--text-secondary)',
          }}
          title="When enabled, a playlist URL downloads every video as a separate file"
        >
          <span
            className="flex items-center justify-center w-4 h-4 rounded"
            style={{
              background: playlist ? 'var(--accent-secondary)' : 'transparent',
              border: `1.5px solid ${playlist ? 'var(--accent-secondary)' : 'var(--text-secondary)'}`,
            }}
          >
            {playlist && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0f1629" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
          <ListMusic size={14} />
          Download full playlist
        </button>

          {/* Cookies button */}
          <button
            type="button"
            onClick={() => setCookiesOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--text-secondary)',
            }}
            title="Set YouTube cookies to fix 'confirm you're not a bot' errors"
          >
            <span className="relative flex items-center">
              <Cookie size={14} />
              {cookiesActive && (
                <span
                  className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full"
                  style={{ background: '#4ade80' }}
                />
              )}
            </span>
            Cookies
          </button>
        </div>

        {/* Format toggle + download button row */}
        <div className="flex items-center gap-3">
          {/* Format pill toggle */}
          <div
            className="flex rounded-xl p-1"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <button
              onClick={() => setFormat('audio')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
              style={{
                background:
                  format === 'audio'
                    ? 'linear-gradient(135deg, var(--accent-primary), #c0392b)'
                    : 'transparent',
                color: format === 'audio' ? '#fff' : 'var(--text-secondary)',
                boxShadow:
                  format === 'audio' ? '0 2px 8px rgba(233, 69, 96, 0.35)' : 'none',
              }}
            >
              <Music size={14} />
              Audio
            </button>
            <button
              onClick={() => setFormat('video')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
              style={{
                background:
                  format === 'video'
                    ? 'linear-gradient(135deg, var(--accent-secondary), #2980b9)'
                    : 'transparent',
                color: format === 'video' ? '#fff' : 'var(--text-secondary)',
                boxShadow:
                  format === 'video' ? '0 2px 8px rgba(83, 216, 251, 0.35)' : 'none',
              }}
            >
              <Video size={14} />
              Video
            </button>
          </div>

          {/* Download button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !url.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, var(--accent-primary), #a3243b)',
              color: '#fff',
              boxShadow: !isSubmitting && url.trim()
                ? '0 4px 20px rgba(233, 69, 96, 0.35)'
                : 'none',
            }}
          >
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Download size={18} />
            )}
            {isSubmitting ? 'Starting...' : 'Download'}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div
            className="mt-3 px-3 py-2 rounded-lg text-xs"
            style={{
              background: 'rgba(233, 69, 96, 0.1)',
              color: 'var(--accent-primary)',
              border: '1px solid rgba(233, 69, 96, 0.2)',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Downloads list */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Downloads
          </h2>
          {downloads.length > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{
                background: activeCount > 0
                  ? 'rgba(83, 216, 251, 0.15)'
                  : 'rgba(255, 255, 255, 0.06)',
                color: activeCount > 0 ? 'var(--accent-secondary)' : 'var(--text-secondary)',
              }}
            >
              {downloads.length}
            </span>
          )}
        </div>

        {loadingList ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-secondary)' }} />
          </div>
        ) : downloads.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-xl"
            style={{
              background: 'rgba(22, 33, 62, 0.3)',
              border: '1px dashed rgba(255, 255, 255, 0.08)',
            }}
          >
            <Download size={36} style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              No downloads yet — paste a YouTube URL above to get started
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {downloads.map((download) => (
              <DownloadCard
                key={download.id}
                download={download}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <CookiesModal
        isOpen={cookiesOpen}
        onClose={() => setCookiesOpen(false)}
        onStatusChange={setCookiesActive}
      />
    </div>
  )
}
