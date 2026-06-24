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
import BrandWave from '../components/BrandWave'

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
    <div className="max-w-2xl mx-auto">
      {/* Hero */}
      <header className="fade-up mb-8">
        <p className="u-eyebrow mb-4">Self-hosted audio studio</p>
        <h1
          className="text-[40px] sm:text-[52px] leading-[0.98] font-bold"
          style={{ color: 'var(--ink)' }}
        >
          Paste a link.
          <br />
          Keep the&nbsp;sound.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed max-w-md" style={{ color: 'var(--muted)' }}>
          Pull audio or video straight from YouTube, then trim it on the
          waveform — all in your browser.
        </p>
        {/* Waveform signature */}
        <div
          className="mt-6 h-10 w-full max-w-sm opacity-90"
          style={{ color: 'var(--iris)' }}
        >
          <BrandWave bars={56} />
        </div>
      </header>

      {/* Action card */}
      <div className="u-card p-4 sm:p-5 fade-up" style={{ animationDelay: '60ms' }}>
        {/* URL field */}
        <div
          className="flex items-center rounded-[12px] border transition-shadow focus-within:border-[var(--iris)] focus-within:shadow-[0_0_0_3px_var(--iris-tint)]"
          style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
        >
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste a YouTube URL…"
            className="flex-1 bg-transparent px-4 py-3.5 text-sm outline-none"
            style={{ color: 'var(--ink)' }}
          />
          <button
            onClick={handlePaste}
            className="u-btn u-btn-quiet h-9 px-3 mr-1.5 text-xs"
            title="Paste from clipboard"
          >
            <Clipboard size={15} />
            <span className="hidden sm:inline">Paste</span>
          </button>
        </div>

        {/* Format + download */}
        <div className="flex items-center gap-3 mt-3">
          <div className="u-seg" role="tablist" aria-label="Format">
            <button
              role="tab"
              aria-selected={format === 'audio'}
              data-active={format === 'audio'}
              onClick={() => setFormat('audio')}
              className="u-seg-item"
            >
              <Music size={14} />
              Audio
            </button>
            <button
              role="tab"
              aria-selected={format === 'video'}
              data-active={format === 'video'}
              onClick={() => setFormat('video')}
              className="u-seg-item"
            >
              <Video size={14} />
              Video
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !url.trim()}
            className="u-btn u-btn-primary flex-1 h-11"
          >
            {isSubmitting ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Download size={17} />
            )}
            {isSubmitting ? 'Starting…' : 'Download'}
          </button>
        </div>

        {/* Options: playlist + cookies */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
          <button
            type="button"
            onClick={() => setPlaylist((p) => !p)}
            className="flex items-center gap-2 text-xs font-medium cursor-pointer transition-colors"
            style={{ color: playlist ? 'var(--iris-600)' : 'var(--muted)' }}
            title="When on, a playlist URL downloads every video as its own file"
          >
            <span
              className="flex items-center justify-center w-[18px] h-[18px] rounded-[6px] transition-all"
              style={{
                background: playlist ? 'var(--iris)' : 'var(--card)',
                border: `1.5px solid ${playlist ? 'var(--iris)' : 'var(--line-strong)'}`,
              }}
            >
              {playlist && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            <ListMusic size={14} />
            Download full playlist
          </button>

          <button
            type="button"
            onClick={() => setCookiesOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors"
            style={{ color: 'var(--muted)' }}
            title="Set YouTube cookies to fix 'confirm you're not a bot' errors"
          >
            <span className="relative flex items-center">
              <Cookie size={15} />
              {cookiesActive && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-2"
                  style={{ background: 'var(--ok)', ['--tw-ring-color' as string]: 'var(--card)' }}
                />
              )}
            </span>
            Cookies
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mt-3 px-3 py-2.5 rounded-[10px] text-xs leading-relaxed"
            style={{
              background: 'var(--danger-tint)',
              color: 'var(--danger)',
              border: '1px solid rgba(220, 38, 38, 0.2)',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Downloads list */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
            Downloads
          </h2>
          {downloads.length > 0 && (
            <span
              className="u-badge u-mono"
              style={{
                background: activeCount > 0 ? 'var(--iris-tint)' : 'var(--paper-2)',
                color: activeCount > 0 ? 'var(--iris-600)' : 'var(--muted)',
              }}
            >
              {activeCount > 0 ? `${activeCount} active` : `${downloads.length}`}
            </span>
          )}
        </div>

        {loadingList ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--iris)' }} />
          </div>
        ) : downloads.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-[16px] text-center"
            style={{ border: '1px dashed var(--line-strong)', background: 'var(--card)' }}
          >
            <div className="h-8 w-28 mb-3" style={{ color: 'var(--line-strong)' }}>
              <BrandWave bars={28} animated={false} />
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Nothing here yet — paste a link above to start.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
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
      </section>

      <CookiesModal
        isOpen={cookiesOpen}
        onClose={() => setCookiesOpen(false)}
        onStatusChange={setCookiesActive}
      />
    </div>
  )
}
