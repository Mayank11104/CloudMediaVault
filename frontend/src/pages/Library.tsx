import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'

import type { ReactElement , SVGProps } from 'react'

// ── Types ──────────────────────────────────────────────────
type FileType = 'image' | 'video' | 'document'
type ViewMode = 'grid' | 'list'
type SortKey  = 'date' | 'name' | 'size'
type Filter   = 'all' | FileType



interface ApiFile {
  file_id:     string
  file_name:   string
  file_type:   FileType
  file_size:   number
  uploaded_at: string
  s3_key:      string
  s3_url?:     string
  width?:      number
  height?:     number
  is_deleted:  boolean
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



const FILE_ICON: Record<
  FileType,
  ReactElement<SVGProps<SVGSVGElement>>
> = {
  image:    <PhotoIcon className="w-8 h-8 text-beige-dim" />,
  video:    <FilmIcon className="w-8 h-8 text-beige-dim" />,
  document: <DocumentTextIcon className="w-8 h-8 text-beige-dim" />,
}


const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All',       value: 'all'      },
  { label: 'Photos',    value: 'image'    },
  { label: 'Videos',    value: 'video'    },
  { label: 'Documents', value: 'document' },
]



const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Date', value: 'date' },
  { label: 'Name', value: 'name' },
  { label: 'Size', value: 'size' },
]



const FILTER_ROUTES: Record<Filter, string> = {
  all:      '/library',
  image:    '/photos',
  video:    '/videos',
  document: '/documents',
}



interface LibraryProps {
  presetFilter?: Filter
  pageTitle?:    string
}



// ── Main Component ─────────────────────────────────────────
export default function Library({
  presetFilter = 'all',
  pageTitle    = 'Library',
}: LibraryProps) {
  const navigate   = useNavigate()
  const sortRef    = useRef<HTMLDivElement>(null)



  const [view,     setView]     = useState<ViewMode>('grid')
  const [filter,   setFilter]   = useState<Filter>(presetFilter)
  const [search,   setSearch]   = useState('')
  const [sort,     setSort]     = useState<SortKey>('date')
  const [sortOpen, setSortOpen] = useState(false)
  const [files,    setFiles]    = useState<ApiFile[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)



  // ── Close sort dropdown on outside click ──────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])



  // ── Sync filter tab with presetFilter prop ─────────────
  useEffect(() => {
    setFilter(presetFilter)
  }, [presetFilter])



  // ── Fetch files ────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const endpoint =
        presetFilter === 'image'    ? '/files/photos'    :
        presetFilter === 'video'    ? '/files/videos'    :
        presetFilter === 'document' ? '/files/documents' :
        '/files'



      const data = await api(endpoint)
      setFiles(data.files ?? [])
    } catch (e: any) {
      setError(e.message ?? 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [presetFilter])



  useEffect(() => { fetchFiles() }, [fetchFiles])



  // ── Filter + Search + Sort (client-side) ───────────────
  const processed = files
    .filter(f => filter === 'all' || f.file_type === filter)
    .filter(f => f.file_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'date') return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
      if (sort === 'name') return a.file_name.localeCompare(b.file_name)
      if (sort === 'size') return b.file_size - a.file_size
      return 0
    })



  // ── Soft delete → Recycle Bin ──────────────────────────
  const handleDelete = async (e: React.MouseEvent, file_id: string) => {
    e.stopPropagation()
    setDeleting(file_id)
    try {
      await api(`/files/${file_id}`, { method: 'DELETE' })
      setFiles(prev => prev.filter(f => f.file_id !== file_id))
    } catch (e: any) {
      alert(e.message ?? 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }



  // ── Download via presigned URL ─────────────────────────
  const handleDownload = async (e: React.MouseEvent, file: ApiFile) => {
    e.stopPropagation()
    try {
      const data = await api(`/files/${file.file_id}`)
      const a    = document.createElement('a')
      a.href     = data.presigned_url
      a.download = file.file_name
      a.click()
    } catch (e: any) {
      alert(e.message ?? 'Download failed')
    }
  }



  // ── Loading state ──────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-main-bg flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-beige border-t-transparent
                      rounded-full animate-spin" />
    </div>
  )



  // ── Error state ────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen bg-main-bg flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={fetchFiles} className="btn-primary">Retry</button>
      </div>
    </div>
  )



  // ── Grid Card ──────────────────────────────────────────
 // ── Grid Card ──────────────────────────────────────────────
const GridCard = ({ file }: { file: ApiFile }) => {
  const aspectRatio = file.width && file.height 
    ? file.width / file.height 
    : 1

  const isImage = file.file_type === 'image'
  const isVideo = file.file_type === 'video'
  const hasThumbnail = file.s3_url && (isImage || isVideo)

  return (
    <div
      onClick={() => navigate(`/files/${file.file_id}`)}
      className="bg-surface border border-border rounded-xl overflow-hidden
                 cursor-pointer group hover:border-beige/30 transition-all duration-200
                 mb-4 break-inside-avoid"
    >
      {/* ✅ Image with EXACT aspect ratio */}
      <div 
        className="bg-surface2 flex items-center justify-center relative overflow-hidden w-full"
        style={{ aspectRatio: aspectRatio.toString() }}
      >
        {hasThumbnail ? (
          isImage ? (
            <img 
              src={file.s3_url} 
              alt={file.file_name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <video 
              src={file.s3_url}
              className="w-full h-full object-cover"
              preload="metadata"
            />
          )
        ) : (
          FILE_ICON[file.file_type]
        )}

        <div className="absolute inset-0 bg-bg/60 opacity-0 group-hover:opacity-100
                        transition-opacity duration-200
                        flex items-center justify-center gap-3">
          <button
            onClick={e => handleDownload(e, file)}
            className="w-9 h-9 rounded-full bg-beige flex items-center
                       justify-center hover:bg-beige-dim transition-colors"
            title="Download"
          >
            <ArrowDownTrayIcon className="w-4 h-4 text-bg" />
          </button>
          <button
            onClick={e => handleDelete(e, file.file_id)}
            disabled={deleting === file.file_id}
            className="w-9 h-9 rounded-full bg-surface border border-red-800
                       flex items-center justify-center
                       hover:bg-red-900/40 transition-colors disabled:opacity-50"
            title="Delete"
          >
            {deleting === file.file_id
              ? <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent
                                rounded-full animate-spin" />
              : <TrashIcon className="w-4 h-4 text-red-400" />
            }
          </button>
        </div>
      </div>

      <div className="px-3 py-2.5">
        <p className="text-beige text-sm font-medium truncate">{file.file_name}</p>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-muted text-xs">{formatDate(file.uploaded_at)}</p>
          <p className="text-muted text-xs">{formatSize(file.file_size)}</p>
        </div>
      </div>
    </div>
  )
}




  // ── List Row ───────────────────────────────────────────
  const ListRow = ({ file }: { file: ApiFile }) => (
    <div
      onClick={() => navigate(`/files/${file.file_id}`)}
      className="flex items-center gap-4 px-4 py-3 rounded-xl bg-surface border border-border
                 cursor-pointer group hover:border-beige/30 transition-all duration-200"
    >
      <div className="w-10 h-10 bg-surface2 rounded-lg flex items-center
                      justify-center shrink-0">
        {React.cloneElement(FILE_ICON[file.file_type], {
          className: 'w-5 h-5 text-beige-dim',
        })}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-beige text-sm font-medium truncate">{file.file_name}</p>
        <p className="text-muted text-xs mt-0.5 capitalize">{file.file_type}</p>
      </div>

      <p className="text-beige-dim text-sm hidden sm:block w-20 text-right shrink-0">
        {formatSize(file.file_size)}
      </p>
      <p className="text-muted text-sm hidden md:block w-32 text-right shrink-0">
        {formatDate(file.uploaded_at)}
      </p>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100
                      transition-opacity shrink-0">
        <button
          onClick={e => handleDownload(e, file)}
          className="w-8 h-8 rounded-full bg-beige flex items-center
                     justify-center hover:bg-beige-dim transition-colors"
          title="Download"
        >
          <ArrowDownTrayIcon className="w-3.5 h-3.5 text-bg" />
        </button>
        <button
          onClick={e => handleDelete(e, file.file_id)}
          disabled={deleting === file.file_id}
          className="w-8 h-8 rounded-full border border-red-800
                     flex items-center justify-center
                     hover:bg-red-900/40 transition-colors disabled:opacity-50"
          title="Delete"
        >
          {deleting === file.file_id
            ? <div className="w-3 h-3 border border-red-400 border-t-transparent
                              rounded-full animate-spin" />
            : <TrashIcon className="w-3.5 h-3.5 text-red-400" />
          }
        </button>
      </div>
    </div>
  )



  // ── Render ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-main-bg px-6 py-8">

      {/* ── Top Bar ── */}
      <div className="flex flex-col gap-4 mb-8">

        {/* Row 1 — Title + Upload */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-beige">{pageTitle}</h1>
            <p className="text-muted text-sm mt-0.5">
              {processed.length} file{processed.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
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

        {/* Row 2 — Search + Sort + View */}
        <div className="flex items-center gap-3">

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2
                                            -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              className="input pl-9 pr-9"
              placeholder="Search files…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2
                           text-muted hover:text-beige transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen(o => !o)}
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              Sort: {SORT_OPTIONS.find(s => s.value === sort)?.label}
              <ChevronDownIcon className={`w-4 h-4 transition-transform
                ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-surface
                              border border-border rounded-xl overflow-hidden
                              shadow-xl z-20">
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

          {/* View toggle */}
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
            {search
              ? `No results for "${search}"`
              : 'Upload something to get started'
            }
          </p>
          {search ? (
            <button
              onClick={() => setSearch('')}
              className="btn-ghost mt-4 text-sm"
            >
              Clear search
            </button>
          ) : (
            <button
              onClick={() => navigate('/upload')}
              className="btn-primary mt-6"
            >
              Upload your first file
            </button>
          )}
        </div>
      )}

      {/* ── Grid View ── */}
     {/* ── Grid View ── */}
{view === 'grid' && processed.length > 0 && (
  <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-4">
    {processed.map(file => (
      <GridCard key={file.file_id} file={file} />
    ))}
  </div>
)}

      {/* ── List View ── */}
      {view === 'list' && processed.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-4 px-4 py-2
                          text-xs text-muted uppercase tracking-wider">
            <div className="w-10 shrink-0" />
            <div className="flex-1">Name</div>
            <div className="hidden sm:block w-20 text-right">Size</div>
            <div className="hidden md:block w-32 text-right">Date</div>
            <div className="w-20" />
          </div>
          {processed.map(file => (
            <ListRow key={file.file_id} file={file} />
          ))}
        </div>
      )}

    </div>
  )
}
