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
  X,
  FolderOpen,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react'

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
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

const ACCEPTED_TYPES = '.mp3,.wav,.flac,.ogg,.mp4,.mkv,.webm'

const glassStyle: React.CSSProperties = {
  background: 'rgba(22, 33, 62, 0.6)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
}

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
      const data = await res.json()
      setFiles(data)
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
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i])
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const xhr = new XMLHttpRequest()
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
        })
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error('Upload failed'))
          }
        })
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

  // --- Loading State ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2
          size={40}
          className="animate-spin"
          style={{ color: 'var(--accent-secondary)' }}
        />
        <p className="mt-4 text-lg" style={{ color: 'var(--text-secondary)' }}>
          Loading library...
        </p>
      </div>
    )
  }

  // --- Error State (no files loaded) ---
  if (error && files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <AlertCircle size={48} style={{ color: 'var(--accent-primary)' }} />
        <p className="mt-4 text-lg" style={{ color: 'var(--text-secondary)' }}>
          {error}
        </p>
        <button
          onClick={fetchFiles}
          className="mt-6 px-6 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, var(--accent-primary), #c73a52)',
            color: '#fff',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  // --- Empty State ---
  if (!loading && files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div
          className="rounded-full p-6 mb-6"
          style={{ background: 'rgba(83, 216, 251, 0.1)' }}
        >
          <FolderOpen size={56} style={{ color: 'var(--accent-secondary)' }} />
        </div>
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Your library is empty
        </h2>
        <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
          Get started by downloading from YouTube or uploading a file
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, var(--accent-secondary), #3ab8d8)',
              color: '#111',
            }}
          >
            <Download size={18} />
            Download from YouTube
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, var(--accent-primary), #c73a52)',
              color: '#fff',
            }}
          >
            <Upload size={18} />
            Upload a file
          </button>
        </div>

        {/* Upload Modal for empty state */}
        {showUpload && (
          <UploadModal
            dragOver={dragOver}
            setDragOver={setDragOver}
            handleDrop={handleDrop}
            handleUpload={handleUpload}
            uploading={uploading}
            uploadProgress={uploadProgress}
            fileInputRef={fileInputRef}
            onClose={() => setShowUpload(false)}
          />
        )}
      </div>
    )
  }

  // --- Main Content ---
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Error banner */}
      {error && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6"
          style={{
            background: 'rgba(233, 69, 96, 0.15)',
            border: '1px solid rgba(233, 69, 96, 0.3)',
          }}
        >
          <AlertCircle size={18} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ color: 'var(--accent-primary)' }}>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto cursor-pointer"
            style={{ color: 'var(--accent-primary)' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <h1
            className="text-3xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Library
          </h1>
          <span
            className="px-2.5 py-0.5 rounded-full text-sm font-semibold"
            style={{
              background: 'rgba(83, 216, 251, 0.15)',
              color: 'var(--accent-secondary)',
            }}
          >
            {files.length}
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* View Toggle */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={glassStyle}
          >
            <button
              onClick={() => setViewMode('grid')}
              className="p-2 transition-all duration-200 cursor-pointer"
              style={{
                background:
                  viewMode === 'grid'
                    ? 'rgba(83, 216, 251, 0.2)'
                    : 'transparent',
                color:
                  viewMode === 'grid'
                    ? 'var(--accent-secondary)'
                    : 'var(--text-secondary)',
              }}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="p-2 transition-all duration-200 cursor-pointer"
              style={{
                background:
                  viewMode === 'list'
                    ? 'rgba(83, 216, 251, 0.2)'
                    : 'transparent',
                color:
                  viewMode === 'list'
                    ? 'var(--accent-secondary)'
                    : 'var(--text-secondary)',
              }}
            >
              <List size={18} />
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:flex-initial">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-secondary)' }}
            />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-all duration-200 focus:ring-1"
              style={{
                ...glassStyle,
                color: 'var(--text-primary)',
                focusRingColor: 'var(--accent-secondary)',
              }}
            />
          </div>

          {/* Upload Button */}
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 cursor-pointer hover:scale-105 whitespace-nowrap"
            style={{
              background: 'linear-gradient(135deg, var(--accent-primary), #c73a52)',
              color: '#fff',
            }}
          >
            <Upload size={16} />
            Upload
          </button>
        </div>
      </div>

      {/* No search results */}
      {filteredFiles.length === 0 && searchQuery && (
        <div className="flex flex-col items-center justify-center py-20">
          <Search size={40} style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
          <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
            No files matching "{searchQuery}"
          </p>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && filteredFiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFiles.map((file) => (
            <GridCard
              key={file.id}
              file={file}
              deleteConfirm={deleteConfirm}
              setDeleteConfirm={setDeleteConfirm}
              onDelete={handleDelete}
              onEdit={() => navigate(`/editor?file=${file.id}`)}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && filteredFiles.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={glassStyle}>
          {/* Table Header */}
          <div
            className="hidden sm:grid grid-cols-[auto_1fr_80px_100px_120px_90px] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{
              color: 'var(--text-secondary)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <span className="w-8" />
            <span>Name</span>
            <span>Duration</span>
            <span>Source</span>
            <span>Date</span>
            <span>Actions</span>
          </div>
          {filteredFiles.map((file, i) => (
            <ListRow
              key={file.id}
              file={file}
              isLast={i === filteredFiles.length - 1}
              deleteConfirm={deleteConfirm}
              setDeleteConfirm={setDeleteConfirm}
              onDelete={handleDelete}
              onEdit={() => navigate(`/editor?file=${file.id}`)}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          dragOver={dragOver}
          setDragOver={setDragOver}
          handleDrop={handleDrop}
          handleUpload={handleUpload}
          uploading={uploading}
          uploadProgress={uploadProgress}
          fileInputRef={fileInputRef}
          onClose={() => setShowUpload(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="rounded-2xl p-6 max-w-sm w-full"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-lg font-bold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              Delete file?
            </h3>
            <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
              This action cannot be undone. The file will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
                style={{
                  ...glassStyle,
                  color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, var(--accent-primary), #c73a52)',
                  color: '#fff',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Grid Card ─── */
function GridCard({
  file,
  deleteConfirm: _deleteConfirm,
  setDeleteConfirm,
  onDelete: _onDelete,
  onEdit,
}: {
  file: FileItem
  deleteConfirm: string | null
  setDeleteConfirm: (id: string | null) => void
  onDelete: (id: string) => void
  onEdit: () => void
}) {
  const isAudio = file.type === 'audio'
  const accent = isAudio ? 'var(--accent-secondary)' : 'var(--accent-primary)'

  return (
    <div
      className="group relative rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{
        ...glassStyle,
        boxShadow: 'none',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 30px ${isAudio ? 'rgba(83, 216, 251, 0.15)' : 'rgba(233, 69, 96, 0.15)'}`
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
      }}
    >
      {/* Top accent bar */}
      <div className="h-1" style={{ background: accent }} />

      <div className="p-4">
        {/* Icon + Type */}
        <div className="flex items-start justify-between mb-3">
          <div
            className="rounded-lg p-2.5"
            style={{ background: `${accent}15` }}
          >
            {isAudio ? (
              <Music size={22} style={{ color: accent }} />
            ) : (
              <Video size={22} style={{ color: accent }} />
            )}
          </div>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: `${accent}15`,
              color: accent,
            }}
          >
            {isAudio ? 'Audio' : 'Video'}
          </span>
        </div>

        {/* Title */}
        <h3
          className="font-semibold text-sm mb-1 truncate"
          style={{ color: 'var(--text-primary)' }}
          title={file.name}
        >
          {file.name}
        </h3>

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          <span>{formatDuration(file.duration)}</span>
          <span style={{ opacity: 0.3 }}>|</span>
          <span>{file.source === 'youtube' ? 'YouTube' : 'Local upload'}</span>
        </div>

        {/* Date */}
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
          {formatRelativeDate(file.created_at)}
        </p>

        {/* Actions - visible on hover */}
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(83, 216, 251, 0.12)',
              color: 'var(--accent-secondary)',
            }}
          >
            <Scissors size={13} />
            Edit
          </button>
          <button
            onClick={() => setDeleteConfirm(file.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(233, 69, 96, 0.12)',
              color: 'var(--accent-primary)',
            }}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── List Row ─── */
function ListRow({
  file,
  isLast,
  deleteConfirm: _deleteConfirm,
  setDeleteConfirm,
  onDelete: _onDelete,
  onEdit,
}: {
  file: FileItem
  isLast: boolean
  deleteConfirm: string | null
  setDeleteConfirm: (id: string | null) => void
  onDelete: (id: string) => void
  onEdit: () => void
}) {
  const isAudio = file.type === 'audio'
  const accent = isAudio ? 'var(--accent-secondary)' : 'var(--accent-primary)'

  return (
    <div
      className="group grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_80px_100px_120px_90px] gap-4 items-center px-5 py-3 transition-all duration-200"
      style={{
        borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
        background: 'transparent',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(255, 255, 255, 0.03)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: `${accent}15` }}
      >
        {isAudio ? (
          <Music size={16} style={{ color: accent }} />
        ) : (
          <Video size={16} style={{ color: accent }} />
        )}
      </div>

      {/* Name */}
      <span
        className="truncate text-sm font-medium"
        style={{ color: 'var(--text-primary)' }}
        title={file.name}
      >
        {file.name}
      </span>

      {/* Duration */}
      <span
        className="hidden sm:block text-xs"
        style={{ color: 'var(--text-secondary)' }}
      >
        {formatDuration(file.duration)}
      </span>

      {/* Source */}
      <span
        className="hidden sm:block text-xs"
        style={{ color: 'var(--text-secondary)' }}
      >
        {file.source === 'youtube' ? 'YouTube' : 'Local upload'}
      </span>

      {/* Date */}
      <span
        className="hidden sm:block text-xs"
        style={{ color: 'var(--text-secondary)' }}
      >
        {formatRelativeDate(file.created_at)}
      </span>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg cursor-pointer transition-all duration-200 hover:scale-110"
          style={{ color: 'var(--accent-secondary)' }}
          title="Edit"
        >
          <Scissors size={15} />
        </button>
        <button
          onClick={() => setDeleteConfirm(file.id)}
          className="p-1.5 rounded-lg cursor-pointer transition-all duration-200 hover:scale-110"
          style={{ color: 'var(--accent-primary)' }}
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

/* ─── Upload Modal ─── */
function UploadModal({
  dragOver,
  setDragOver,
  handleDrop,
  handleUpload,
  uploading,
  uploadProgress,
  fileInputRef,
  onClose,
}: {
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 max-w-lg w-full"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-lg font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Upload Files
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg cursor-pointer transition-all duration-200"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Drop Zone */}
        <div
          className="rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-200"
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent-secondary)' : 'rgba(255, 255, 255, 0.15)'}`,
            background: dragOver
              ? 'rgba(83, 216, 251, 0.08)'
              : 'rgba(255, 255, 255, 0.02)',
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload
            size={40}
            style={{
              color: dragOver
                ? 'var(--accent-secondary)'
                : 'var(--text-secondary)',
              marginBottom: 12,
            }}
          />
          <p
            className="font-medium mb-1"
            style={{
              color: dragOver
                ? 'var(--accent-secondary)'
                : 'var(--text-primary)',
            }}
          >
            {dragOver ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            or click to browse
          </p>
          <p
            className="text-xs mt-3"
            style={{ color: 'var(--text-secondary)', opacity: 0.6 }}
          >
            MP3, WAV, FLAC, OGG, MP4, MKV, WebM
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

        {/* Upload Progress */}
        {uploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                Uploading...
              </span>
              <span
                className="text-sm"
                style={{ color: 'var(--accent-secondary)' }}
              >
                {uploadProgress}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: 'rgba(255, 255, 255, 0.08)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${uploadProgress}%`,
                  background:
                    'linear-gradient(90deg, var(--accent-secondary), var(--accent-primary))',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
