import { useState, useCallback, useMemo } from 'react'
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
  onDuplicate,
  onPreview,
}: {
  cut: Cut
  onUpdate: (updates: Partial<Cut>) => void
  onDelete: () => void
  onDuplicate: () => void
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
        onDuplicate={onDuplicate}
        onPreview={onPreview}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

export default function CutPanel({ fileId, waveformRef }: CutPanelProps) {
  const cutsMap = useEditorStore((s) => s.cuts)
  const currentTime = useEditorStore((s) => s.currentTime)
  const cuts = useMemo(() => cutsMap[fileId] ?? [], [cutsMap, fileId])
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
    useEditorStore.getState().addCut(fileId, safeStart, safeEnd)
  }, [fileId, currentTime, waveformRef])

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
      useEditorStore.getState().reorderCuts(fileId, newOrder)
    },
    [cuts, fileId]
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
      className="flex flex-col h-full overflow-hidden"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <div className="flex items-center gap-2">
          <Scissors size={16} style={{ color: 'var(--iris)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Cuts
          </h3>
          {cuts.length > 0 && (
            <span
              className="u-badge u-mono"
              style={{
                background: 'var(--iris-tint)',
                color: 'var(--iris-600)',
              }}
            >
              {cuts.length}
            </span>
          )}
        </div>
        <button
          onClick={handleAddCut}
          className="u-btn u-btn-primary h-8 px-2.5 text-xs"
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
              className="mb-3"
              style={{ color: 'var(--faint)' }}
            />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              No cuts yet
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--faint)' }}>
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
                  onUpdate={(updates) => useEditorStore.getState().updateCut(fileId, cut.id, updates)}
                  onDelete={() => useEditorStore.getState().removeCut(fileId, cut.id)}
                  onDuplicate={() => useEditorStore.getState().duplicateCut(fileId, cut.id)}
                  onPreview={() => handlePreview(cut)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Footer actions */}
      {cuts.length > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2.5"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          <button
            onClick={() => {
              cuts.forEach((cut) => useEditorStore.getState().addToAssembly(fileId, cut.id))
            }}
            className="u-btn u-btn-ghost flex-1 h-9 px-3 text-xs"
          >
            Add All to Assembly
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="u-btn u-btn-primary h-9 px-3 text-xs"
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
