import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import type { Cut } from '../stores/editorStore'
import { ZoomIn, ZoomOut } from 'lucide-react'

export interface WaveformHandle {
  play: () => void
  pause: () => void
  seek: (time: number) => void
  playRegion: (start: number, end: number) => void
  getDuration: () => number
}

interface WaveformProps {
  fileId: string
  peaks?: number[]
  cuts: Cut[]
  onCutUpdate: (cutId: string, start: number, end: number) => void
  onTimeUpdate: (time: number) => void
}

const Waveform = forwardRef<WaveformHandle, WaveformProps>(
  ({ fileId, peaks, cuts, onCutUpdate, onTimeUpdate }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const wsRef = useRef<WaveSurfer | null>(null)
    const regionsRef = useRef<RegionsPlugin | null>(null)
    const [zoom, setZoom] = useState(50)
    const [isReady, setIsReady] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const updatingRegionsRef = useRef(false)

    useImperativeHandle(ref, () => ({
      play: () => wsRef.current?.play(),
      pause: () => wsRef.current?.pause(),
      seek: (time: number) => {
        const ws = wsRef.current
        if (ws) {
          const duration = ws.getDuration()
          if (duration > 0) {
            ws.seekTo(time / duration)
          }
        }
      },
      playRegion: (start: number, end: number) => {
        const ws = wsRef.current
        if (ws) {
          const duration = ws.getDuration()
          if (duration > 0) {
            ws.seekTo(start / duration)
            ws.play()
            const checkTime = () => {
              if (ws.getCurrentTime() >= end) {
                ws.pause()
              } else if (ws.isPlaying()) {
                requestAnimationFrame(checkTime)
              }
            }
            requestAnimationFrame(checkTime)
          }
        }
      },
      getDuration: () => wsRef.current?.getDuration() ?? 0,
    }))

    // Initialize wavesurfer
    useEffect(() => {
      if (!containerRef.current) return

      const regions = RegionsPlugin.create()
      regionsRef.current = regions

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: 'rgba(79, 70, 229, 0.28)',
        progressColor: 'rgba(79, 70, 229, 0.85)',
        cursorColor: '#16171d',
        cursorWidth: 2,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 128,
        normalize: true,
        plugins: [regions],
        url: `/api/files/${fileId}/stream`,
        peaks: peaks ? [peaks] : undefined,
        backend: peaks ? 'WebAudio' : 'WebAudio',
      })

      wsRef.current = ws

      ws.on('ready', () => {
        setIsReady(true)
        setIsLoading(false)
      })

      ws.on('timeupdate', (currentTime: number) => {
        onTimeUpdate(currentTime)
      })

      ws.on('seeking', (currentTime: number) => {
        onTimeUpdate(currentTime)
      })

      ws.on('loading', () => {
        setIsLoading(true)
      })

      regions.on('region-updated', (region) => {
        if (updatingRegionsRef.current) return
        onCutUpdate(region.id, region.start, region.end ?? region.start)
      })

      return () => {
        ws.destroy()
        wsRef.current = null
        regionsRef.current = null
        setIsReady(false)
        setIsLoading(true)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileId])

    // Sync cuts as regions
    useEffect(() => {
      const regionsPlugin = regionsRef.current
      if (!regionsPlugin || !isReady) return

      updatingRegionsRef.current = true

      regionsPlugin.clearRegions()

      for (const cut of cuts) {
        regionsPlugin.addRegion({
          id: cut.id,
          start: cut.start,
          end: cut.end,
          color: cut.color + '40',
          drag: true,
          resize: true,
          content: cut.name || undefined,
        })
      }

      updatingRegionsRef.current = false
    }, [cuts, isReady])

    // Zoom
    useEffect(() => {
      if (wsRef.current && isReady) {
        wsRef.current.zoom(zoom)
      }
    }, [zoom, isReady])

    const handleZoomIn = useCallback(() => {
      setZoom((z) => Math.min(z + 25, 500))
    }, [])

    const handleZoomOut = useCallback(() => {
      setZoom((z) => Math.max(z - 25, 10))
    }, [])

    return (
      <div className="w-full">
        {/* Waveform container */}
        <div
          className="relative rounded-[14px] overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
        >
          {isLoading && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10"
              style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(2px)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-5 h-5 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--iris)', borderTopColor: 'transparent' }}
                />
                <span className="text-sm" style={{ color: 'var(--muted)' }}>
                  Loading waveform…
                </span>
              </div>
            </div>
          )}
          <div ref={containerRef} className="w-full px-3 py-4" />
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-3 mt-3">
          <button onClick={handleZoomOut} className="u-btn u-btn-quiet h-8 w-8 p-0" title="Zoom out">
            <ZoomOut size={16} />
          </button>
          <input
            type="range"
            min={10}
            max={500}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--iris) ${((zoom - 10) / 490) * 100}%, var(--line) ${((zoom - 10) / 490) * 100}%)`,
            }}
          />
          <button onClick={handleZoomIn} className="u-btn u-btn-quiet h-8 w-8 p-0" title="Zoom in">
            <ZoomIn size={16} />
          </button>
          <span className="u-mono text-xs w-14 text-right" style={{ color: 'var(--muted)' }}>
            {zoom}px/s
          </span>
        </div>
      </div>
    )
  }
)

Waveform.displayName = 'Waveform'
export default Waveform
