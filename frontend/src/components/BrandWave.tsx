interface BrandWaveProps {
  bars?: number
  className?: string
  /** When false, bars are static (no equalizer animation). */
  animated?: boolean
  style?: React.CSSProperties
}

// A deterministic waveform silhouette — symmetric, peaking toward the middle —
// so it reads as "sound" rather than random noise. Values are 0..1 heights.
function silhouette(i: number, n: number): number {
  const t = i / (n - 1) // 0..1
  const envelope = Math.sin(t * Math.PI) // arch, tall in the middle
  const detail =
    0.5 +
    0.5 *
      Math.abs(
        Math.sin(i * 1.7) * 0.6 + Math.sin(i * 0.6 + 1.3) * 0.4
      )
  return Math.max(0.18, Math.min(1, envelope * 0.55 + detail * 0.45))
}

/**
 * The brand signature: a row of waveform bars in the current text color.
 * Used in the nav mark, the download hero, and empty states.
 */
export default function BrandWave({
  bars = 28,
  className = '',
  animated = true,
  style,
}: BrandWaveProps) {
  return (
    <div className={`eq ${className}`} style={style} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => {
        const h = silhouette(i, bars)
        return (
          <i
            key={i}
            style={{
              height: `${Math.round(h * 100)}%`,
              animationDelay: `${(i % 12) * 90}ms`,
              animationPlayState: animated ? 'running' : 'paused',
            }}
          />
        )
      })}
    </div>
  )
}
