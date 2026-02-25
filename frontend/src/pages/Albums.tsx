import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RectangleGroupIcon,
  PlusIcon,
  Squares2X2Icon,
  ListBulletIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'

// ── Types ──────────────────────────────────────────────────
type ViewMode = 'grid' | 'list'

interface Album {
  album_id:   string
  name:       string
  file_count: number
  created_at: string
  cover_url:  string | null
}

// ── Mock Data ──────────────────────────────────────────────
const MOCK_ALBUMS: Album[] = [
  {
    album_id:   'a1',
    name:       'Vacation 2026',
    file_count: 24,
    created_at: '2026-02-01T10:00:00Z',
    cover_url:  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
  },
  {
    album_id:   'a2',
    name:       'Work Docs',
    file_count: 12,
    created_at: '2026-01-15T09:00:00Z',
    cover_url:  null,
  },
  {
    album_id:   'a3',
    name:       'Family',
    file_count: 38,
    created_at: '2026-01-10T08:00:00Z',
    cover_url:  'https://images.unsplash.com/photo-1511895426328-dc8714191011?w=400',
  },
  {
    album_id:   'a4',
    name:       'Projects',
    file_count: 7,
    created_at: '2026-02-10T14:00:00Z',
    cover_url:  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400',
  },
  {
    album_id:   'a5',
    name:       'Screenshots',
    file_count: 53,
    created_at: '2026-02-18T11:00:00Z',
    cover_url:  null,
  },
  {
    album_id:   'a6',
    name:       'College Notes',
    file_count: 19,
    created_at: '2026-01-20T12:00:00Z',
    cover_url:  null,
  },
]

// ── Helpers ────────────────────────────────────────────────
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

// ── Create Album Modal ─────────────────────────────────────
function CreateAlbumModal({
  onConfirm,
  onCancel,
}: {
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
          className="input mb-5"
          placeholder="e.g. Summer Trip, Work Docs…"
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
            disabled={!name.trim()}
            onClick={() => name.trim() && onConfirm(name.trim())}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Rename Album Modal ─────────────────────────────────────
function RenameAlbumModal({
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
        <h2 className="text-beige font-semibold text-lg mb-1">Rename Album</h2>
        <p className="text-muted text-sm mb-5">Enter a new name for this album</p>

        <input
          className="input mb-5"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e =>
            e.key === 'Enter' && name.trim() && onConfirm(name.trim())
          }
          autoFocus
        />

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-ghost text-sm">
            Cancel
          </button>
          <button
            disabled={!name.trim() || name === current}
            onClick={() => name.trim() && onConfirm(name.trim())}
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

// ── Delete Album Modal ─────────────────────────────────────
function DeleteAlbumModal({
  albumName,
  onConfirm,
  onCancel,
}: {
  albumName: string
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
          <button onClick={onCancel} className="btn-ghost text-sm flex-1">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-danger text-sm flex-1">
            Delete Album
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Album Cover ────────────────────────────────────────────
function AlbumCover({
  cover_url,
  name,
  size = 'normal',
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

  const [albums,       setAlbums]       = useState<Album[]>(MOCK_ALBUMS)
  const [view,         setView]         = useState<ViewMode>('grid')
  const [showCreate,   setShowCreate]   = useState(false)
  const [renaming,     setRenaming]     = useState<Album | null>(null)
  const [deleting,     setDeleting]     = useState<Album | null>(null)

  // ── Handlers ──────────────────────────────────────────
  const handleCreate = (name: string) => {
    const newAlbum: Album = {
      album_id:   crypto.randomUUID(),
      name,
      file_count: 0,
      created_at: new Date().toISOString(),
      cover_url:  null,
    }
    setAlbums(prev => [newAlbum, ...prev])
    setShowCreate(false)
  }

  const handleRename = (name: string) => {
    if (!renaming) return
    setAlbums(prev =>
      prev.map(a => a.album_id === renaming.album_id ? { ...a, name } : a)
    )
    setRenaming(null)
  }

  const handleDelete = () => {
    if (!deleting) return
    setAlbums(prev => prev.filter(a => a.album_id !== deleting.album_id))
    setDeleting(null)
  }

  // ── Grid Card ──────────────────────────────────────────
  const GridCard = ({ album }: { album: Album }) => (
    <div
      onClick={() => navigate(`/albums/${album.album_id}`)}
      className="bg-surface border border-border rounded-xl overflow-hidden
                 cursor-pointer group hover:border-beige/30 transition-all duration-200"
    >
      {/* Cover */}
      <div className="relative overflow-hidden">
        <AlbumCover cover_url={album.cover_url} name={album.name} />

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-bg/60 opacity-0 group-hover:opacity-100
                        transition-opacity duration-200
                        flex items-center justify-center gap-3">
          <button
            onClick={e => { e.stopPropagation(); setRenaming(album) }}
            className="w-9 h-9 rounded-full bg-surface border border-border
                       flex items-center justify-center
                       hover:border-beige/40 hover:text-beige
                       text-muted transition-colors"
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

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="text-beige text-sm font-medium truncate">{album.name}</p>
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
      {/* Cover thumbnail */}
      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
        <AlbumCover cover_url={album.cover_url} name={album.name} size="small" />
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-beige text-sm font-medium truncate">{album.name}</p>
        <p className="text-muted text-xs mt-0.5">
          {album.file_count} file{album.file_count !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Date */}
      <p className="text-muted text-sm hidden md:block w-36 text-right shrink-0">
        {formatDate(album.created_at)}
      </p>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-2
                      opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={e => { e.stopPropagation(); setRenaming(album) }}
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
          {/* View Toggle */}
          <div className="flex items-center bg-surface border border-border
                          rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-md transition-colors
                ${view === 'grid'
                  ? 'bg-beige text-bg'
                  : 'text-muted hover:text-beige'}`}
              title="Grid view"
            >
              <Squares2X2Icon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-colors
                ${view === 'list'
                  ? 'bg-beige text-bg'
                  : 'text-muted hover:text-beige'}`}
              title="List view"
            >
              <ListBulletIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Create Album */}
          <button
            onClick={() => setShowCreate(true)}
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
            onClick={() => setShowCreate(true)}
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
          {/* List header */}
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
          onConfirm={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}
      {renaming && (
        <RenameAlbumModal
          current={renaming.name}
          onConfirm={handleRename}
          onCancel={() => setRenaming(null)}
        />
      )}
      {deleting && (
        <DeleteAlbumModal
          albumName={deleting.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

    </div>
  )
}
