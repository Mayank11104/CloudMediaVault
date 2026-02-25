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

const NAV_SECTIONS = [
  {
    items: [
      { label: 'Library',   icon: FolderIcon,          to: '/library' },
      { label: 'Upload',    icon: ArrowUpTrayIcon,      to: '/upload'  },
    ],
  },
  {
    heading: 'Media',
    items: [
      { label: 'Photos',    icon: PhotoIcon,            to: '/photos'    },
      { label: 'Videos',    icon: FilmIcon,             to: '/videos'    },
      { label: 'Documents', icon: DocumentTextIcon,     to: '/documents' },
      { label: 'Albums',    icon: RectangleGroupIcon,   to: '/albums'    },
      { label: 'Recycle Bin',icon:TrashIcon ,   to: '/recycle-bin'    },
    ],
  },
  {
    heading: 'Account',
    items: [
      { label: 'Profile',   icon: UserCircleIcon,       to: '/profile'   },
    ],
  },
]

export default function Sidebar() {
  const navigate = useNavigate()

  return (
    <aside className="fixed top-0 left-0 h-screen w-[280px] bg-bg border-r border-beige/40 bg-bg flex flex-col z-40 select-none">

      {/* ── Logo ── */}
      <div
        className="flex items-center gap-3 px-4 py-5 cursor-pointer"
        onClick={() => navigate('/library')}
      >
        <div className="w-9 h-9 rounded-full bg-beige flex items-center justify-center shrink-0">
          <CloudIcon className="w-5 h-5 text-bg" />
        </div>
        <span className="text-beige font-bold text-[25px] leading-tight tracking-tight">
          CloudMediaVault<br />
        </span>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 py-2 space-y-6 overflow-y-auto">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.heading && (
              <p className="text-muted text-[25px] uppercase tracking-widest px-3 mb-1">
                {section.heading}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map(({ label, icon: Icon, to }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-full text-[16px] font-medium
                       transition-colors duration-150 group
                       ${isActive
                         ? 'bg-beige text-bg'
                         : 'text-beige-dim hover:bg-surface2 hover:text-beige'
                       }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-bg' : 'text-beige-dim group-hover:text-beige'}`} />
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

      {/* ── Storage indicator at bottom ── */}
      <div className="px-4 py-5 border-t border-border">
        <p className="text-muted text-xs mb-2">Storage</p>
        <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
          <div className="h-full bg-beige rounded-full" style={{ width: '34%' }} />
        </div>
        <p className="text-muted text-xs mt-1.5">3.4 GB of 10 GB used</p>
      </div>

    </aside>
  )
}
