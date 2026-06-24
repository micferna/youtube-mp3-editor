import { useRef, useEffect, useState, useCallback } from 'react'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from 'lucide-react'
import type { Cut } from '../stores/editorStore'

interface VideoPlayerProps {
  fileUrl: string
  cuts: Cut[]
  currentTime: number
  onTimeUpdate: (time: number) => void
  onSeek: (time: number) => void
}

export default function VideoPlayer({
  fileUrl,
  cuts,
  currentTime,
  onTimeUpdate,
  onSeek,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [speed, setSpeed] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      onTimeUpdate(video.currentTime)
    }
    const handleLoadedMetadata = () => {
      setDuration(video.duration)
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => setIsPlaying(false)

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
    }
  }, [onTimeUpdate])

  // Sync external currentTime
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (Math.abs(video.currentTime - currentTime) > 0.5) {
      video.currentTime = currentTime
    }
  }, [currentTime])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }, [])

  const handleVolumeChange = useCallback((val: number) => {
    setVolume(val)
    setIsMuted(val === 0)
    if (videoRef.current) {
      videoRef.current.volume = val
      videoRef.current.muted = val === 0
    }
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (isMuted) {
      video.muted = false
      video.volume = volume || 0.8
      setIsMuted(false)
    } else {
      video.muted = true
      setIsMuted(true)
    }
  }, [isMuted, volume])

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed)
    if (videoRef.current) {
      videoRef.current.playbackRate = newSpeed
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    if (!document.fullscreenElement) {
      container.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = x / rect.width
      const seekTime = ratio * duration
      if (videoRef.current) {
        videoRef.current.currentTime = seekTime
      }
      onSeek(seekTime)
    },
    [duration, onSeek]
  )

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2]

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r)',
      }}
    >
      {/* Video element */}
      <div className="relative bg-black">
        <video
          ref={videoRef}
          src={fileUrl}
          className="w-full max-h-[400px] object-contain"
          playsInline
        />
      </div>

      {/* Timeline bar with cut regions */}
      <div
        ref={timelineRef}
        className="relative h-8 cursor-pointer mx-3 mt-2 rounded-md overflow-hidden"
        style={{ background: 'var(--paper-2)' }}
        onClick={handleTimelineClick}
      >
        {/* Progress */}
        <div
          className="absolute top-0 left-0 h-full transition-all duration-100"
          style={{
            width: `${progress}%`,
            background: 'var(--iris)',
            opacity: 0.18,
          }}
        />
        {/* Cut regions */}
        {cuts.map((cut) => {
          if (duration <= 0) return null
          const left = (cut.start / duration) * 100
          const width = ((cut.end - cut.start) / duration) * 100
          return (
            <div
              key={cut.id}
              className="absolute top-0 h-full rounded-sm"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: cut.color + '60',
                borderLeft: `2px solid ${cut.color}`,
                borderRight: `2px solid ${cut.color}`,
              }}
            >
              <span
                className="absolute top-0.5 left-1 text-[9px] font-medium truncate"
                style={{ color: 'var(--ink)', maxWidth: '90%' }}
              >
                {cut.name || 'Cut'}
              </span>
            </div>
          )
        })}
        {/* Playhead */}
        <div
          className="absolute top-0 h-full w-0.5"
          style={{
            left: `${progress}%`,
            background: 'var(--iris)',
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="p-2 rounded-lg transition-all hover:bg-[var(--paper-2)]"
          style={{ color: 'var(--ink)' }}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>

        {/* Time display */}
        <span
          className="u-mono text-xs tabular-nums"
          style={{ color: 'var(--muted)' }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex-1" />

        {/* Volume */}
        <button
          onClick={toggleMute}
          className="p-1.5 rounded-lg transition-all hover:bg-[var(--paper-2)]"
          style={{ color: 'var(--muted)' }}
        >
          {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={isMuted ? 0 : volume}
          onChange={(e) => handleVolumeChange(Number(e.target.value))}
          className="w-20 h-1 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--iris) ${(isMuted ? 0 : volume) * 100}%, var(--line) ${(isMuted ? 0 : volume) * 100}%)`,
          }}
        />

        {/* Speed selector */}
        <select
          value={speed}
          onChange={(e) => handleSpeedChange(Number(e.target.value))}
          className="text-xs px-2 py-1 rounded-lg appearance-none cursor-pointer"
          style={{
            background: 'var(--paper-2)',
            color: 'var(--ink)',
            border: '1px solid var(--line)',
          }}
        >
          {speeds.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg transition-all hover:bg-[var(--paper-2)]"
          style={{ color: 'var(--muted)' }}
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>
    </div>
  )
}
