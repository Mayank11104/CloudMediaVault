import { useState, useEffect, useCallback } from 'react'
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
} from '@heroicons/react/24/outline'
import { api } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────
type FileType = 'image' | 'video' | 'document'
type ViewMode = 'grid' | 'list'

interface DeletedFile {
  file_id:     string
  file_name:   string
  file_type:   FileType
  file_size:   number
  updated_at:  string   // when it was soft deleted
}

// ── Helpers ────────────────────────────────────────────────
const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

// Days remaining before auto-delete (30 day window)
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
          <TrashIcon className={`w-6 h-6 ${danger ? 'text-red-400' : 'text-beige-dim'}`} />
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

  const [files,             setFiles]             = useState<DeletedFile[]>([])
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState('')
  const [view,              setView]              = useState<ViewMode>('grid')
  const [confirmEmpty,      setConfirmEmpty]      = useState(false)
  const [confirmRestoreAll, setConfirmRestoreAll] = useState(false)
  const [deletingSingle,    setDeletingSingle]    = useState<DeletedFile | null>(null)
  const [restoringSingle,   setRestoringSingle]   = useState<DeletedFile | null>(null)

  // ── Fetch deleted files ────────────────────────────────
  const fetchDeleted = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api('/files/recycle-bin')
      setFiles(data.files ?? [])
    } catch (e: any) {
      setError(e.message ?? 'Failed to load recycle bin')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeleted()
  }, [fetchDeleted])

  // ── Auto-delete expired files on load ─────────────────
  // Files older than 30 days are permanently deleted automatically
  useEffect(() => {
    if (files.length === 0) return

    const expired = files.filter(f => daysRemaining(f.updated_at) === 0)
    if (expired.length === 0) return

    const purgeExpired = async () => {
      await Promise.all(
        expired.map(f =>
          api(`/files/${f.file_id}/permanent`, { method: 'DELETE' })
            .catch(() => {}) // ignore individual errors
        )
      )
      // Remove expired from UI
      setFiles(prev =>
        prev.filter(f => daysRemaining(f.updated_at) > 0)
      )
    }

    purgeExpired()
  }, [files.length]) // run once after files load

  // ── Restore single ─────────────────────────────────────
  const handleRestore = async (file: DeletedFile) => {
    try {
      await api(`/files/${file.file_id}/restore`, { method: 'POST' })
      setFiles(prev => prev.filter(f => f.file_id !== file.file_id))
      setRestoringSingle(null)
      navigate('/library')
    } catch (e: any) {
      alert(e.message ?? 'Restore failed')
    }
  }

  // ── Restore all ────────────────────────────────────────
  const handleRestoreAll = async () => {
    try {
      await Promise.all(
        files.map(f =>
          api(`/files/${f.file_id}/restore`, { method: 'POST' })
        )
      )
      setFiles([])
      setConfirmRestoreAll(false)
      navigate('/library')
    } catch (e: any) {
      alert(e.message ?? 'Restore all failed')
    }
  }

  // ── Permanent delete single ────────────────────────────
  const handleDeleteSingle = async (file: DeletedFile) => {
    try {
      await api(`/files/${file.file_id}/permanent`, { method: 'DELETE' })
      setFiles(prev => prev.filter(f => f.file_id !== file.file_id))
      setDeletingSingle(null)
    } catch (e: any) {
      alert(e.message ?? 'Delete failed')
    }
  }

  // ── Empty bin ──────────────────────────────────────────
  const handleEmptyBin = async () => {
    try {
      await Promise.all(
        files.map(f =>
          api(`/files/${f.file_id}/permanent`, { method: 'DELETE' })
        )
      )
      setFiles([])
      setConfirmEmpty(false)
    } catch (e: any) {
      alert(e.message ?? 'Empty bin failed')
    }
  }

  // ── Loading / Error states ─────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-main-bg flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-beige border-t-transparent
                      rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-main-bg flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={fetchDeleted} className="btn-primary">Retry</button>
      </div>
    </div>
  )

  // ── Grid Card ──────────────────────────────────────────
  const GridCard = ({ file }: { file: DeletedFile }) => {
    const days = daysRemaining(file.updated_at)
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden
                      group hover:border-beige/30 transition-all duration-200">
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

        <div className="px-3 py-2.5">
          <p className="text-beige-dim text-sm font-medium truncate">
            {file.file_name}
          </p>
          <p className="text-muted text-xs mt-0.5">
            Deleted {formatDate(file.updated_at)}
            {' · '}
            {formatSize(file.file_size)}
          </p>
        </div>
      </div>
    )
  }

  // ── List Row ───────────────────────────────────────────
  const ListRow = ({ file }: { file: DeletedFile }) => {
    const days = daysRemaining(file.updated_at)
    return (
      <div className="flex items-center gap-4 px-4 py-3 bg-surface border border-border
                      rounded-xl group hover:border-beige/30 transition-all duration-200">
        <div className="w-10 h-10 bg-surface2 rounded-lg flex items-center
                        justify-center shrink-0 opacity-60">
          {FILE_ICON[file.file_type]}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-beige-dim text-sm font-medium truncate">
            {file.file_name}
          </p>
          <p className="text-muted text-xs mt-0.5">
            {formatSize(file.file_size)}
          </p>
        </div>

        <p className="text-muted text-sm hidden md:block w-32 text-right shrink-0">
          {formatDate(file.updated_at)}
        </p>

        <span className={`text-xs px-2.5 py-0.5 rounded-full border
                          font-medium shrink-0 ${daysColor(days)}`}>
          {days}d left
        </span>

        <div className="flex items-center gap-2
                        opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setRestoringSingle(file)}
            className="w-8 h-8 rounded-full bg-beige flex items-center
                       justify-center hover:bg-beige-dim transition-colors"
          >
            <ArrowUturnLeftIcon className="w-3.5 h-3.5 text-bg" />
          </button>
          <button
            onClick={() => setDeletingSingle(file)}
            className="w-8 h-8 rounded-full border border-red-800
                       flex items-center justify-center
                       hover:bg-red-900/40 transition-colors"
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
                ${view === 'grid' ? 'bg-beige text-bg' : 'text-muted hover:text-beige'}`}
            >
              <Squares2X2Icon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-colors
                ${view === 'list' ? 'bg-beige text-bg' : 'text-muted hover:text-beige'}`}
            >
              <ListBulletIcon className="w-4 h-4" />
            </button>
          </div>

          {files.length > 0 && (
            <button
              onClick={() => setConfirmRestoreAll(true)}
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              <ArrowUturnLeftIcon className="w-4 h-4" />
              Restore All
            </button>
          )}

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
          message={`"${restoringSingle.file_name}" will be restored to your Library.`}
          confirmLabel="Restore"
          onConfirm={() => handleRestore(restoringSingle)}
          onCancel={() => setRestoringSingle(null)}
        />
      )}

      {deletingSingle && (
        <ConfirmModal
          title="Permanently delete?"
          message={`"${deletingSingle.file_name}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete Forever"
          danger
          onConfirm={() => handleDeleteSingle(deletingSingle)}
          onCancel={() => setDeletingSingle(null)}
        />
      )}

      {confirmRestoreAll && (
        <ConfirmModal
          title="Restore all files?"
          message="All files will be restored to your Library."
          confirmLabel="Restore All"
          onConfirm={handleRestoreAll}
          onCancel={() => setConfirmRestoreAll(false)}
        />
      )}

      {confirmEmpty && (
        <ConfirmModal
          title="Empty Recycle Bin?"
          message="All files will be permanently deleted from S3 and database. This cannot be undone."
          confirmLabel="Empty Bin"
          danger
          onConfirm={handleEmptyBin}
          onCancel={() => setConfirmEmpty(false)}
        />
      )}

    </div>
  )
}
