import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const CUT_COLORS = [
  '#e94560', '#53d8fb', '#f5a623', '#7ed321',
  '#bd10e0', '#50e3c2', '#ff6b6b', '#4ecdc4',
]

export interface Cut {
  id: string
  fileId: string
  start: number
  end: number
  name: string
  color: string
}

export interface FileState {
  id: string
  name: string
  path: string
  type: 'audio' | 'video'
  duration: number
  peaks?: number[]
}

interface HistoryEntry {
  action: string
  cuts: Record<string, Cut[]>
  assemblyCuts: Array<{ fileId: string; cutId: string }>
}

export interface EditorState {
  files: Record<string, FileState>
  activeFileId: string | null
  cuts: Record<string, Cut[]>
  assemblyCuts: Array<{ fileId: string; cutId: string }>
  isPlaying: boolean
  currentTime: number
  volume: number
  playbackRate: number
  history: HistoryEntry[]

  loadFile: (id: string) => Promise<void>
  setActiveFile: (id: string) => void
  addCut: (fileId: string, start: number, end: number, name?: string) => string
  updateCut: (fileId: string, cutId: string, updates: Partial<Cut>) => void
  duplicateCut: (fileId: string, cutId: string) => string | null
  removeCut: (fileId: string, cutId: string) => void
  reorderCuts: (fileId: string, cutIds: string[]) => void
  addToAssembly: (fileId: string, cutId: string) => void
  removeFromAssembly: (index: number) => void
  reorderAssembly: (fromIndex: number, toIndex: number) => void
  clearAssembly: () => void
  setPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  setVolume: (volume: number) => void
  setPlaybackRate: (rate: number) => void
  undo: () => void
}

function pushHistory(state: EditorState) {
  state.history.push({
    action: 'snapshot',
    cuts: JSON.parse(JSON.stringify(state.cuts)),
    assemblyCuts: JSON.parse(JSON.stringify(state.assemblyCuts)),
  })
  if (state.history.length > 50) {
    state.history.shift()
  }
}

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    files: {},
    activeFileId: null,
    cuts: {},
    assemblyCuts: [],
    isPlaying: false,
    currentTime: 0,
    volume: 0.8,
    playbackRate: 1,
    history: [],

    loadFile: async (id: string) => {
      try {
        const res = await fetch(`/api/files/${id}`)
        if (!res.ok) throw new Error('Failed to load file info')
        const fileInfo = await res.json()

        let peaks: number[] | undefined
        try {
          const waveRes = await fetch(`/api/files/${id}/waveform`)
          if (waveRes.ok) {
            const waveData = await waveRes.json()
            peaks = waveData.peaks ?? waveData.data ?? waveData
          }
        } catch {
          // waveform not available
        }

        set((state) => {
          state.files[id] = {
            id,
            name: fileInfo.name ?? fileInfo.filename ?? `File ${id}`,
            path: fileInfo.path ?? '',
            type: fileInfo.type ?? 'audio',
            duration: fileInfo.duration ?? 0,
            peaks,
          }
          if (!state.cuts[id]) {
            state.cuts[id] = []
          }
          state.activeFileId = id
        })
      } catch (err) {
        console.error('Failed to load file:', err)
        throw err
      }
    },

    setActiveFile: (id: string) => {
      set((state) => {
        state.activeFileId = id
      })
    },

    addCut: (fileId: string, start: number, end: number, name?: string): string => {
      const cutId = crypto.randomUUID()
      set((state) => {
        pushHistory(state)
        if (!state.cuts[fileId]) {
          state.cuts[fileId] = []
        }
        const colorIndex = state.cuts[fileId].length % CUT_COLORS.length
        state.cuts[fileId].push({
          id: cutId,
          fileId,
          start,
          end,
          name: name ?? '',
          color: CUT_COLORS[colorIndex],
        })
      })
      return cutId
    },

    duplicateCut: (fileId: string, cutId: string): string | null => {
      const newId = crypto.randomUUID()
      let found = false
      set((state) => {
        pushHistory(state)
        const fileCuts = state.cuts[fileId]
        if (!fileCuts) return
        const idx = fileCuts.findIndex((c) => c.id === cutId)
        if (idx === -1) return
        const original = fileCuts[idx]
        const colorIndex = fileCuts.length % CUT_COLORS.length
        fileCuts.splice(idx + 1, 0, {
          id: newId,
          fileId,
          start: original.start,
          end: original.end,
          name: original.name ? `${original.name} (copy)` : '',
          color: CUT_COLORS[colorIndex],
        })
        found = true
      })
      return found ? newId : null
    },

    updateCut: (fileId: string, cutId: string, updates: Partial<Cut>) => {
      set((state) => {
        pushHistory(state)
        const fileCuts = state.cuts[fileId]
        if (!fileCuts) return
        const idx = fileCuts.findIndex((c) => c.id === cutId)
        if (idx === -1) return
        Object.assign(fileCuts[idx], updates)
      })
    },

    removeCut: (fileId: string, cutId: string) => {
      set((state) => {
        pushHistory(state)
        const fileCuts = state.cuts[fileId]
        if (!fileCuts) return
        const idx = fileCuts.findIndex((c) => c.id === cutId)
        if (idx !== -1) fileCuts.splice(idx, 1)
        state.assemblyCuts = state.assemblyCuts.filter(
          (ac) => !(ac.fileId === fileId && ac.cutId === cutId)
        )
      })
    },

    reorderCuts: (fileId: string, cutIds: string[]) => {
      set((state) => {
        pushHistory(state)
        const fileCuts = state.cuts[fileId]
        if (!fileCuts) return
        const sorted: Cut[] = []
        for (const id of cutIds) {
          const cut = fileCuts.find((c) => c.id === id)
          if (cut) sorted.push(cut)
        }
        state.cuts[fileId] = sorted
      })
    },

    addToAssembly: (fileId: string, cutId: string) => {
      set((state) => {
        pushHistory(state)
        state.assemblyCuts.push({ fileId, cutId })
      })
    },

    removeFromAssembly: (index: number) => {
      set((state) => {
        pushHistory(state)
        state.assemblyCuts.splice(index, 1)
      })
    },

    reorderAssembly: (fromIndex: number, toIndex: number) => {
      set((state) => {
        pushHistory(state)
        const [item] = state.assemblyCuts.splice(fromIndex, 1)
        state.assemblyCuts.splice(toIndex, 0, item)
      })
    },

    clearAssembly: () => {
      set((state) => {
        pushHistory(state)
        state.assemblyCuts = []
      })
    },

    setPlaying: (playing: boolean) => {
      set((state) => {
        state.isPlaying = playing
      })
    },

    setCurrentTime: (time: number) => {
      set((state) => {
        state.currentTime = time
      })
    },

    setVolume: (volume: number) => {
      set((state) => {
        state.volume = volume
      })
    },

    setPlaybackRate: (rate: number) => {
      set((state) => {
        state.playbackRate = rate
      })
    },

    undo: () => {
      const { history } = get()
      if (history.length === 0) return
      set((state) => {
        const last = state.history.pop()
        if (last) {
          state.cuts = last.cuts as Record<string, Cut[]>
          state.assemblyCuts = last.assemblyCuts
        }
      })
    },
  }))
)
