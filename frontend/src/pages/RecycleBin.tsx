import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrashIcon,
  ArrowUturnLeftIcon,
  PhotoIcon,
  FilmIcon,
  DocumentTextIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

// ── Types ──────────────────────────────────────────────────
type FileType = 'image' | 'video' | 'document'
type ViewMode = 'grid' | 'list'

interface DeletedFile {
  file_id:        string
  original_name:  string
  file_type:      FileType
  size:           number
  deleted_at:     string
  original_path:  string   // where it was before deletion
}

// ── Mock Data ──────────────────────────────────────────────
const MOCK_DELETED: DeletedFile[] = [
  {
    file_id:       'd1',
    original_name: 'old-resume.pdf',
    file_type:     'document',
    size:          450000,
    deleted_at:    '2026-02-10T10:00:00Z',
    original_path: '/documents',
  },
  {
    file_id:       'd2',
    original_name: 'beach-photo.jpg',
    file_type:     'image',
    size:          3200000,
    deleted_at:    '2026-02-15T14:00:00Z',
    original_path: '/photos',
  },
  {
    file_id:       'd3',
    original_name: 'project-video.mp4',
    file_type:     'video',
    size:          52000000,
    deleted_at:    '2026-02-20T09:00:00Z',
    original_path: '/videos',
  },
  {
    file_id:       'd4',
    original_name: 'notes-draft.docx',
    file_type:     'document',
    size:          120000,
    deleted_at:    '2026-02-22T11:00:00Z',
    original_path: '/documents',
  },
  {
    file_id:       'd5',
    original_name: 'birthday.png',
    file_type:     'image',
    size:          1800000,
    deleted_at:    '2026-02-23T16:00:00Z',
    original_path: '/albums/a1',
  },
  {
    file_id:       'd6',
    original_name: 'meeting-recording.mp4',
    file_type:     'video',
    size:          89000000,
    deleted_at:    '2026-02-24T08:00:00Z',
    original_path: '/library',
  },
]

// ── Helpers ────────────────────────────────────────────────
const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

// Days remaining before auto-delete
const daysRemaining = (deletedAt: string) => {
  const deleted  = new Date(deletedAt).getTime()
  const now      = Date.now()
  const diffDays = Math.floor((now - deleted) / (1000 * 60 * 60 * 24))
  return Math.max(0, 30 - diffDays)
}

const daysColor = (days: number) => {
  if (days <= 3)  return 'text-red-400 bg-red-900/20 border-red-800'
  if (days <= 7)  return 'text-yellow-400 bg-yellow-900/20 border-yellow-800'
  return 'text-muted bg-surface2 border-border'
}

const FILE_ICON: Record<FileType, JSX.Element> = {
  image:    <PhotoIcon        className="w-5 h-5 text-beige-dim" />,
  video:    <FilmIcon         className="w-5 h-5 text-beige-dim" />,
  document: <DocumentTextIcon className="w-5 h-5 text-beige-dim" />,
}

// Friendly label for original path
const pathLabel = (path: string) => {
  if (path.startsWith('/albums/')) return 'Album'
  const map: Record<string, string> = {
    '/library':   'Library',
    '/photos':    'Photos',
    '/videos':    'Videos',
    '/documents': 'Documents',
  }
  return map[path] ?? 'Library'
}

// ── Confirm Modal ──────────────────────────────────────────
function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title:        string
  message:      string
  confirmLabel: string
  danger?:      boolean
  onConfirm:    () => void
  onCancel:     () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50
                    flex items-center justify-center px-4">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4
          ${danger
            ? 'bg-red-900/30 border border-red-800'
            : 'bg-surface2 border border-border'
          }`}>
          {danger
            ? <TrashIcon            className="w-6 h-6 text-red-400" />
            : <ExclamationTriangleIcon className="w-6 h-6 text-beige-dim" />
          }
        </div>
        <h2 className="text-beige font-semibold text-lg mb-1">{title}</h2>
        <p className="text-muted text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-ghost text-sm flex-1">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`text-sm flex-1 ${danger ? 'btn-danger' : 'btn-primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────
export default function RecycleBin() {
  const navigate = useNavigate()

  const [files,        setFiles]        = useState<DeletedFile[]>(MOCK_DELETED)
  const [view,         setView]         = useState<ViewMode>('grid')
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [confirmRestoreAll, setConfirmRestoreAll] = useState(false)
  const [deletingSingle,    setDeletingSingle]    = useState<DeletedFile | null>(null)
  const [restoringSingle,   setRestoringSingle]   = useState<DeletedFile | null>(null)

  // ── Handlers ──────────────────────────────────────────
  const handleRestore = (file: DeletedFile) => {
    setFiles(prev => prev.filter(f => f.file_id !== file.file_id))
    setRestoringSingle(null)
    // Navigate to original location after restore
    navigate(file.original_path)
  }

  const handleRestoreAll = () => {
    // Navigate to library after restoring all
    setFiles([])
    setConfirmRestoreAll(false)
    navigate('/library')
  }

  const handleDeleteSingle = (file: DeletedFile) => {
    setFiles(prev => prev.filter(f => f.file_id !== file.file_id))
    setDeletingSingle(null)
  }

  const handleEmptyBin = () => {
    setFiles([])
    setConfirmEmpty(false)
  }

  // ── Grid Card ──────────────────────────────────────────
  const GridCard = ({ file }: { file: DeletedFile }) => {
    const days = daysRemaining(file.deleted_at)
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden
                      group hover:border-beige/30 transition-all duration-200">

        {/* Thumbnail */}
        <div className="h-36 bg-surface2 flex items-center justify-center
                        relative opacity-60 group-hover:opacity-80 transition-opacity">
          {FILE_ICON[file.file_type]}

          {/* Days badge */}
          <span className={`absolute top-2 right-2 text-xs px-2 py-0.5
                            rounded-full border font-medium ${daysColor(days)}`}>
            {days}d left
          </span>

          {/* Hover actions */}
          <div className="absolute inset-0 bg-bg/60 opacity-0 group-hover:opacity-100
                          transition-opacity duration-200
                          flex items-center justify-center gap-3">
            <button
              onClick={() => setRestoringSingle(file)}
              className="w-9 h-9 rounded-full bg-beige flex items-center
                         justify-center hover:bg-beige-dim transition-colors"
              title="Restore"
            >
              <ArrowUturnLeftIcon className="w-4 h-4 text-bg" />
            </button>
            <button
              onClick={() => setDeletingSingle(file)}
              className="w-9 h-9 rounded-full bg-surface border border-red-800
                         flex items-center justify-center
                         hover:bg-red-900/40 transition-colors"
              title="Delete permanently"
            >
              <TrashIcon className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="px-3 py-2.5">
          <p className="text-beige-dim text-sm font-medium truncate">
            {file.original_name}
          </p>
          <p className="text-muted text-xs mt-0.5">
            Deleted {formatDate(file.deleted_at)}
            {' · '}
            {pathLabel(file.original_path)}
          </p>
        </div>
      </div>
    )
  }

  // ── List Row ───────────────────────────────────────────
  const ListRow = ({ file }: { file: DeletedFile }) => {
    const days = daysRemaining(file.deleted_at)
    return (
      <div className="flex items-center gap-4 px-4 py-3 bg-surface border border-border
                      rounded-xl group hover:border-beige/30 transition-all duration-200">

        {/* Icon */}
        <div className="w-10 h-10 bg-surface2 rounded-lg flex items-center
                        justify-center shrink-0 opacity-60">
          {FILE_ICON[file.file_type]}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-beige-dim text-sm font-medium truncate">
            {file.original_name}
          </p>
          <p className="text-muted text-xs mt-0.5">
            From {pathLabel(file.original_path)}
            {' · '}
            {formatSize(file.size)}
          </p>
        </div>

        {/* Deleted date */}
        <p className="text-muted text-sm hidden md:block w-32 text-right shrink-0">
          {formatDate(file.deleted_at)}
        </p>

        {/* Days badge */}
        <span className={`text-xs px-2.5 py-0.5 rounded-full border
                          font-medium shrink-0 ${daysColor(days)}`}>
          {days}d left
        </span>

        {/* Actions */}
        <div className="flex items-center gap-2
                        opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setRestoringSingle(file)}
            className="w-8 h-8 rounded-full bg-beige flex items-center
                       justify-center hover:bg-beige-dim transition-colors"
            title="Restore"
          >
            <ArrowUturnLeftIcon className="w-3.5 h-3.5 text-bg" />
          </button>
          <button
            onClick={() => setDeletingSingle(file)}
            className="w-8 h-8 rounded-full border border-red-800
                       flex items-center justify-center
                       hover:bg-red-900/40 transition-colors"
            title="Delete permanently"
          >
            <TrashIcon className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-main-bg px-6 py-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-beige">Recycle Bin</h1>
          <p className="text-muted text-sm mt-0.5">
            {files.length} file{files.length !== 1 ? 's' : ''} · Auto-deleted after 30 days
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-surface border border-border
                          rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-md transition-colors
                ${view === 'grid'
                  ? 'bg-beige text-bg'
                  : 'text-muted hover:text-beige'}`}
            >
              <Squares2X2Icon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-colors
                ${view === 'list'
                  ? 'bg-beige text-bg'
                  : 'text-muted hover:text-beige'}`}
            >
              <ListBulletIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Restore All */}
          {files.length > 0 && (
            <button
              onClick={() => setConfirmRestoreAll(true)}
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              <ArrowUturnLeftIcon className="w-4 h-4" />
              Restore All
            </button>
          )}

          {/* Empty Bin */}
          {files.length > 0 && (
            <button
              onClick={() => setConfirmEmpty(true)}
              className="btn-danger flex items-center gap-2 text-sm"
            >
              <TrashIcon className="w-4 h-4" />
              Empty Bin
            </button>
          )}
        </div>
      </div>

      {/* ── Warning banner ── */}
      {files.length > 0 && (
        <div className="flex items-center gap-3 bg-yellow-900/10 border border-yellow-800/40
                        rounded-xl px-4 py-3 mb-6">
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 shrink-0" />
          <p className="text-yellow-400/80 text-sm">
            Files in the Recycle Bin are permanently deleted after
            <span className="font-semibold text-yellow-400"> 30 days</span>.
            Restore files you want to keep.
          </p>
        </div>
      )}

      {/* ── Empty State ── */}
      {files.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <TrashIcon className="w-16 h-16 text-border mb-4" />
          <p className="text-beige-dim text-lg font-medium">Recycle Bin is empty</p>
          <p className="text-muted text-sm mt-1">
            Deleted files will appear here for 30 days
          </p>
        </div>
      )}

      {/* ── Grid View ── */}
      {view === 'grid' && files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4
                        lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {files.map(file => <GridCard key={file.file_id} file={file} />)}
        </div>
      )}

      {/* ── List View ── */}
      {view === 'list' && files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-4 px-4 py-2
                          text-xs text-muted uppercase tracking-wider">
            <div className="w-10 shrink-0" />
            <div className="flex-1">Name</div>
            <div className="hidden md:block w-32 text-right">Deleted</div>
            <div className="w-16 text-center">Expires</div>
            <div className="w-20" />
          </div>
          {files.map(file => <ListRow key={file.file_id} file={file} />)}
        </div>
      )}

      {/* ── Modals ── */}
      {restoringSingle && (
        <ConfirmModal
          title="Restore file?"
          message={`"${restoringSingle.original_name}" will be restored to ${pathLabel(restoringSingle.original_path)}.`}
          confirmLabel="Restore"
          onConfirm={() => handleRestore(restoringSingle)}
          onCancel={() => setRestoringSingle(null)}
        />
      )}

      {deletingSingle && (
        <ConfirmModal
          title="Permanently delete?"
          message={`"${deletingSingle.original_name}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete Forever"
          danger
          onConfirm={() => handleDeleteSingle(deletingSingle)}
          onCancel={() => setDeletingSingle(null)}
        />
      )}

      {confirmRestoreAll && (
        <ConfirmModal
          title="Restore all files?"
          message="All files will be restored to their original locations."
          confirmLabel="Restore All"
          onConfirm={handleRestoreAll}
          onCancel={() => setConfirmRestoreAll(false)}
        />
      )}

      {confirmEmpty && (
        <ConfirmModal
          title="Empty Recycle Bin?"
          message="All files will be permanently deleted. This cannot be undone."
          confirmLabel="Empty Bin"
          danger
          onConfirm={handleEmptyBin}
          onCancel={() => setConfirmEmpty(false)}
        />
      )}

    </div>
  )
}
