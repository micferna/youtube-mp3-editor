import { useState, useCallback, useMemo } from 'react'
import {
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  Download,
  Layers,
} from 'lucide-react'
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
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEditorStore, type Cut } from '../stores/editorStore'
import ExportModal from './ExportModal'

function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

interface AssemblyBlockProps {
  id: string
  index: number
  cut: Cut
  fileName: string
  onRemove: () => void
}

function SortableAssemblyBlock({ id, cut, fileName, onRemove }: AssemblyBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const duration = Math.max(0, cut.end - cut.start)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex-shrink-0 relative group rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing transition-all hover:brightness-110"
      title={`${fileName} - ${cut.name || 'Untitled'}`}
      data-assembly-block
    >
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          background: cut.color + '25',
          border: `1px solid ${cut.color}50`,
        }}
      />
      <div className="relative z-10 flex flex-col gap-0.5 min-w-[100px]">
        <span
          className="text-[10px] truncate max-w-[120px]"
          style={{ color: 'var(--text-secondary)' }}
        >
          {fileName}
        </span>
        <span
          className="text-xs font-medium truncate max-w-[120px]"
          style={{ color: 'var(--text-primary)' }}
        >
          {cut.name || 'Untitled'}
        </span>
        <span
          className="text-[10px] font-mono tabular-nums"
          style={{ color: cut.color }}
        >
          {formatDuration(duration)}
        </span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="absolute top-1 right-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
        style={{ color: 'var(--text-secondary)' }}
      >
        <X size={12} />
      </button>
    </div>
  )
}

export default function AssemblyTimeline() {
  const assemblyCuts = useEditorStore((s) => s.assemblyCuts)
  const allCuts = useEditorStore((s) => s.cuts)
  const files = useEditorStore((s) => s.files)
  const removeFromAssembly = useEditorStore((s) => s.removeFromAssembly)
  const reorderAssembly = useEditorStore((s) => s.reorderAssembly)
  const clearAssembly = useEditorStore((s) => s.clearAssembly)

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showExport, setShowExport] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  // Resolve assembly items to full cut objects
  const resolvedItems = useMemo(() => {
    return assemblyCuts.map((ac, index) => {
      const fileCuts = allCuts[ac.fileId] ?? []
      const cut = fileCuts.find((c) => c.id === ac.cutId)
      const file = files[ac.fileId]
      return {
        id: `${ac.fileId}-${ac.cutId}-${index}`,
        index,
        cut,
        fileName: file?.name ?? 'Unknown',
        fileId: ac.fileId,
        cutId: ac.cutId,
      }
    }).filter((item) => item.cut != null)
  }, [assemblyCuts, allCuts, files])

  const totalDuration = useMemo(() => {
    return resolvedItems.reduce((sum, item) => {
      if (!item.cut) return sum
      return sum + Math.max(0, item.cut.end - item.cut.start)
    }, 0)
  }, [resolvedItems])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = resolvedItems.findIndex((item) => item.id === active.id)
      const newIndex = resolvedItems.findIndex((item) => item.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      reorderAssembly(oldIndex, newIndex)
    },
    [resolvedItems, reorderAssembly]
  )

  const exportCuts = resolvedItems
    .filter((item) => item.cut != null)
    .map((item) => ({
      fileId: item.fileId,
      start: item.cut!.start,
      end: item.cut!.end,
    }))

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: 'rgba(22, 33, 62, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers size={16} style={{ color: 'var(--accent-secondary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Assembly
            </h3>
          </div>
          {assemblyCuts.length > 0 && (
            <>
              <span
                className="text-[11px] px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  background: 'var(--accent-secondary)',
                  color: 'var(--bg-primary)',
                }}
              >
                {assemblyCuts.length}
              </span>
              <span
                className="text-xs font-mono tabular-nums"
                style={{ color: 'var(--text-secondary)' }}
              >
                {formatDuration(totalDuration)}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {assemblyCuts.length > 0 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  clearAssembly()
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all hover:bg-red-500/20"
                style={{ color: 'var(--accent-primary)' }}
              >
                <Trash2 size={12} />
                Clear
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowExport(true)
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all hover:brightness-110"
                style={{
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  color: 'white',
                }}
              >
                <Download size={12} />
                Export
              </button>
            </>
          )}
          {isCollapsed ? (
            <ChevronUp size={16} style={{ color: 'var(--text-secondary)' }} />
          ) : (
            <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
          )}
        </div>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className="px-3 pb-3">
          {resolvedItems.length === 0 ? (
            <div
              className="flex items-center justify-center py-6 rounded-lg border-2 border-dashed"
              style={{
                borderColor: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-secondary)',
              }}
            >
              <span className="text-sm">Drag cuts here to assemble</span>
            </div>
          ) : (
            <div className="flex items-stretch gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={resolvedItems.map((item) => item.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {resolvedItems.map((item) => (
                    <SortableAssemblyBlock
                      key={item.id}
                      id={item.id}
                      index={item.index}
                      cut={item.cut!}
                      fileName={item.fileName}
                      onRemove={() => removeFromAssembly(item.index)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      )}

      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        cuts={exportCuts}
        mode="merge"
      />
    </div>
  )
}
