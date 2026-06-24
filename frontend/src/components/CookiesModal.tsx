import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Cookie,
  ClipboardPaste,
  Check,
  Loader2,
  Trash2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react'

interface CookiesModalProps {
  isOpen: boolean
  onClose: () => void
  onStatusChange?: (present: boolean) => void
}

interface CookieStatus {
  present: boolean
  count: number
  updated_at: string | null
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// "Get cookies.txt LOCALLY" — the extension recommended by yt-dlp's wiki.
const EXT_CHROME =
  'https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc'
const EXT_FIREFOX =
  'https://addons.mozilla.org/firefox/addon/get-cookies-txt-locally/'

export default function CookiesModal({ isOpen, onClose, onStatusChange }: CookiesModalProps) {
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<CookieStatus | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/cookies')
      if (!res.ok) return
      const data: CookieStatus = await res.json()
      setStatus(data)
      onStatusChange?.(data.present)
    } catch {
      // ignore — non-critical status read
    }
  }, [onStatusChange])

  useEffect(() => {
    if (isOpen) {
      setContent('')
      setSaveState('idle')
      setErrorMessage('')
      refreshStatus()
    }
  }, [isOpen, refreshStatus])

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setContent(text)
    } catch {
      // Clipboard API may be blocked; user can paste manually
    }
  }

  const handleSave = useCallback(async () => {
    if (!content.trim()) return
    setSaveState('saving')
    setErrorMessage('')
    try {
      const res = await fetch('/api/cookies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || 'Failed to save cookies')
      }
      setSaveState('saved')
      setContent('')
      await refreshStatus()
    } catch (err) {
      setSaveState('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save cookies')
    }
  }, [content, refreshStatus])

  const handleClear = useCallback(async () => {
    setSaveState('saving')
    try {
      await fetch('/api/cookies', { method: 'DELETE' })
      setSaveState('idle')
      await refreshStatus()
    } catch {
      setSaveState('error')
      setErrorMessage('Failed to clear cookies')
    }
  }, [refreshStatus])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{
          background:
            'linear-gradient(180deg, rgba(22, 33, 62, 0.95) 0%, rgba(26, 26, 46, 0.98) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 z-10"
          style={{ background: 'rgba(22, 33, 62, 0.95)' }}
        >
          <div className="flex items-center gap-2">
            <Cookie size={18} style={{ color: 'var(--accent-secondary)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              YouTube Cookies
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all hover:bg-white/10 cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Why */}
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            If downloads fail with <span className="font-mono" style={{ color: 'var(--accent-primary)' }}>
            “Sign in to confirm you’re not a bot”</span>, paste your YouTube cookies here. They
            authenticate yt-dlp so YouTube stops blocking the server.
          </p>

          {/* Current status */}
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded-lg"
            style={{ background: 'rgba(255, 255, 255, 0.03)' }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: status?.present ? '#4ade80' : 'var(--text-secondary)' }}
              />
              <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                {status?.present
                  ? `${status.count} cookie${status.count !== 1 ? 's' : ''} active`
                  : 'No cookies configured'}
              </span>
            </div>
            {status?.present && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1 text-xs transition-colors cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                <Trash2 size={13} />
                Clear
              </button>
            )}
          </div>

          {/* How-to */}
          <div
            className="rounded-lg p-3 text-xs leading-relaxed"
            style={{ background: 'rgba(83, 216, 251, 0.06)', border: '1px solid rgba(83, 216, 251, 0.15)' }}
          >
            <p className="font-semibold mb-1.5" style={{ color: 'var(--accent-secondary)' }}>
              How to get them (≈30s)
            </p>
            <ol className="list-decimal list-inside space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <li>
                Install the{' '}
                <a href={EXT_CHROME} target="_blank" rel="noreferrer"
                  className="underline inline-flex items-center gap-0.5"
                  style={{ color: 'var(--accent-secondary)' }}>
                  Get cookies.txt LOCALLY <ExternalLink size={10} />
                </a>{' '}
                extension (
                <a href={EXT_FIREFOX} target="_blank" rel="noreferrer" className="underline"
                  style={{ color: 'var(--accent-secondary)' }}>Firefox</a>).
              </li>
              <li>Open <span className="font-mono">youtube.com</span> while logged in.</li>
              <li>Click the extension → <strong>Export</strong> (or Copy).</li>
              <li>Paste the result below and save.</li>
            </ol>
          </div>

          {/* Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                cookies.txt content
              </label>
              <button
                onClick={handlePaste}
                className="flex items-center gap-1 text-xs transition-colors cursor-pointer"
                style={{ color: 'var(--accent-secondary)' }}
              >
                <ClipboardPaste size={13} />
                Paste
              </button>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Netscape HTTP Cookie File&#10;.youtube.com	TRUE	/	TRUE	..."
              spellCheck={false}
              className="w-full h-32 px-3 py-2 rounded-lg text-xs font-mono outline-none resize-y"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                color: 'var(--text-primary)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            />
          </div>

          {/* Error */}
          {saveState === 'error' && (
            <div
              className="px-3 py-2 rounded-lg text-xs"
              style={{
                background: 'rgba(233, 69, 96, 0.1)',
                color: 'var(--accent-primary)',
                border: '1px solid rgba(233, 69, 96, 0.2)',
              }}
            >
              {errorMessage || 'Failed to save cookies.'}
            </div>
          )}

          {/* Security note */}
          <div className="flex items-start gap-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            <ShieldAlert size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              Cookies grant access to your YouTube account. They’re stored only on this
              server (<span className="font-mono">data/cookies.txt</span>) — don’t share them.
            </span>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!content.trim() || saveState === 'saving'}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, var(--accent-secondary), #2980b9)',
              color: '#fff',
            }}
          >
            {saveState === 'saving' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : saveState === 'saved' ? (
              <Check size={16} />
            ) : (
              <Cookie size={16} />
            )}
            {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save cookies'}
          </button>
        </div>
      </div>
    </div>
  )
}
