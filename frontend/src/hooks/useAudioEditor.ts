import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useEditorStore } from '../stores/editorStore'
import type { WaveformHandle } from '../components/Waveform'

export function useAudioEditor() {
  const [searchParams] = useSearchParams()
  const fileId = searchParams.get('file')

  const waveformRef = useRef<WaveformHandle | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mark-in / mark-out for keyboard-driven cut creation
  const markInRef = useRef<number | null>(null)

  const loadFile = useEditorStore((s) => s.loadFile)
  const activeFileId = useEditorStore((s) => s.activeFileId)
  const file = useEditorStore((s) => (activeFileId ? s.files[activeFileId] : null))
  const cuts = useEditorStore((s) => (activeFileId ? (s.cuts[activeFileId] ?? []) : []))
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const currentTime = useEditorStore((s) => s.currentTime)
  const volume = useEditorStore((s) => s.volume)
  const playbackRate = useEditorStore((s) => s.playbackRate)

  const setPlaying = useEditorStore((s) => s.setPlaying)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const setVolume = useEditorStore((s) => s.setVolume)
  const setPlaybackRate = useEditorStore((s) => s.setPlaybackRate)
  const addCut = useEditorStore((s) => s.addCut)
  const undo = useEditorStore((s) => s.undo)

  // Load file on mount or fileId change
  useEffect(() => {
    if (!fileId) return
    setIsLoading(true)
    setError(null)
    loadFile(fileId)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load file')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [fileId, loadFile])

  // Play/pause toggle
  const togglePlay = useCallback(() => {
    const ws = waveformRef.current
    if (!ws) return
    if (isPlaying) {
      ws.pause()
      setPlaying(false)
    } else {
      ws.play()
      setPlaying(true)
    }
  }, [isPlaying, setPlaying])

  // Seek
  const handleSeek = useCallback(
    (time: number) => {
      setCurrentTime(time)
      waveformRef.current?.seek(time)
    },
    [setCurrentTime]
  )

  // Time update from waveform
  const handleTimeUpdate = useCallback(
    (time: number) => {
      setCurrentTime(time)
    },
    [setCurrentTime]
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.code) {
        case 'Space': {
          e.preventDefault()
          togglePlay()
          break
        }
        case 'KeyI': {
          // Mark cut start
          markInRef.current = currentTime
          break
        }
        case 'KeyO': {
          // Mark cut end — create cut from mark-in to current
          if (markInRef.current !== null && activeFileId) {
            const start = Math.min(markInRef.current, currentTime)
            const end = Math.max(markInRef.current, currentTime)
            if (end - start > 0.1) {
              addCut(activeFileId, start, end)
            }
            markInRef.current = null
          }
          break
        }
        case 'Delete':
        case 'Backspace': {
          // Could implement selected cut deletion here
          break
        }
        case 'KeyZ': {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            undo()
          }
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, currentTime, activeFileId, addCut, undo])

  return {
    fileId,
    file,
    cuts,
    isLoading,
    error,
    isPlaying,
    currentTime,
    volume,
    playbackRate,
    waveformRef,
    togglePlay,
    handleSeek,
    handleTimeUpdate,
    setVolume,
    setPlaybackRate,
    setPlaying,
  }
}
