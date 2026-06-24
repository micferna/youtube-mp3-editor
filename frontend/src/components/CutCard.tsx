import { useState, useCallback, type CSSProperties } from 'react'
import { GripVertical, Play, Trash2, Copy } from 'lucide-react'
import type { Cut } from '../stores/editorStore'

interface CutCardProps {
  cut: Cut
  onUpdate: (updates: Partial<Cut>) => void
  onDelete: () => void
  onDuplicate: () => void
  onPreview: () => void
  dragHandleProps?: Record<string, unknown>
  style?: CSSProperties
}

/** Format seconds to mm:ss.ms (e.g. 01:23.45) */
function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  const sWhole = Math.floor(s)
  const ms = Math.round((s - sWhole) * 100)
  return `${m.toString().padStart(2, '0')}:${sWhole.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

/** Parse mm:ss.ms string to seconds */
function parseTimestamp(value: string): number | null {
  // Support formats: mm:ss.ms, mm:ss, ss.ms, ss
  const trimmed = value.trim()
  let minutes = 0
  let rest = trimmed

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':')
    minutes = parseInt(parts[0], 10) || 0
    rest = parts[1] ?? '0'
  }

  let seconds = 0
  let ms = 0
  if (rest.includes('.')) {
    const [sPart, msPart] = rest.split('.')
    seconds = parseInt(sPart, 10) || 0
    const msStr = (msPart ?? '0').padEnd(2, '0').slice(0, 2)
    ms = parseInt(msStr, 10) || 0
  } else {
    seconds = parseInt(rest, 10) || 0
  }

  const total = minutes * 60 + seconds + ms / 100
  if (isNaN(total) || total < 0) return null
  return total
}

function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(1)
  return `${m}m ${s}s`
}

export default function CutCard({
  cut,
  onUpdate,
  onDelete,
  onDuplicate,
  onPreview,
  dragHandleProps,
  style,
}: CutCardProps) {
  const [startText, setStartText] = useState(formatTimestamp(cut.start))
  const [endText, setEndText] = useState(formatTimestamp(cut.end))

  const handleStartBlur = useCallback(() => {
    const parsed = parseTimestamp(startText)
    if (parsed !== null && parsed !== cut.start) {
      onUpdate({ start: parsed })
    } else {
      setStartText(formatTimestamp(cut.start))
    }
  }, [startText, cut.start, onUpdate])

  const handleEndBlur = useCallback(() => {
    const parsed = parseTimestamp(endText)
    if (parsed !== null && parsed !== cut.end) {
      onUpdate({ end: parsed })
    } else {
      setEndText(formatTimestamp(cut.end))
    }
  }, [endText, cut.end, onUpdate])

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate({ name: e.target.value })
    },
    [onUpdate]
  )

  // Keep local state in sync with cut prop changes
  const displayStart = formatTimestamp(cut.start)
  const displayEnd = formatTimestamp(cut.end)
  if (startText !== displayStart && document.activeElement?.getAttribute('data-field') !== 'start') {
    setStartText(displayStart)
  }
  if (endText !== displayEnd && document.activeElement?.getAttribute('data-field') !== 'end') {
    setEndText(displayEnd)
  }

  const duration = Math.max(0, cut.end - cut.start)

  return (
    <div
      className="flex items-stretch gap-0 overflow-hidden transition-all hover:shadow-[var(--shadow)]"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r)',
        ...style,
      }}
    >
      {/* Color accent + drag handle */}
      <div
        className="flex flex-col items-center justify-center px-1.5 cursor-grab active:cursor-grabbing"
        style={{ background: cut.color + '18', borderRight: `3px solid ${cut.color}` }}
        {...dragHandleProps}
      >
        <GripVertical size={14} style={{ color: cut.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 px-3 py-2 flex flex-col gap-1.5 min-w-0">
        {/* Name */}
        <input
          type="text"
          value={cut.name}
          onChange={handleNameChange}
          placeholder="Untitled"
          className="text-sm font-medium bg-transparent border-none outline-none w-full truncate"
          style={{ color: 'var(--ink)' }}
        />

        {/* Timestamps row */}
        <div className="flex items-center gap-2 text-xs">
          <input
            data-field="start"
            type="text"
            value={startText}
            onChange={(e) => setStartText(e.target.value)}
            onBlur={handleStartBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleStartBlur()}
            className="u-mono w-[72px] px-1.5 py-0.5 rounded text-center tabular-nums outline-none focus:border-[var(--iris)]"
            style={{
              background: 'var(--paper-2)',
              color: 'var(--iris-600)',
              border: '1px solid var(--line)',
            }}
          />
          <span style={{ color: 'var(--muted)' }}>-</span>
          <input
            data-field="end"
            type="text"
            value={endText}
            onChange={(e) => setEndText(e.target.value)}
            onBlur={handleEndBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleEndBlur()}
            className="u-mono w-[72px] px-1.5 py-0.5 rounded text-center tabular-nums outline-none focus:border-[var(--iris)]"
            style={{
              background: 'var(--paper-2)',
              color: 'var(--iris-600)',
              border: '1px solid var(--line)',
            }}
          />
          <span
            className="u-mono ml-auto text-[11px] tabular-nums"
            style={{ color: 'var(--muted)' }}
          >
            {formatDuration(duration)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center justify-center gap-1 px-2">
        <button
          onClick={onPreview}
          className="p-1.5 rounded-md transition-all hover:bg-[var(--paper-2)]"
          style={{ color: 'var(--iris-600)' }}
          title="Preview cut"
        >
          <Play size={14} />
        </button>
        <button
          onClick={onDuplicate}
          className="p-1.5 rounded-md transition-all hover:bg-[var(--paper-2)]"
          style={{ color: 'var(--muted)' }}
          title="Duplicate cut"
        >
          <Copy size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md transition-all hover:bg-[var(--danger-tint)]"
          style={{ color: 'var(--danger)' }}
          title="Delete cut"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
