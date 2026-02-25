import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  CloudIcon,
  FolderIcon,
  ArrowUpTrayIcon,
  PhotoIcon,
  FilmIcon,
  DocumentTextIcon,
  RectangleGroupIcon,
  UserCircleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { api } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────
interface StorageInfo {
  total_bytes: number
  plan_bytes:  number   // e.g. 10 GB plan
}

// ── Nav config ─────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    items: [
      { label: 'Library',     icon: FolderIcon,        to: '/library'     },
      { label: 'Upload',      icon: ArrowUpTrayIcon,   to: '/upload'      },
    ],
  },
  {
    heading: 'Media',
    items: [
      { label: 'Photos',      icon: PhotoIcon,         to: '/photos'      },
      { label: 'Videos',      icon: FilmIcon,          to: '/videos'      },
      { label: 'Documents',   icon: DocumentTextIcon,  to: '/documents'   },
      { label: 'Albums',      icon: RectangleGroupIcon,to: '/albums'      },
      { label: 'Recycle Bin', icon: TrashIcon,         to: '/recycle-bin' },
    ],
  },
  {
    heading: 'Account',
    items: [
      { label: 'Profile',     icon: UserCircleIcon,    to: '/profile'     },
    ],
  },
]

// ── Helpers ────────────────────────────────────────────────
const PLAN_BYTES = 10 * 1024 ** 3   // 10 GB

const bytesToGB = (bytes: number) =>
  (bytes / 1024 ** 3).toFixed(1)

const storageColor = (pct: number) => {
  if (pct >= 90) return 'bg-red-400'
  if (pct >= 70) return 'bg-yellow-400'
  return 'bg-beige'
}

// ── Component ──────────────────────────────────────────────
export default function Sidebar() {
  const navigate = useNavigate()

  const [usedBytes, setUsedBytes] = useState<number | null>(null)

  // ── Fetch real storage on mount ────────────────────────
  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const data = await api('/files/stats')
        setUsedBytes(data.total_bytes ?? 0)
      } catch {
        // Silently fail — storage bar just stays hidden
      }
    }
    fetchStorage()
  }, [])

  // ── Recompute storage bar values ───────────────────────
  const pct     = usedBytes !== null
    ? Math.min((usedBytes / PLAN_BYTES) * 100, 100)
    : 0
  const usedGB  = usedBytes !== null ? bytesToGB(usedBytes)    : null
  const totalGB = bytesToGB(PLAN_BYTES)

  return (
    <aside className="fixed top-0 left-0 h-screen w-[280px] bg-bg border-r
                      border-beige/40 flex flex-col z-40 select-none">

      {/* ── Logo ── */}
      <div
        className="flex items-center gap-3 px-4 py-5 cursor-pointer"
        onClick={() => navigate('/library')}
      >
        <div className="w-9 h-9 rounded-full bg-beige flex items-center
                        justify-center shrink-0">
          <CloudIcon className="w-5 h-5 text-bg" />
        </div>
        <span className="text-beige font-bold text-[25px] leading-tight tracking-tight">
          CloudMediaVault
        </span>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 py-2 space-y-6 overflow-y-auto">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.heading && (
              <p className="text-muted text-xs uppercase tracking-widest px-3 mb-1">
                {section.heading}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map(({ label, icon: Icon, to }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-full
                       text-[16px] font-medium transition-colors duration-150 group
                       ${isActive
                         ? 'bg-beige text-bg'
                         : 'text-beige-dim hover:bg-surface2 hover:text-beige'
                       }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={`w-5 h-5 shrink-0
                          ${isActive
                            ? 'text-bg'
                            : 'text-beige-dim group-hover:text-beige'
                          }`}
                        />
                        <span>{label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Storage indicator ── */}
      <div className="px-4 py-5 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <p className="text-muted text-xs">Storage</p>
          {usedBytes !== null && (
            <p className={`text-xs font-medium ${
              pct >= 90 ? 'text-red-400' :
              pct >= 70 ? 'text-yellow-400' : 'text-muted'
            }`}>
              {pct.toFixed(0)}%
            </p>
          )}
        </div>

        {/* Bar */}
        <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
          {usedBytes !== null ? (
            <div
              className={`h-full rounded-full transition-all duration-700
                          ${storageColor(pct)}`}
              style={{ width: `${pct}%` }}
            />
          ) : (
            /* Skeleton shimmer while loading */
            <div className="h-full w-1/3 bg-surface2 rounded-full
                            animate-pulse" />
          )}
        </div>

        {/* Label */}
        <p className="text-muted text-xs mt-1.5">
          {usedGB !== null
            ? `${usedGB} GB of ${totalGB} GB used`
            : 'Loading…'
          }
        </p>

        {/* Warning when near limit */}
        {pct >= 90 && (
          <p className="text-red-400 text-xs mt-1.5">
            ⚠ Storage almost full
          </p>
        )}
        {pct >= 70 && pct < 90 && (
          <p className="text-yellow-400 text-xs mt-1.5">
            Storage is getting full
          </p>
        )}
      </div>

    </aside>
  )
}
