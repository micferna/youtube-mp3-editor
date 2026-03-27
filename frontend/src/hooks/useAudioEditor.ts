import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useEditorStore } from '../stores/editorStore'
import type { WaveformHandle } from '../components/Waveform'

const EMPTY_CUTS: ReturnType<typeof useEditorStore.getState>['cuts'][string] = []

export function useAudioEditor() {
  const [searchParams] = useSearchParams()
  const fileId = searchParams.get('file')

  const waveformRef = useRef<WaveformHandle | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const markInRef = useRef<number | null>(null)

  // State selectors — only primitives and stable references
  const activeFileId = useEditorStore((s) => s.activeFileId)
  const files = useEditorStore((s) => s.files)
  const cutsMap = useEditorStore((s) => s.cuts)
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const currentTime = useEditorStore((s) => s.currentTime)
  const volume = useEditorStore((s) => s.volume)
  const playbackRate = useEditorStore((s) => s.playbackRate)

  // Derive values with useMemo to avoid new references
  const file = useMemo(() => (activeFileId ? files[activeFileId] ?? null : null), [activeFileId, files])
  const cuts = useMemo(() => (activeFileId ? cutsMap[activeFileId] ?? EMPTY_CUTS : EMPTY_CUTS), [activeFileId, cutsMap])

  // Load file on mount or fileId change
  useEffect(() => {
    if (!fileId) return
    setIsLoading(true)
    setError(null)
    useEditorStore.getState().loadFile(fileId)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load file')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [fileId])

  const togglePlay = useCallback(() => {
    const ws = waveformRef.current
    if (!ws) return
    const playing = useEditorStore.getState().isPlaying
    if (playing) {
      ws.pause()
      useEditorStore.getState().setPlaying(false)
    } else {
      ws.play()
      useEditorStore.getState().setPlaying(true)
    }
  }, [])

  const handleSeek = useCallback((time: number) => {
    useEditorStore.getState().setCurrentTime(time)
    waveformRef.current?.seek(time)
  }, [])

  const handleTimeUpdate = useCallback((time: number) => {
    useEditorStore.getState().setCurrentTime(time)
  }, [])

  const setVolume = useCallback((v: number) => {
    useEditorStore.getState().setVolume(v)
  }, [])

  const setPlaybackRate = useCallback((r: number) => {
    useEditorStore.getState().setPlaybackRate(r)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.code) {
        case 'Space': {
          e.preventDefault()
          togglePlay()
          break
        }
        case 'KeyI': {
          markInRef.current = useEditorStore.getState().currentTime
          break
        }
        case 'KeyO': {
          const state = useEditorStore.getState()
          const now = state.currentTime
          if (markInRef.current !== null && state.activeFileId) {
            const start = Math.min(markInRef.current, now)
            const end = Math.max(markInRef.current, now)
            if (end - start > 0.1) {
              state.addCut(state.activeFileId, start, end)
            }
            markInRef.current = null
          }
          break
        }
        case 'KeyZ': {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            useEditorStore.getState().undo()
          }
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay])

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
  }
}
