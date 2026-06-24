import { useState, useEffect, useCallback } from 'react'
import {
  Cookie,
  ClipboardPaste,
  Check,
  Loader2,
  Trash2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react'
import Modal from './Modal'

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
      setContent(await navigator.clipboard.readText())
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="YouTube cookies" icon={<Cookie size={17} />} maxWidth="max-w-lg">
      <div className="space-y-4">
        {/* Why */}
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          If downloads fail with{' '}
          <span className="u-mono text-[12px]" style={{ color: 'var(--danger)' }}>
            “confirm you’re not a bot”
          </span>
          , paste your YouTube cookies so yt-dlp can authenticate.
        </p>

        {/* Current status */}
        <div
          className="flex items-center justify-between px-3.5 py-2.5 rounded-[10px]"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: status?.present ? 'var(--ok)' : 'var(--faint)' }}
            />
            <span className="text-xs" style={{ color: 'var(--ink)' }}>
              {status?.present
                ? `${status.count} cookie${status.count !== 1 ? 's' : ''} active`
                : 'No cookies configured'}
            </span>
          </div>
          {status?.present && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 text-xs cursor-pointer transition-colors"
              style={{ color: 'var(--muted)' }}
            >
              <Trash2 size={13} />
              Clear
            </button>
          )}
        </div>

        {/* How-to */}
        <div
          className="rounded-[10px] p-3.5 text-[12px] leading-relaxed"
          style={{ background: 'var(--iris-tint)', border: '1px solid var(--iris-200)' }}
        >
          <p className="font-semibold mb-1.5" style={{ color: 'var(--iris-600)' }}>
            How to get them (≈30s)
          </p>
          <ol className="list-decimal list-inside space-y-1" style={{ color: 'var(--muted)' }}>
            <li>
              Install{' '}
              <a href={EXT_CHROME} target="_blank" rel="noreferrer"
                className="underline inline-flex items-center gap-0.5 font-medium" style={{ color: 'var(--iris-600)' }}>
                Get cookies.txt LOCALLY <ExternalLink size={10} />
              </a>{' '}
              (
              <a href={EXT_FIREFOX} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--iris-600)' }}>
                Firefox
              </a>
              ).
            </li>
            <li>Open <span className="u-mono">youtube.com</span> while signed in.</li>
            <li>Click the extension → <strong style={{ color: 'var(--ink)' }}>Export</strong>.</li>
            <li>Paste below and save.</li>
          </ol>
        </div>

        {/* Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
              cookies.txt content
            </label>
            <button onClick={handlePaste} className="flex items-center gap-1 text-xs cursor-pointer font-medium" style={{ color: 'var(--iris-600)' }}>
              <ClipboardPaste size={13} />
              Paste
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="# Netscape HTTP Cookie File&#10;.youtube.com	TRUE	/	TRUE	..."
            spellCheck={false}
            className="u-input u-mono h-28 px-3 py-2.5 text-[12px] resize-y"
          />
        </div>

        {/* Error */}
        {saveState === 'error' && (
          <div
            className="px-3 py-2 rounded-[10px] text-xs"
            style={{ background: 'var(--danger-tint)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.2)' }}
          >
            {errorMessage || 'Failed to save cookies.'}
          </div>
        )}

        {/* Security note */}
        <div className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: 'var(--faint)' }}>
          <ShieldAlert size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            Cookies grant access to your account. Stored only on this server
            (<span className="u-mono">data/cookies.txt</span>) — don’t share them.
          </span>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!content.trim() || saveState === 'saving'}
          className="u-btn u-btn-primary w-full h-11"
        >
          {saveState === 'saving' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : saveState === 'saved' ? (
            <Check size={16} />
          ) : (
            <Cookie size={16} />
          )}
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save cookies'}
        </button>
      </div>
    </Modal>
  )
}
