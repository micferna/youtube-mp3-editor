import { useState, useCallback, useRef } from 'react'
import { Plus, Download, Scissors } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import CutCard from './CutCard'
import ExportModal from './ExportModal'
import { useEditorStore, type Cut } from '../stores/editorStore'
import type { WaveformHandle } from './Waveform'

interface CutPanelProps {
  fileId: string
  waveformRef?: React.RefObject<WaveformHandle | null>
}

function SortableCutCard({
  cut,
  onUpdate,
  onDelete,
  onPreview,
}: {
  cut: Cut
  onUpdate: (updates: Partial<Cut>) => void
  onDelete: () => void
  onPreview: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cut.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <CutCard
        cut={cut}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onPreview={onPreview}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

export default function CutPanel({ fileId, waveformRef }: CutPanelProps) {
  const cuts = useEditorStore((s) => s.cuts[fileId] ?? [])
  const currentTime = useEditorStore((s) => s.currentTime)
  const addCut = useEditorStore((s) => s.addCut)
  const updateCut = useEditorStore((s) => s.updateCut)
  const removeCut = useEditorStore((s) => s.removeCut)
  const reorderCuts = useEditorStore((s) => s.reorderCuts)
  const addToAssembly = useEditorStore((s) => s.addToAssembly)
  const [showExport, setShowExport] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const handleAddCut = useCallback(() => {
    const duration = waveformRef?.current?.getDuration() ?? 0
    const start = Math.max(0, currentTime - 5)
    const end = duration > 0 ? Math.min(duration, currentTime + 5) : currentTime + 10
    const safeStart = currentTime > 0 ? start : 0
    const safeEnd = currentTime > 0 ? end : Math.min(10, duration || 10)
    addCut(fileId, safeStart, safeEnd)
  }, [fileId, currentTime, addCut, waveformRef])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = cuts.findIndex((c) => c.id === active.id)
      const newIndex = cuts.findIndex((c) => c.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const newOrder = arrayMove(
        cuts.map((c) => c.id),
        oldIndex,
        newIndex
      )
      reorderCuts(fileId, newOrder)
    },
    [cuts, fileId, reorderCuts]
  )

  const handlePreview = useCallback(
    (cut: Cut) => {
      waveformRef?.current?.playRegion(cut.start, cut.end)
    },
    [waveformRef]
  )

  const exportCuts = cuts.map((c) => ({
    fileId: c.fileId,
    start: c.start,
    end: c.end,
  }))

  return (
    <div
      className="flex flex-col h-full rounded-xl overflow-hidden"
      style={{
        background: 'rgba(22, 33, 62, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Scissors size={16} style={{ color: 'var(--accent-primary)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Cuts
          </h3>
          {cuts.length > 0 && (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded-full font-medium"
              style={{
                background: 'var(--accent-primary)',
                color: 'white',
              }}
            >
              {cuts.length}
            </span>
          )}
        </div>
        <button
          onClick={handleAddCut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg, var(--accent-primary), #c23152)',
            color: 'white',
          }}
        >
          <Plus size={14} />
          Add Cut
        </button>
      </div>

      {/* Cut list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {cuts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Scissors
              size={32}
              className="mb-3 opacity-20"
              style={{ color: 'var(--text-secondary)' }}
            />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              No cuts yet
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
              Select a region on the waveform or click Add Cut
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={cuts.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {cuts.map((cut) => (
                <SortableCutCard
                  key={cut.id}
                  cut={cut}
                  onUpdate={(updates) => updateCut(fileId, cut.id, updates)}
                  onDelete={() => removeCut(fileId, cut.id)}
                  onPreview={() => handlePreview(cut)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Footer actions */}
      {cuts.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-white/5">
          <button
            onClick={() => {
              cuts.forEach((cut) => addToAssembly(fileId, cut.id))
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/10"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--accent-secondary)',
              border: '1px solid rgba(83, 216, 251, 0.2)',
            }}
          >
            Add All to Assembly
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              color: 'white',
            }}
          >
            <Download size={14} />
            Export
          </button>
        </div>
      )}

      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        cuts={exportCuts}
        mode="separate"
      />
    </div>
  )
}
