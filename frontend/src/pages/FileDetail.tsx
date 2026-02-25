import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  PencilIcon,
  RectangleGroupIcon,
  DocumentTextIcon,
  FilmIcon,
  PhotoIcon,
  CalendarIcon,
  IdentificationIcon,
  ScaleIcon,
  TagIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'

// ── Types ──────────────────────────────────────────────────
type FileType = 'image' | 'video' | 'document'

interface FileData {
  file_id:       string
  original_name: string
  file_type:     FileType
  mime_type:     string
  size:          number
  created_at:    string
  url:           string   // preview/download URL
}

// ── Mock data (replace with API later) ────────────────────
const MOCK_FILE: FileData = {
  file_id:       'f1a2b3c4-d5e6',
  original_name: 'vacation-photo.jpg',
  file_type:     'image',
  mime_type:     'image/jpeg',
  size:          3200000,
  created_at:    '2026-02-20T10:00:00Z',
  url:           'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
}

// ── Helpers ────────────────────────────────────────────────
const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

// ── Preview Component ──────────────────────────────────────
function FilePreview({ file }: { file: FileData }) {
  const [imgError, setImgError] = useState(false)

  if (file.file_type === 'image') {
    return imgError ? (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3">
        <PhotoIcon className="w-16 h-16 text-muted" />
        <p className="text-muted text-sm">Preview unavailable</p>
      </div>
    ) : (
      <img
        src={file.url}
        alt={file.original_name}
        onError={() => setImgError(true)}
        className="w-full h-full object-contain rounded-xl"
      />
    )
  }

  if (file.file_type === 'video') {
    return (
      <video
        src={file.url}
        controls
        className="w-full h-full rounded-xl object-contain bg-black"
      >
        Your browser does not support video playback.
      </video>
    )
  }

  // Document — PDF native preview or Google Docs Viewer for docx/doc
  if (file.file_type === 'document') {
    const isPDF = file.mime_type === 'application/pdf'
    const previewUrl = isPDF
      ? file.url
      : `https://docs.google.com/gview?url=${encodeURIComponent(file.url)}&embedded=true`

    return (
      <iframe
        src={previewUrl}
        title={file.original_name}
        className="w-full h-full rounded-xl border-0"
      />
    )
  }

  return null
}

// ── Info Card ──────────────────────────────────────────────
function InfoCard({
  icon,
  label,
  value,
}: {
  icon:  JSX.Element
  label: string
  value: string
}) {
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3
                    hover:border-beige/20 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-muted text-xs uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-beige text-sm font-medium">{value}</p>
    </div>
  )
}

// ── Rename Modal ───────────────────────────────────────────
function RenameModal({
  current,
  onConfirm,
  onCancel,
}: {
  current:   string
  onConfirm: (name: string) => void
  onCancel:  () => void
}) {
  const [name, setName] = useState(current)

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50
                    flex items-center justify-center px-4">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-beige font-semibold text-lg mb-1">Rename file</h2>
        <p className="text-muted text-sm mb-5">Enter a new name for this file</p>

        <input
          className="input mb-5"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
          autoFocus
        />

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-ghost text-sm">
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim() || name === current}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <CheckIcon className="w-4 h-4" />
            Rename
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Move to Album Modal ────────────────────────────────────
function AlbumModal({ onCancel }: { onCancel: () => void }) {
  // Mock albums — replace with API later
  const MOCK_ALBUMS = ['Vacation 2026', 'Work Docs', 'Family', 'Projects']
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50
                    flex items-center justify-center px-4">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-beige font-semibold text-lg">Move to Album</h2>
            <p className="text-muted text-sm mt-0.5">Select an album for this file</p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full flex items-center justify-center
                       text-muted hover:text-beige hover:bg-surface2 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mb-5">
          {MOCK_ALBUMS.map(album => (
            <button
              key={album}
              onClick={() => setSelected(album)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl
                          border transition-colors text-left
                ${selected === album
                  ? 'border-beige bg-beige/5 text-beige'
                  : 'border-border text-beige-dim hover:border-beige/30 hover:text-beige'
                }`}
            >
              <RectangleGroupIcon className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{album}</span>
              {selected === album && (
                <CheckIcon className="w-4 h-4 ml-auto" />
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-ghost text-sm">
            Cancel
          </button>
          <button
            disabled={!selected}
            onClick={onCancel}   // replace with actual move API later
            className="btn-primary text-sm flex items-center gap-2"
          >
            <RectangleGroupIcon className="w-4 h-4" />
            Move
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ───────────────────────────────────
function DeleteModal({
  fileName,
  onConfirm,
  onCancel,
}: {
  fileName:  string
  onConfirm: () => void
  onCancel:  () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50
                    flex items-center justify-center px-4">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm">
        <div className="w-12 h-12 rounded-full bg-red-900/30 border border-red-800
                        flex items-center justify-center mb-4">
          <TrashIcon className="w-6 h-6 text-red-400" />
        </div>
        <h2 className="text-beige font-semibold text-lg mb-1">Delete file?</h2>
        <p className="text-muted text-sm mb-6">
          <span className="text-beige-dim font-medium">"{fileName}"</span> will be
          permanently deleted. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-ghost text-sm flex-1">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-danger text-sm flex-1">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────
export default function FileDetail() {
  const navigate = useNavigate()

  // Use mock data — replace with API call using useParams id later
  const [file, setFile]           = useState<FileData>(MOCK_FILE)
  const [showRename, setShowRename] = useState(false)
  const [showAlbum,  setShowAlbum]  = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const handleRename = (newName: string) => {
    setFile(prev => ({ ...prev, original_name: newName }))
    setShowRename(false)
  }

  const handleDelete = () => {
    // Replace with API call later
    navigate('/library')
  }

  const TYPE_ICON: Record<FileType, JSX.Element> = {
    image:    <PhotoIcon        className="w-6 h-6 text-beige-dim" />,
    video:    <FilmIcon         className="w-6 h-6 text-beige-dim" />,
    document: <DocumentTextIcon className="w-6 h-6 text-beige-dim" />,
  }

  return (
    <div className="min-h-screen bg-main-bg px-6 py-8">

      {/* ── Back button ── */}
      <button
        onClick={() => navigate('/library')}
        className="flex items-center gap-2 text-muted hover:text-beige
                   transition-colors text-sm mb-6 group"
      >
        <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Library
      </button>

      {/* ── File name + actions row ── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          {TYPE_ICON[file.file_type]}
          <h1 className="text-2xl font-bold text-beige truncate">
            {file.original_name}
          </h1>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowRename(true)}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <PencilIcon className="w-4 h-4" />
            Rename
          </button>
          <button
            onClick={() => setShowAlbum(true)}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <RectangleGroupIcon className="w-4 h-4" />
            Album
          </button>
          <a
            href={file.url}
            download={file.original_name}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Download
          </a>
          <button
            onClick={() => setShowDelete(true)}
            className="btn-danger flex items-center gap-2 text-sm"
          >
            <TrashIcon className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* ── Large Preview ── */}
      <div
        className="w-full bg-surface border border-border rounded-2xl overflow-hidden
                   mb-6 cursor-zoom-in"
        style={{ height: '480px' }}
        onClick={() => setPreviewOpen(true)}
      >
        <FilePreview file={file} />
      </div>

      {/* ── Info Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <InfoCard
          icon={<TagIcon            className="w-4 h-4 text-muted" />}
          label="File name"
          value={file.original_name}
        />
        <InfoCard
          icon={TYPE_ICON[file.file_type]}
          label="Type"
          value={file.file_type.charAt(0).toUpperCase() + file.file_type.slice(1)}
        />
        <InfoCard
          icon={<ScaleIcon          className="w-4 h-4 text-muted" />}
          label="Size"
          value={formatSize(file.size)}
        />
        <InfoCard
          icon={<CalendarIcon       className="w-4 h-4 text-muted" />}
          label="Uploaded"
          value={formatDate(file.created_at)}
        />
        <InfoCard
          icon={<IdentificationIcon className="w-4 h-4 text-muted" />}
          label="File ID"
          value={file.file_id.slice(0, 12) + '…'}
        />
      </div>

      {/* ── Fullscreen Preview Overlay (click on preview) ── */}
      {previewOpen && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50
                     flex items-center justify-center p-6"
          onClick={() => setPreviewOpen(false)}
        >
          <button
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-surface
                       border border-border flex items-center justify-center
                       text-muted hover:text-beige transition-colors"
            onClick={() => setPreviewOpen(false)}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
          <div
            className="w-full max-w-5xl max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <FilePreview file={file} />
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showRename && (
        <RenameModal
          current={file.original_name}
          onConfirm={handleRename}
          onCancel={() => setShowRename(false)}
        />
      )}
      {showAlbum && (
        <AlbumModal onCancel={() => setShowAlbum(false)} />
      )}
      {showDelete && (
        <DeleteModal
          fileName={file.original_name}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}

    </div>
  )
}
