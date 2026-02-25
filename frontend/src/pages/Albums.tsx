import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RectangleGroupIcon,
  PlusIcon,
  Squares2X2Icon,
  ListBulletIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import { api } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────
type ViewMode = 'grid' | 'list'

interface Album {
  album_id:   string
  album_name: string
  file_count: number
  created_at: string
  cover_url:  string | null
}

// ── Helpers ────────────────────────────────────────────────
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

// ── Create Album Modal ─────────────────────────────────────
function CreateAlbumModal({
  saving, error, onConfirm, onCancel,
}: {
  saving:    boolean
  error:     string
  onConfirm: (name: string) => void
  onCancel:  () => void
}) {
  const [name, setName] = useState('')

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50
                    flex items-center justify-center px-4">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-beige font-semibold text-lg mb-1">Create Album</h2>
        <p className="text-muted text-sm mb-5">Give your new album a name</p>

        <input
          className="input mb-2"
          placeholder="e.g. Summer Trip, Work Docs…"
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
            disabled={!name.trim() || saving}
            onClick={() => name.trim() && onConfirm(name.trim())}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
          >
            {saving
              ? <div className="w-3.5 h-3.5 border border-bg border-t-transparent
                                rounded-full animate-spin" />
              : <PlusIcon className="w-4 h-4" />
            }
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Rename Album Modal ─────────────────────────────────────
function RenameAlbumModal({
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
        <h2 className="text-beige font-semibold text-lg mb-1">Rename Album</h2>
        <p className="text-muted text-sm mb-5">Enter a new name for this album</p>

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
            disabled={!name.trim() || name === current || saving}
            onClick={() => name.trim() && onConfirm(name.trim())}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
          >
            {saving
              ? <div className="w-3.5 h-3.5 border border-bg border-t-transparent
                                rounded-full animate-spin" />
              : <CheckIcon className="w-4 h-4" />
            }
            {saving ? 'Saving…' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Album Modal ─────────────────────────────────────
function DeleteAlbumModal({
  albumName, saving, onConfirm, onCancel,
}: {
  albumName: string
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
        <h2 className="text-beige font-semibold text-lg mb-1">Delete Album?</h2>
        <p className="text-muted text-sm mb-6">
          <span className="text-beige-dim font-medium">"{albumName}"</span> will be
          deleted. Files inside will not be deleted.
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
            {saving ? 'Deleting…' : 'Delete Album'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Album Cover ────────────────────────────────────────────
function AlbumCover({
  cover_url, name, size = 'normal',
}: {
  cover_url: string | null
  name:      string
  size?:     'normal' | 'small'
}) {
  const h = size === 'small' ? 'h-12 w-12' : 'h-40'

  return cover_url ? (
    <img
      src={cover_url}
      alt={name}
      className={`${h} w-full object-cover`}
    />
  ) : (
    <div className={`${h} w-full bg-surface2 flex items-center justify-center`}>
      <PhotoIcon className="w-10 h-10 text-border" />
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────
export default function Albums() {
  const navigate = useNavigate()

  const [albums,       setAlbums]       = useState<Album[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [view,         setView]         = useState<ViewMode>('grid')
  const [showCreate,   setShowCreate]   = useState(false)
  const [renaming,     setRenaming]     = useState<Album | null>(null)
  const [deleting,     setDeleting]     = useState<Album | null>(null)

  // Per-modal saving + error state
  const [createSaving, setCreateSaving] = useState(false)
  const [createError,  setCreateError]  = useState('')
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameError,  setRenameError]  = useState('')
  const [deleteSaving, setDeleteSaving] = useState(false)

  // ── Fetch albums ───────────────────────────────────────
  const fetchAlbums = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api('/albums')
      setAlbums(data.albums ?? [])
    } catch (e: any) {
      setError(e.message ?? 'Failed to load albums')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAlbums() }, [fetchAlbums])

  // ── Create album ───────────────────────────────────────
  const handleCreate = async (name: string) => {
    setCreateSaving(true)
    setCreateError('')
    try {
      const data = await api('/albums', {
        method: 'POST',
        body:   JSON.stringify({ album_name: name }),
      })
      // Prepend new album returned by backend
      setAlbums(prev => [data.album, ...prev])
      setShowCreate(false)
    } catch (e: any) {
      setCreateError(e.message ?? 'Failed to create album')
    } finally {
      setCreateSaving(false)
    }
  }

  // ── Rename album ───────────────────────────────────────
  const handleRename = async (name: string) => {
    if (!renaming) return
    setRenameSaving(true)
    setRenameError('')
    try {
      await api(`/albums/${renaming.album_id}`, {
        method: 'PATCH',
        body:   JSON.stringify({ album_name: name }),
      })
      setAlbums(prev =>
        prev.map(a =>
          a.album_id === renaming.album_id ? { ...a, album_name: name } : a
        )
      )
      setRenaming(null)
    } catch (e: any) {
      setRenameError(e.message ?? 'Failed to rename album')
    } finally {
      setRenameSaving(false)
    }
  }

  // ── Delete album ───────────────────────────────────────
  const handleDelete = async () => {
    if (!deleting) return
    setDeleteSaving(true)
    try {
      await api(`/albums/${deleting.album_id}`, { method: 'DELETE' })
      setAlbums(prev => prev.filter(a => a.album_id !== deleting.album_id))
      setDeleting(null)
    } catch (e: any) {
      alert(e.message ?? 'Failed to delete album')
    } finally {
      setDeleteSaving(false)
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
        <button onClick={fetchAlbums} className="btn-primary">Retry</button>
      </div>
    </div>
  )

  // ── Grid Card ──────────────────────────────────────────
  const GridCard = ({ album }: { album: Album }) => (
    <div
      onClick={() => navigate(`/albums/${album.album_id}`)}
      className="bg-surface border border-border rounded-xl overflow-hidden
                 cursor-pointer group hover:border-beige/30 transition-all duration-200"
    >
      <div className="relative overflow-hidden">
        <AlbumCover cover_url={album.cover_url} name={album.album_name} />

        <div className="absolute inset-0 bg-bg/60 opacity-0 group-hover:opacity-100
                        transition-opacity duration-200
                        flex items-center justify-center gap-3">
          <button
            onClick={e => { e.stopPropagation(); setRenameError(''); setRenaming(album) }}
            className="w-9 h-9 rounded-full bg-surface border border-border
                       flex items-center justify-center text-muted
                       hover:border-beige/40 hover:text-beige transition-colors"
            title="Rename"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); setDeleting(album) }}
            className="w-9 h-9 rounded-full bg-surface border border-red-800
                       flex items-center justify-center
                       hover:bg-red-900/40 transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2.5">
        <p className="text-beige text-sm font-medium truncate">
          {album.album_name}
        </p>
        <p className="text-muted text-xs mt-0.5">
          {album.file_count} file{album.file_count !== 1 ? 's' : ''}
          {' · '}
          {formatDate(album.created_at)}
        </p>
      </div>
    </div>
  )

  // ── List Row ───────────────────────────────────────────
  const ListRow = ({ album }: { album: Album }) => (
    <div
      onClick={() => navigate(`/albums/${album.album_id}`)}
      className="flex items-center gap-4 px-4 py-3 bg-surface border border-border
                 rounded-xl cursor-pointer group
                 hover:border-beige/30 transition-all duration-200"
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
        <AlbumCover cover_url={album.cover_url} name={album.album_name} size="small" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-beige text-sm font-medium truncate">{album.album_name}</p>
        <p className="text-muted text-xs mt-0.5">
          {album.file_count} file{album.file_count !== 1 ? 's' : ''}
        </p>
      </div>

      <p className="text-muted text-sm hidden md:block w-36 text-right shrink-0">
        {formatDate(album.created_at)}
      </p>

      <div className="flex items-center gap-2
                      opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={e => { e.stopPropagation(); setRenameError(''); setRenaming(album) }}
          className="w-8 h-8 rounded-full flex items-center justify-center
                     text-muted hover:text-beige hover:bg-surface2 transition-colors"
          title="Rename"
        >
          <PencilIcon className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); setDeleting(album) }}
          className="w-8 h-8 rounded-full border border-red-800 flex items-center
                     justify-center hover:bg-red-900/40 transition-colors"
          title="Delete"
        >
          <TrashIcon className="w-3.5 h-3.5 text-red-400" />
        </button>
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-main-bg px-6 py-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-beige">Albums</h1>
          <p className="text-muted text-sm mt-0.5">
            {albums.length} album{albums.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
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

          <button
            onClick={() => { setCreateError(''); setShowCreate(true) }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <PlusIcon className="w-4 h-4" />
            New Album
          </button>
        </div>
      </div>

      {/* ── Empty State ── */}
      {albums.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <RectangleGroupIcon className="w-16 h-16 text-border mb-4" />
          <p className="text-beige-dim text-lg font-medium">No albums yet</p>
          <p className="text-muted text-sm mt-1">
            Create an album to organise your files
          </p>
          <button
            onClick={() => { setCreateError(''); setShowCreate(true) }}
            className="btn-primary mt-6 flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Create your first album
          </button>
        </div>
      )}

      {/* ── Grid View ── */}
      {view === 'grid' && albums.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4
                        lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {albums.map(album => (
            <GridCard key={album.album_id} album={album} />
          ))}
        </div>
      )}

      {/* ── List View ── */}
      {view === 'list' && albums.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-4 px-4 py-2
                          text-xs text-muted uppercase tracking-wider">
            <div className="w-12 shrink-0" />
            <div className="flex-1">Name</div>
            <div className="hidden md:block w-36 text-right">Created</div>
            <div className="w-20" />
          </div>
          {albums.map(album => (
            <ListRow key={album.album_id} album={album} />
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {showCreate && (
        <CreateAlbumModal
          saving={createSaving}
          error={createError}
          onConfirm={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}
      {renaming && (
        <RenameAlbumModal
          current={renaming.album_name}
          saving={renameSaving}
          error={renameError}
          onConfirm={handleRename}
          onCancel={() => setRenaming(null)}
        />
      )}
      {deleting && (
        <DeleteAlbumModal
          albumName={deleting.album_name}
          saving={deleteSaving}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

    </div>
  )
}
