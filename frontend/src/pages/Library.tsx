import React from 'react'
import { useState } from 'react'
import {
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  PhotoIcon,
  FilmIcon,
  DocumentTextIcon,
  FolderIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'

// ── Types ──────────────────────────────────────────────────
type FileType = 'image' | 'video' | 'document'
type ViewMode = 'grid' | 'list'
type SortKey  = 'date' | 'name' | 'size'
type Filter   = 'all' | FileType

interface MockFile {
  file_id:       string
  original_name: string
  file_type:     FileType
  size:          number
  created_at:    string
}

// ── Mock data (replace with API later) ────────────────────
const MOCK_FILES: MockFile[] = [
  { file_id: '1', original_name: 'vacation-photo.jpg',   file_type: 'image',    size: 3200000,  created_at: '2026-02-20T10:00:00Z' },
  { file_id: '2', original_name: 'project-demo.mp4',     file_type: 'video',    size: 52000000, created_at: '2026-02-19T08:30:00Z' },
  { file_id: '3', original_name: 'resume-2026.pdf',      file_type: 'document', size: 450000,   created_at: '2026-02-18T14:00:00Z' },
  { file_id: '4', original_name: 'birthday-party.jpg',   file_type: 'image',    size: 4100000,  created_at: '2026-02-17T09:00:00Z' },
  { file_id: '5', original_name: 'lecture-notes.docx',   file_type: 'document', size: 120000,   created_at: '2026-02-16T11:00:00Z' },
  { file_id: '6', original_name: 'sunset-timelapse.mp4', file_type: 'video',    size: 89000000, created_at: '2026-02-15T17:00:00Z' },
  { file_id: '7', original_name: 'profile-pic.png',      file_type: 'image',    size: 1800000,  created_at: '2026-02-14T12:00:00Z' },
  { file_id: '8', original_name: 'assignment.pdf',       file_type: 'document', size: 980000,   created_at: '2026-02-13T10:00:00Z' },
  { file_id: '9', original_name: 'trip-video.mp4',       file_type: 'video',    size: 120000000,created_at: '2026-02-12T08:00:00Z' },
  { file_id: '10',original_name: 'screenshot.png',       file_type: 'image',    size: 540000,   created_at: '2026-02-11T16:00:00Z' },
]
// Add this inside the component, above the return
const FILTER_ROUTES: Record<Filter, string> = {
  all:      '/library',
  image:    '/photos',
  video:    '/videos',
  document: '/documents',
}

// ── Helpers ────────────────────────────────────────────────
const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

const FILE_ICON: Record<FileType, JSX.Element> = {
  image:    <PhotoIcon    className="w-8 h-8 text-beige-dim" />,
  video:    <FilmIcon     className="w-8 h-8 text-beige-dim" />,
  document: <DocumentTextIcon className="w-8 h-8 text-beige-dim" />,
}

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All',       value: 'all'      },
  { label: 'Photos',    value: 'image'    },
  { label: 'Videos',    value: 'video'    },
  { label: 'Documents', value: 'document' },
]

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Date',  value: 'date' },
  { label: 'Name',  value: 'name' },
  { label: 'Size',  value: 'size' },
]
interface LibraryProps {
  presetFilter?: 'all' | 'image' | 'video' | 'document'
  pageTitle?:    string
}
// ── Main Component ─────────────────────────────────────────
export default function Library({ presetFilter = 'all', pageTitle = 'Library' }: LibraryProps) {
  const navigate = useNavigate()

  const [view,       setView]       = useState<ViewMode>('grid')
  const [filter, setFilter] = useState<Filter>(presetFilter)
  const [search,     setSearch]     = useState('')
  const [sort,       setSort]       = useState<SortKey>('date')
  const [sortOpen,   setSortOpen]   = useState(false)
  const [files,      setFiles]      = useState<MockFile[]>(MOCK_FILES)

  // ── Filter + Search + Sort ─────────────────────────────
  const processed = files
    .filter(f => filter === 'all' || f.file_type === filter)
    .filter(f => f.original_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'date') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'name') return a.original_name.localeCompare(b.original_name)
      if (sort === 'size') return b.size - a.size
      return 0
    })

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setFiles(prev => prev.filter(f => f.file_id !== id))
  }

  // ── Grid Card ──────────────────────────────────────────
  const GridCard = ({ file }: { file: MockFile }) => (
    <div
      onClick={() => navigate(`/files/${file.file_id}`)}
      className="bg-surface border border-border rounded-xl overflow-hidden
                 cursor-pointer group hover:border-beige/30 transition-all duration-200"
    >
      {/* Thumbnail area */}
      <div className="h-36 bg-surface2 flex items-center justify-center relative">
        {FILE_ICON[file.file_type]}

        {/* Hover actions */}
        <div className="absolute inset-0 bg-bg/60 opacity-0 group-hover:opacity-100
                        transition-opacity duration-200 flex items-center justify-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/files/${file.file_id}`) }}
            className="w-9 h-9 rounded-full bg-beige flex items-center justify-center
                       hover:bg-beige-dim transition-colors"
            title="Download"
          >
            <ArrowDownTrayIcon className="w-4 h-4 text-bg" />
          </button>
          <button
            onClick={(e) => handleDelete(e, file.file_id)}
            className="w-9 h-9 rounded-full bg-surface border border-red-800
                       flex items-center justify-center hover:bg-red-900/40 transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="text-beige text-sm font-medium truncate">{file.original_name}</p>
        <p className="text-muted text-xs mt-0.5">{formatDate(file.created_at)}</p>
      </div>
    </div>
  )

  // ── List Row ───────────────────────────────────────────
  const ListRow = ({ file }: { file: MockFile }) => (
    <div
      onClick={() => navigate(`/files/${file.file_id}`)}
      className="flex items-center gap-4 px-4 py-3 rounded-xl bg-surface border border-border
                 cursor-pointer group hover:border-beige/30 transition-all duration-200"
    >
      {/* Icon */}
      <div className="w-10 h-10 bg-surface2 rounded-lg flex items-center justify-center shrink-0">
        {React.cloneElement(FILE_ICON[file.file_type], { className: 'w-5 h-5 text-beige-dim' })}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-beige text-sm font-medium truncate">{file.original_name}</p>
        <p className="text-muted text-xs mt-0.5 capitalize">{file.file_type}</p>
      </div>

      {/* Size */}
      <p className="text-beige-dim text-sm hidden sm:block w-20 text-right">
        {formatSize(file.size)}
      </p>

      {/* Date */}
      <p className="text-muted text-sm hidden md:block w-32 text-right">
        {formatDate(file.created_at)}
      </p>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/files/${file.file_id}`) }}
          className="w-8 h-8 rounded-full bg-beige flex items-center justify-center
                     hover:bg-beige-dim transition-colors"
          title="Download"
        >
          <ArrowDownTrayIcon className="w-3.5 h-3.5 text-bg" />
        </button>
        <button
          onClick={(e) => handleDelete(e, file.file_id)}
          className="w-8 h-8 rounded-full border border-red-800
                     flex items-center justify-center hover:bg-red-900/40 transition-colors"
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

      {/* ── Top Bar ── */}
      <div className="flex flex-col gap-4 mb-8">

        {/* Row 1 — Title + Upload button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-beige">{pageTitle}</h1>
            <p className="text-muted text-sm mt-0.5">
              {processed.length} file{processed.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => navigate('/upload')}
            className="btn-primary flex items-center gap-2"
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            Upload
          </button>
        </div>

        {/* Row 2 — Search + Sort + View Toggle */}
        <div className="flex items-center gap-3">

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              className="input pl-9"
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setSortOpen(o => !o)}
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              Sort: {SORT_OPTIONS.find(s => s.value === sort)?.label}
              <ChevronDownIcon className={`w-4 h-4 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-surface border border-border
                              rounded-xl overflow-hidden shadow-xl z-20">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSort(opt.value); setSortOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                      ${sort === opt.value
                        ? 'text-beige bg-surface2'
                        : 'text-beige-dim hover:bg-surface2 hover:text-beige'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-surface border border-border rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-md transition-colors
                ${view === 'grid' ? 'bg-beige text-bg' : 'text-muted hover:text-beige'}`}
              title="Grid view"
            >
              <Squares2X2Icon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-colors
                ${view === 'list' ? 'bg-beige text-bg' : 'text-muted hover:text-beige'}`}
              title="List view"
            >
              <ListBulletIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 3 — Filter Tabs */}
        <div className="flex items-center gap-2">
          {FILTERS.map(f => (
      <button
        key={f.value}
        onClick={() => navigate(FILTER_ROUTES[f.value])}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
          ${filter === f.value
            ? 'bg-beige text-bg'
            : 'bg-surface text-beige-dim border border-border hover:text-beige hover:border-beige/40'
          }`}
      >
        {f.label}
      </button>
    ))}
        </div>
      </div>

      {/* ── Empty State ── */}
      {processed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <FolderIcon className="w-16 h-16 text-border mb-4" />
          <p className="text-beige-dim text-lg font-medium">No files found</p>
          <p className="text-muted text-sm mt-1">
            {search ? 'Try a different search term' : 'Upload something to get started'}
          </p>
          {!search && (
            <button onClick={() => navigate('/upload')} className="btn-primary mt-6">
              Upload your first file
            </button>
          )}
        </div>
      )}

      {/* ── Grid View ── */}
      {view === 'grid' && processed.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {processed.map(file => <GridCard key={file.file_id} file={file} />)}
        </div>
      )}

      {/* ── List View ── */}
      {view === 'list' && processed.length > 0 && (
        <div className="space-y-2">
          {/* List Header */}
          <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted uppercase tracking-wider">
            <div className="w-10 shrink-0" />
            <div className="flex-1">Name</div>
            <div className="hidden sm:block w-20 text-right">Size</div>
            <div className="hidden md:block w-32 text-right">Date</div>
            <div className="w-20" />
          </div>
          {processed.map(file => <ListRow key={file.file_id} file={file} />)}
        </div>
      )}

    </div>
  )
}
