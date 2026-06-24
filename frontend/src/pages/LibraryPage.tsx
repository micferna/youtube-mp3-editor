import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutGrid,
  List,
  Search,
  Upload,
  Music,
  Video,
  Scissors,
  Trash2,
  Download,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react'
import Modal from '../components/Modal'
import BrandWave from '../components/BrandWave'

interface FileItem {
  id: string
  name: string
  type: 'audio' | 'video'
  duration: number
  source: 'youtube' | 'local'
  created_at: string
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const diffMs = Date.now() - date.getTime()
  const min = Math.floor(diffMs / 60000)
  const hrs = Math.floor(min / 60)
  const days = Math.floor(hrs / 24)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  if (hrs < 24) return `${hrs}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return date.toLocaleDateString()
}

const ACCEPTED_TYPES = '.mp3,.wav,.flac,.ogg,.mp4,.mkv,.webm'

export default function LibraryPage() {
  const navigate = useNavigate()
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/files')
      if (!res.ok) throw new Error('Failed to load files')
      setFiles(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/files/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete file')
      setFiles((prev) => prev.filter((f) => f.id !== id))
      setDeleteConfirm(null)
    } catch {
      setError('Failed to delete file')
    }
  }

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const formData = new FormData()
    for (let i = 0; i < fileList.length; i++) formData.append('files', fileList[i])

    setUploading(true)
    setUploadProgress(0)
    try {
      const xhr = new XMLHttpRequest()
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        })
        xhr.addEventListener('load', () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed'))
        )
        xhr.addEventListener('error', () => reject(new Error('Upload failed')))
        xhr.open('POST', '/api/files/upload')
        xhr.send(formData)
      })
      await fetchFiles()
      setShowUpload(false)
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }

  const uploadModal = (
    <UploadModal
      isOpen={showUpload}
      dragOver={dragOver}
      setDragOver={setDragOver}
      handleDrop={handleDrop}
      handleUpload={handleUpload}
      uploading={uploading}
      uploadProgress={uploadProgress}
      fileInputRef={fileInputRef}
      onClose={() => setShowUpload(false)}
    />
  )

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--iris)' }} />
        <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>Loading library…</p>
      </div>
    )
  }

  // --- Error (no files) ---
  if (error && files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <AlertCircle size={36} style={{ color: 'var(--danger)' }} />
        <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>{error}</p>
        <button onClick={fetchFiles} className="u-btn u-btn-primary h-10 px-5 mt-6">Retry</button>
      </div>
    )
  }

  // --- Empty ---
  if (files.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="h-12 w-44 mb-6" style={{ color: 'var(--iris)' }}>
            <BrandWave bars={40} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--ink)' }}>
            Your library is empty
          </h1>
          <p className="mb-8 text-sm" style={{ color: 'var(--muted)' }}>
            Download from YouTube or upload a file to get started.
          </p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/')} className="u-btn u-btn-primary h-11 px-5">
              <Download size={17} />
              Download
            </button>
            <button onClick={() => setShowUpload(true)} className="u-btn u-btn-ghost h-11 px-5">
              <Upload size={17} />
              Upload
            </button>
          </div>
        </div>
        {uploadModal}
      </>
    )
  }

  // --- Main ---
  return (
    <div className="fade-up">
      {/* Error banner */}
      {error && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-[12px] mb-6"
          style={{ background: 'var(--danger-tint)', border: '1px solid rgba(220,38,38,0.2)' }}
        >
          <AlertCircle size={16} style={{ color: 'var(--danger)' }} />
          <span className="text-sm" style={{ color: 'var(--danger)' }}>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto cursor-pointer" style={{ color: 'var(--danger)' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>Library</h1>
          <span className="u-badge u-mono" style={{ background: 'var(--paper-2)', color: 'var(--muted)' }}>
            {files.length}
          </span>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="u-seg">
            <button data-active={viewMode === 'grid'} onClick={() => setViewMode('grid')} className="u-seg-item px-2.5" title="Grid">
              <LayoutGrid size={16} />
            </button>
            <button data-active={viewMode === 'list'} onClick={() => setViewMode('list')} className="u-seg-item px-2.5" title="List">
              <List size={16} />
            </button>
          </div>

          <div className="relative flex-1 sm:flex-initial">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
            <input
              type="text"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="u-input w-full sm:w-56 pl-9 pr-3 py-2 text-sm"
            />
          </div>

          <button onClick={() => setShowUpload(true)} className="u-btn u-btn-primary h-9 px-3.5 text-sm whitespace-nowrap">
            <Upload size={15} />
            <span className="hidden sm:inline">Upload</span>
          </button>
        </div>
      </div>

      {/* No search results */}
      {filteredFiles.length === 0 && searchQuery && (
        <div className="flex flex-col items-center justify-center py-20">
          <Search size={28} style={{ color: 'var(--faint)' }} />
          <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>No files matching “{searchQuery}”</p>
        </div>
      )}

      {/* Grid */}
      {viewMode === 'grid' && filteredFiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((file) => (
            <GridCard key={file.id} file={file} onDelete={() => setDeleteConfirm(file.id)} onEdit={() => navigate(`/editor?file=${file.id}`)} />
          ))}
        </div>
      )}

      {/* List */}
      {viewMode === 'list' && filteredFiles.length > 0 && (
        <div className="u-card overflow-hidden">
          <div
            className="hidden sm:grid grid-cols-[auto_1fr_72px_110px_90px_80px] gap-4 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider u-mono"
            style={{ color: 'var(--faint)', borderBottom: '1px solid var(--line)' }}
          >
            <span className="w-8" />
            <span>Name</span>
            <span>Length</span>
            <span>Source</span>
            <span>Added</span>
            <span className="text-right">Actions</span>
          </div>
          {filteredFiles.map((file, i) => (
            <ListRow
              key={file.id}
              file={file}
              isLast={i === filteredFiles.length - 1}
              onDelete={() => setDeleteConfirm(file.id)}
              onEdit={() => navigate(`/editor?file=${file.id}`)}
            />
          ))}
        </div>
      )}

      {uploadModal}

      {/* Delete confirm */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete file?"
        icon={<Trash2 size={16} />}
        maxWidth="max-w-sm"
      >
        <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
          This permanently removes the file from disk. It can’t be undone.
        </p>
        <div className="flex gap-2.5 justify-end">
          <button onClick={() => setDeleteConfirm(null)} className="u-btn u-btn-ghost h-9 px-4">Cancel</button>
          <button
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            className="u-btn h-9 px-4"
            style={{ background: 'var(--danger)', color: '#fff' }}
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  )
}

/* ─── Grid Card ─── */
function GridCard({ file, onDelete, onEdit }: { file: FileItem; onDelete: () => void; onEdit: () => void }) {
  const isAudio = file.type === 'audio'
  return (
    <div className="group u-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow)]">
      <div className="flex items-start justify-between mb-3">
        <div className="rounded-[10px] p-2.5" style={{ background: 'var(--iris-tint)' }}>
          {isAudio ? <Music size={20} style={{ color: 'var(--iris)' }} /> : <Video size={20} style={{ color: 'var(--iris)' }} />}
        </div>
        <span className="u-badge" style={{ background: 'var(--paper-2)', color: 'var(--muted)' }}>
          {isAudio ? 'Audio' : 'Video'}
        </span>
      </div>

      <h3 className="font-medium text-sm mb-1.5 truncate" style={{ color: 'var(--ink)' }} title={file.name}>
        {file.name}
      </h3>

      <div className="flex items-center gap-2 text-[11px] u-mono mb-4" style={{ color: 'var(--muted)' }}>
        <span>{formatDuration(file.duration)}</span>
        <span style={{ color: 'var(--line-strong)' }}>·</span>
        <span>{file.source === 'youtube' ? 'YouTube' : 'Upload'}</span>
        <span style={{ color: 'var(--line-strong)' }}>·</span>
        <span>{formatRelativeDate(file.created_at)}</span>
      </div>

      <div className="flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
        <button onClick={onEdit} className="u-btn u-btn-primary h-8 px-3 text-xs flex-1">
          <Scissors size={13} />
          Edit
        </button>
        <button onClick={onDelete} className="u-btn u-btn-ghost h-8 w-8 p-0" title="Delete" style={{ color: 'var(--danger)' }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

/* ─── List Row ─── */
function ListRow({ file, isLast, onDelete, onEdit }: { file: FileItem; isLast: boolean; onDelete: () => void; onEdit: () => void }) {
  const isAudio = file.type === 'audio'
  return (
    <div
      className="group grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_72px_110px_90px_80px] gap-4 items-center px-4 py-2.5 transition-colors hover:bg-[var(--paper-2)]"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--line)' }}
    >
      <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ background: 'var(--iris-tint)' }}>
        {isAudio ? <Music size={15} style={{ color: 'var(--iris)' }} /> : <Video size={15} style={{ color: 'var(--iris)' }} />}
      </div>
      <span className="truncate text-sm font-medium" style={{ color: 'var(--ink)' }} title={file.name}>
        {file.name}
      </span>
      <span className="hidden sm:block text-xs u-mono" style={{ color: 'var(--muted)' }}>{formatDuration(file.duration)}</span>
      <span className="hidden sm:block text-xs" style={{ color: 'var(--muted)' }}>{file.source === 'youtube' ? 'YouTube' : 'Upload'}</span>
      <span className="hidden sm:block text-xs u-mono" style={{ color: 'var(--muted)' }}>{formatRelativeDate(file.created_at)}</span>
      <div className="flex gap-0.5 justify-end sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="u-btn u-btn-quiet h-8 w-8 p-0" title="Edit"><Scissors size={15} /></button>
        <button onClick={onDelete} className="u-btn u-btn-quiet h-8 w-8 p-0" title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={15} /></button>
      </div>
    </div>
  )
}

/* ─── Upload Modal ─── */
function UploadModal({
  isOpen,
  dragOver,
  setDragOver,
  handleDrop,
  handleUpload,
  uploading,
  uploadProgress,
  fileInputRef,
  onClose,
}: {
  isOpen: boolean
  dragOver: boolean
  setDragOver: (v: boolean) => void
  handleDrop: (e: React.DragEvent) => void
  handleUpload: (files: FileList | null) => void
  uploading: boolean
  uploadProgress: number
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onClose: () => void
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload files" icon={<Upload size={17} />} maxWidth="max-w-lg">
      <div
        className="rounded-[12px] p-10 flex flex-col items-center justify-center cursor-pointer transition-all"
        style={{
          border: `2px dashed ${dragOver ? 'var(--iris)' : 'var(--line-strong)'}`,
          background: dragOver ? 'var(--iris-tint)' : 'var(--paper-2)',
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={32} style={{ color: dragOver ? 'var(--iris)' : 'var(--faint)', marginBottom: 12 }} />
        <p className="font-medium mb-1 text-sm" style={{ color: dragOver ? 'var(--iris-600)' : 'var(--ink)' }}>
          {dragOver ? 'Drop to upload' : 'Drag & drop, or click to browse'}
        </p>
        <p className="text-[11px] u-mono mt-2" style={{ color: 'var(--faint)' }}>
          MP3 · WAV · FLAC · OGG · MP4 · MKV · WEBM
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {uploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Uploading…</span>
            <span className="text-xs u-mono" style={{ color: 'var(--iris-600)' }}>{uploadProgress}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--paper-2)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%`, background: 'var(--iris)' }} />
          </div>
        </div>
      )}
    </Modal>
  )
}
