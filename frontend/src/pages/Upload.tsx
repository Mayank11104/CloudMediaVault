import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import {
  CloudArrowUpIcon,
  PhotoIcon,
  FilmIcon,
  DocumentTextIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline'
import { uploadFile } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────
type Status = 'pending' | 'uploading' | 'done' | 'error'

interface QueueItem {
  id:       string
  file:     File
  progress: number
  status:   Status
  error:    string | null
}

// ── Constants ──────────────────────────────────────────────
const ALLOWED_TYPES = {
  'image/jpeg':    ['.jpg', '.jpeg'],
  'image/png':     ['.png'],
  'image/gif':     ['.gif'],
  'image/webp':    ['.webp'],
  'video/mp4':     ['.mp4'],
  'video/webm':    ['.webm'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
}
const MAX_SIZE = 100 * 1024 * 1024 // 100MB

// ── Helpers ────────────────────────────────────────────────
const getFileType = (mime: string) => {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  return 'document'
}

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FILE_ICON: Record<string, JSX.Element> = {
  image:    <PhotoIcon        className="w-5 h-5 text-beige-dim" />,
  video:    <FilmIcon         className="w-5 h-5 text-beige-dim" />,
  document: <DocumentTextIcon className="w-5 h-5 text-beige-dim" />,
}

const STATUS_COLORS: Record<Status, string> = {
  pending:   'text-muted',
  uploading: 'text-beige-dim',
  done:      'text-green-400',
  error:     'text-red-400',
}

// ── Drop Zone UI ───────────────────────────────────────────
function DropZone({
  getRootProps,
  getInputProps,
  isDragActive,
}: {
  getRootProps:  any
  getInputProps: any
  isDragActive:  boolean
}) {
  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-2xl flex flex-col items-center
        justify-center cursor-pointer transition-all duration-200
        select-none min-h-[calc(100vh-200px)]
        ${isDragActive
          ? 'border-beige bg-beige/5 scale-[1.01]'
          : 'border-border hover:border-beige/40 hover:bg-surface/60 bg-surface/30'
        }
      `}
    >
      <input {...getInputProps()} />
      <div className={`w-20 h-20 rounded-full flex items-center justify-center
                       mb-5 transition-all
                       ${isDragActive ? 'bg-beige/20' : 'bg-surface2'}`}>
        <CloudArrowUpIcon className={`w-10 h-10 transition-colors
                                      ${isDragActive ? 'text-beige' : 'text-beige-dim'}`} />
      </div>
      <p className="text-beige font-semibold text-lg mb-1">
        {isDragActive ? 'Drop files here…' : 'Drag & drop files here'}
      </p>
      <p className="text-muted text-sm mb-4">or click to browse</p>
      <div className="flex gap-2 flex-wrap justify-center">
        {['JPG', 'PNG', 'GIF', 'WEBP', 'MP4', 'WEBM', 'PDF', 'DOC', 'DOCX'].map(ext => (
          <span key={ext} className="badge">{ext}</span>
        ))}
      </div>
      <p className="text-muted text-xs mt-3">Max 100 MB per file</p>
    </div>
  )
}

// ── Queue Row UI ───────────────────────────────────────────
function QueueRow({
  item,
  onRemove,
}: {
  item:     QueueItem
  onRemove: (id: string) => void
}) {
  const type = getFileType(item.file.type)

  return (
    <div className="flex items-center gap-3 bg-surface border border-border
                    rounded-xl px-4 py-3 hover:border-beige/20 transition-colors">
      <div className="w-9 h-9 bg-surface2 rounded-lg flex items-center
                      justify-center shrink-0">
        {FILE_ICON[type]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-beige text-sm font-medium truncate pr-2">
            {item.file.name}
          </p>
          <span className={`text-xs font-medium shrink-0 ${STATUS_COLORS[item.status]}`}>
            {item.status === 'pending'   && 'Pending'}
            {item.status === 'uploading' && 'Uploading…'}
            {item.status === 'done'      && '✓ Done'}
            {item.status === 'error'     && '✗ Failed'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-surface2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300
              ${item.status === 'done'      ? 'bg-green-400' :
                item.status === 'error'     ? 'bg-red-500'   :
                item.status === 'uploading' ? 'bg-beige animate-pulse' : 'bg-surface2'
              }`}
            style={{ width: item.status === 'uploading' ? '100%' :
                            item.status === 'done'      ? '100%' :
                            item.status === 'error'     ? '100%' : '0%' }}
          />
        </div>

        <div className="flex items-center justify-between mt-1">
          <p className="text-muted text-xs">{formatSize(item.file.size)}</p>
          {item.error && (
            <p className="text-red-400 text-xs">{item.error}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {item.status === 'done' && (
          <CheckCircleIcon className="w-5 h-5 text-green-400" />
        )}
        {item.status === 'error' && (
          <ExclamationCircleIcon className="w-5 h-5 text-red-400" />
        )}
        {(item.status === 'pending' || item.status === 'error') && (
          <button
            onClick={() => onRemove(item.id)}
            className="w-7 h-7 rounded-full flex items-center justify-center
                       text-muted hover:text-beige hover:bg-surface2 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────
export default function Upload() {
  const navigate                = useNavigate()
  const [queue,    setQueue]    = useState<QueueItem[]>([])
  const [rejected, setRejected] = useState<string[]>([])

  // ── Real upload to backend ─────────────────────────────
  const uploadToBackend = async (item: QueueItem) => {
    // Set uploading
    setQueue(prev =>
      prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q)
    )

    try {
      await uploadFile(item.file)   // ✅ real API call

      // Set done
      setQueue(prev =>
        prev.map(q =>
          q.id === item.id
            ? { ...q, status: 'done', progress: 100 }
            : q
        )
      )
    } catch (e: any) {
      // Set error
      setQueue(prev =>
        prev.map(q =>
          q.id === item.id
            ? { ...q, status: 'error', error: e.message ?? 'Upload failed' }
            : q
        )
      )
    }
  }

  // ── Dropzone ───────────────────────────────────────────
  const onDrop = useCallback((accepted: File[], rejectedFiles: any[]) => {
    setRejected(
      rejectedFiles.map(r =>
        `${r.file.name} — ${r.errors[0]?.message ?? 'Invalid file'}`
      )
    )

    const newItems: QueueItem[] = accepted.map(file => ({
      id:       crypto.randomUUID(),
      file,
      progress: 0,
      status:   'pending',
      error:    null,
    }))

    setQueue(prev => [...prev, ...newItems])

    // Upload each file sequentially
    newItems.forEach(item => {
      uploadToBackend(item)
    })
  }, [])

  const removeItem = (id: string) =>
    setQueue(prev => prev.filter(q => q.id !== id))

  const doneCount      = queue.filter(q => q.status === 'done').length
  const uploadingCount = queue.filter(q => q.status === 'uploading').length
  const allDone        = queue.length > 0 &&
    queue.every(q => q.status === 'done' || q.status === 'error')

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept:   ALLOWED_TYPES,
    maxSize:  MAX_SIZE,
    multiple: true,
  })

  return (
    <div className="min-h-screen bg-main-bg px-6 py-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-beige">Upload</h1>
          <p className="text-muted text-sm mt-0.5">
            {uploadingCount > 0
              ? `Uploading ${uploadingCount} file${uploadingCount > 1 ? 's' : ''}…`
              : 'Images, videos and documents · Max 100 MB each'
            }
          </p>
        </div>
        <ViewColumnsIcon className="w-5 h-5 text-muted" />
      </div>

      {/* ── Rejected files warning ── */}
      {rejected.length > 0 && (
        <div className="mb-4 bg-red-900/20 border border-red-800
                        rounded-xl px-4 py-3 space-y-1">
          {rejected.map((msg, i) => (
            <p key={i} className="text-red-400 text-sm">❌ {msg}</p>
          ))}
        </div>
      )}

      {/* ── Split Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left — Drop Zone */}
        <DropZone
          getRootProps={getRootProps}
          getInputProps={getInputProps}
          isDragActive={isDragActive}
        />

        {/* Right — Queue */}
        <div className="flex flex-col gap-3">
          {queue.length === 0 ? (
            <div className="min-h-[calc(100vh-200px)] flex flex-col items-center
                            justify-center border-2 border-dashed border-border
                            rounded-2xl text-center px-6">
              <p className="text-beige-dim font-medium mb-1">Upload queue</p>
              <p className="text-muted text-sm">
                Files you drop will appear here with live progress
              </p>
            </div>
          ) : (
            <>
              {/* Queue header */}
              <div className="flex items-center justify-between px-1">
                <p className="text-beige-dim text-sm font-medium">
                  {doneCount}/{queue.length} uploaded
                </p>
                <p className="text-muted text-xs">
                  {uploadingCount > 0 ? `${uploadingCount} in progress…` : ''}
                </p>
              </div>

              {/* Queue list */}
              <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
                {queue.map(item => (
                  <QueueRow key={item.id} item={item} onRemove={removeItem} />
                ))}
              </div>

              {/* All done banner */}
              {allDone && (
                <div className="mt-2 flex items-center justify-between
                                bg-surface border border-green-800
                                rounded-xl px-5 py-4">
                  <div className="flex items-center gap-3">
                    <CheckCircleIcon className="w-6 h-6 text-green-400 shrink-0" />
                    <div>
                      <p className="text-beige font-medium text-sm">
                        All uploads complete!
                      </p>
                      <p className="text-muted text-xs mt-0.5">
                        {doneCount} file{doneCount !== 1 ? 's' : ''} uploaded successfully
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setQueue([]); setRejected([]) }}
                      className="btn-ghost text-sm"
                    >
                      Upload More
                    </button>
                    <button
                      onClick={() => navigate('/library')}
                      className="btn-primary text-sm"
                    >
                      Go to Library →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  )
}
