import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import { api } from '@/lib/api'
import type { ReactNode } from 'react'

// ── Types ──────────────────────────────────────────────────
type FileType = 'image' | 'video' | 'document'

interface FileData {
  file_id:       string
  file_name:     string
  file_type:     FileType
  mime_type:     string
  file_size:     number
  created_at:    string
  presigned_url: string  // kept in type but no longer used for preview/download
}

interface Album {
  album_id:   string
  album_name: string
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
// 🔴 OLD: used file.presigned_url → encrypted bytes
// ✅ NEW: uses /preview endpoint → backend decrypts before streaming
function FilePreview({ file }: { file: FileData }) {
  const [imgError, setImgError] = useState(false)
  const previewSrc = `/api/files/${file.file_id}/preview`

  if (file.file_type === 'image') {
    return imgError ? (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3">
        <PhotoIcon className="w-16 h-16 text-muted" />
        <p className="text-muted text-sm">Preview unavailable</p>
      </div>
    ) : (
      <img
        src={previewSrc}
        alt={file.file_name}
        onError={() => setImgError(true)}
        className="w-full h-full object-contain rounded-xl"
      />
    )
  }

  if (file.file_type === 'video') {
    return (
      <video
        src={previewSrc}
        controls
        className="w-full h-full rounded-xl object-contain bg-black"
      >
        Your browser does not support video playback.
      </video>
    )
  }

  if (file.file_type === 'document') {
    const isPDF      = file.mime_type === 'application/pdf'
    // 🔴 OLD: used presigned_url directly (encrypted) + google docs viewer
    // ✅ NEW: /preview streams decrypted bytes — works for PDF inline
    //         non-PDF docs still use Google Docs viewer via /preview URL
    const previewUrl = isPDF
      ? previewSrc
      : `https://docs.google.com/gview?url=${encodeURIComponent(
          window.location.origin + previewSrc
        )}&embedded=true`

    return (
      <iframe
        src={previewUrl}
        title={file.file_name}
        className="w-full h-full rounded-xl border-0"
      />
    )
  }

  return null
}

// ── Info Card ──────────────────────────────────────────────
function InfoCard({
  icon, label, value,
}: {
  icon: ReactNode
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
      <p className="text-beige text-sm font-medium truncate">{value}</p>
    </div>
  )
}

// ── Rename Modal ───────────────────────────────────────────
function RenameModal({
  current, saving, error, onConfirm, onCancel,
}: {
  current:   string
  saving:    boolean
  error:     string
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
          className="input mb-2"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e =>
            e.key === 'Enter' && name.trim() && !saving && onConfirm(name.trim())
          }
          autoFocus
          disabled={saving}
        />
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <div className="flex gap-3 justify-end mt-3">
          <button onClick={onCancel} disabled={saving} className="btn-ghost text-sm">
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim() || name === current || saving}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
          >
            {saving
              ? <div className="w-3.5 h-3.5 border border-bg border-t-transparent rounded-full animate-spin" />
              : <CheckIcon className="w-4 h-4" />
            }
            {saving ? 'Saving…' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Move to Album Modal ────────────────────────────────────
function AlbumModal({
  fileId, onDone, onCancel,
}: {
  fileId:   string
  onDone:   () => void
  onCancel: () => void
}) {
  const [albums,   setAlbums]   = useState<Album[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const data = await api('/albums')
        setAlbums(data.albums ?? [])
      } catch (e: any) {
        setError(e.message ?? 'Failed to load albums')
      } finally {
        setLoading(false)
      }
    }
    fetchAlbums()
  }, [])

  const handleMove = async () => {
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      await api(`/albums/${selected}/files`, {
        method: 'POST',
        body:   JSON.stringify({ file_id: fileId }),
      })
      onDone()
    } catch (e: any) {
      setError(e.message ?? 'Failed to move file')
    } finally {
      setSaving(false)
    }
  }

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

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-beige border-t-transparent
                            rounded-full animate-spin" />
          </div>
        )}

        {!loading && albums.length > 0 && (
          <div className="space-y-2 mb-5 max-h-64 overflow-y-auto pr-1">
            {albums.map(album => (
              <button
                key={album.album_id}
                onClick={() => setSelected(album.album_id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl
                            border transition-colors text-left
                  ${selected === album.album_id
                    ? 'border-beige bg-beige/5 text-beige'
                    : 'border-border text-beige-dim hover:border-beige/30 hover:text-beige'
                  }`}
              >
                <RectangleGroupIcon className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">{album.album_name}</span>
                {selected === album.album_id && (
                  <CheckIcon className="w-4 h-4 ml-auto" />
                )}
              </button>
            ))}
          </div>
        )}

        {!loading && albums.length === 0 && (
          <p className="text-muted text-sm text-center py-8">
            No albums yet. Create one from the Albums page.
          </p>
        )}

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={saving} className="btn-ghost text-sm">
            Cancel
          </button>
          <button
            disabled={!selected || saving || loading}
            onClick={handleMove}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
          >
            {saving
              ? <div className="w-3.5 h-3.5 border border-bg border-t-transparent rounded-full animate-spin" />
              : <RectangleGroupIcon className="w-4 h-4" />
            }
            {saving ? 'Moving…' : 'Move'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ───────────────────────────────────
function DeleteModal({
  fileName, saving, onConfirm, onCancel,
}: {
  fileName:  string
  saving:    boolean
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
          moved to the Recycle Bin.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={saving}
            className="btn-ghost text-sm flex-1"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="btn-danger text-sm flex-1 flex items-center justify-center gap-2"
          >
            {saving && (
              <div className="w-3.5 h-3.5 border border-white/30 border-t-white
                              rounded-full animate-spin" />
            )}
            {saving ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────
export default function FileDetail() {
  const navigate = useNavigate()
  const { id }   = useParams<{ id: string }>()

  const [file,         setFile]         = useState<FileData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [showRename,   setShowRename]   = useState(false)
  const [showAlbum,    setShowAlbum]    = useState(false)
  const [showDelete,   setShowDelete]   = useState(false)
  const [previewOpen,  setPreviewOpen]  = useState(false)
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameError,  setRenameError]  = useState('')
  const [deleteSaving, setDeleteSaving] = useState(false)

  const fetchFile = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const data = await api(`/files/${id}`)
      setFile(data)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load file')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchFile() }, [fetchFile])

  const handleRename = async (newName: string) => {
    if (!file) return
    setRenameSaving(true)
    setRenameError('')
    try {
      await api(`/files/${file.file_id}`, {
        method: 'PATCH',
        body:   JSON.stringify({ file_name: newName }),
      })
      setFile(prev => prev ? { ...prev, file_name: newName } : prev)
      setShowRename(false)
    } catch (e: any) {
      setRenameError(e.message ?? 'Rename failed')
    } finally {
      setRenameSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!file) return
    setDeleteSaving(true)
    try {
      await api(`/files/${file.file_id}`, { method: 'DELETE' })
      navigate('/library')
    } catch (e: any) {
      alert(e.message ?? 'Delete failed')
      setDeleteSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-main-bg flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-beige border-t-transparent
                      rounded-full animate-spin" />
    </div>
  )

  if (error || !file) return (
    <div className="min-h-screen bg-main-bg flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error || 'File not found'}</p>
        <button onClick={() => navigate('/library')} className="btn-primary">
          Back to Library
        </button>
      </div>
    </div>
  )

  const TYPE_ICON: Record<FileType, ReactNode> = {
    image:    <PhotoIcon        className="w-6 h-6 text-beige-dim" />,
    video:    <FilmIcon         className="w-6 h-6 text-beige-dim" />,
    document: <DocumentTextIcon className="w-6 h-6 text-beige-dim" />,
  }

  return (
    <div className="min-h-screen bg-main-bg px-6 py-8">

      <button
        onClick={() => navigate('/library')}
        className="flex items-center gap-2 text-muted hover:text-beige
                   transition-colors text-sm mb-6 group"
      >
        <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Library
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          {TYPE_ICON[file.file_type]}
          <h1 className="text-2xl font-bold text-beige truncate">
            {file.file_name}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setRenameError(''); setShowRename(true) }}
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

          {/* 🔴 OLD: <a href={file.presigned_url} download> → encrypted bytes */}
          {/* ✅ NEW: /download endpoint → backend decrypts before sending */}
          <a
            href={`/api/files/${file.file_id}/download`}
            download={file.file_name}
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

      <div
        className="w-full bg-surface border border-border rounded-2xl overflow-hidden
                   mb-6 cursor-zoom-in"
        style={{ height: '480px' }}
        onClick={() => setPreviewOpen(true)}
      >
        <FilePreview file={file} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <InfoCard
          icon={<TagIcon            className="w-4 h-4 text-muted" />}
          label="File name"
          value={file.file_name}
        />
        <InfoCard
          icon={TYPE_ICON[file.file_type]}
          label="Type"
          value={file.file_type.charAt(0).toUpperCase() + file.file_type.slice(1)}
        />
        <InfoCard
          icon={<ScaleIcon          className="w-4 h-4 text-muted" />}
          label="Size"
          value={formatSize(file.file_size)}
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

      {showRename && (
        <RenameModal
          current={file.file_name}
          saving={renameSaving}
          error={renameError}
          onConfirm={handleRename}
          onCancel={() => setShowRename(false)}
        />
      )}
      {showAlbum && (
        <AlbumModal
          fileId={file.file_id}
          onDone={() => setShowAlbum(false)}
          onCancel={() => setShowAlbum(false)}
        />
      )}
      {showDelete && (
        <DeleteModal
          fileName={file.file_name}
          saving={deleteSaving}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}

    </div>
  )
}
