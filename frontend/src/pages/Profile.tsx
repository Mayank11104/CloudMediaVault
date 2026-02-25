import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserCircleIcon,
  PencilIcon,
  ArrowRightOnRectangleIcon,
  TrashIcon,
  ShieldCheckIcon,
  CloudIcon,
  CameraIcon,
  CheckIcon,
  XMarkIcon,
  EyeIcon,
  EyeSlashIcon,
  PhotoIcon,
  FilmIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

// ── Types ──────────────────────────────────────────────────
type Tab = 'profile' | 'security' | 'storage'

interface UserData {
  name:       string
  email:      string
  avatar_url: string | null
  joined_at:  string
}

// ── Mock Data ──────────────────────────────────────────────
const MOCK_USER: UserData = {
  name:       'Rahul Sharma',
  email:      'rahul@example.com',
  avatar_url: null,
  joined_at:  '2025-12-01T00:00:00Z',
}

const MOCK_STORAGE = {
  used:  3.4,
  total: 10,
  breakdown: [
    { label: 'Photos',    size: 1.8, icon: <PhotoIcon        className="w-4 h-4" />, color: 'bg-blue-400'   },
    { label: 'Videos',    size: 1.2, icon: <FilmIcon         className="w-4 h-4" />, color: 'bg-purple-400' },
    { label: 'Documents', size: 0.4, icon: <DocumentTextIcon className="w-4 h-4" />, color: 'bg-green-400'  },
  ],
}

const MOCK_CONNECTED = [
  { provider: 'Google',   email: 'rahul@gmail.com', connected: true  },
]

// ── Helpers ────────────────────────────────────────────────
const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

// ── Confirm Modal ──────────────────────────────────────────
function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title:        string
  message:      string
  confirmLabel: string
  onConfirm:    () => void
  onCancel:     () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50
                    flex items-center justify-center px-4">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm">
        <div className="w-12 h-12 rounded-full bg-red-900/30 border border-red-800
                        flex items-center justify-center mb-4">
          <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
        </div>
        <h2 className="text-beige font-semibold text-lg mb-1">{title}</h2>
        <p className="text-muted text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}  className="btn-ghost  text-sm flex-1">Cancel</button>
          <button onClick={onConfirm} className="btn-danger text-sm flex-1">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ── Avatar ─────────────────────────────────────────────────
function Avatar({
  user,
  size = 'lg',
  onUpload,
}: {
  user:     UserData
  size?:    'lg' | 'sm'
  onUpload?: (url: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const dim     = size === 'lg' ? 'w-24 h-24 text-2xl' : 'w-10 h-10 text-sm'

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onUpload) return
    const url = URL.createObjectURL(file)
    onUpload(url)
  }

  return (
    <div className="relative inline-block">
      {user.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={user.name}
          className={`${dim} rounded-full object-cover border-2 border-border`}
        />
      ) : (
        <div className={`${dim} rounded-full bg-beige flex items-center
                         justify-center font-bold text-bg border-2 border-border`}>
          {getInitials(user.name)}
        </div>
      )}

      {/* Upload overlay */}
      {onUpload && (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 rounded-full bg-black/50 opacity-0
                       hover:opacity-100 transition-opacity flex items-center
                       justify-center"
          >
            <CameraIcon className="w-6 h-6 text-beige" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </>
      )}
    </div>
  )
}

// ── Profile Tab ────────────────────────────────────────────
function ProfileTab({
  user,
  onUpdate,
}: {
  user:     UserData
  onUpdate: (u: Partial<UserData>) => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [name,        setName]        = useState(user.name)

  const saveName = () => {
    if (name.trim() && name !== user.name) onUpdate({ name: name.trim() })
    setEditingName(false)
  }

  return (
    <div className="space-y-6">

      {/* ── Avatar + Basic Info ── */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-6">
          <Avatar user={user} size="lg" onUpload={url => onUpdate({ avatar_url: url })} />
          <div className="flex-1 min-w-0">
            <p className="text-muted text-xs uppercase tracking-wider mb-1">Full Name</p>

            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  className="input text-lg font-semibold py-1.5 max-w-xs"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  autoFocus
                />
                <button
                  onClick={saveName}
                  className="w-8 h-8 rounded-full bg-beige flex items-center
                             justify-center hover:bg-beige-dim transition-colors"
                >
                  <CheckIcon className="w-4 h-4 text-bg" />
                </button>
                <button
                  onClick={() => { setName(user.name); setEditingName(false) }}
                  className="w-8 h-8 rounded-full bg-surface2 flex items-center
                             justify-center text-muted hover:text-beige transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h2 className="text-beige text-xl font-semibold">{user.name}</h2>
                <button
                  onClick={() => setEditingName(true)}
                  className="w-7 h-7 rounded-full flex items-center justify-center
                             text-muted hover:text-beige hover:bg-surface2 transition-colors"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <p className="text-muted text-sm mt-1">{user.email}</p>
            <p className="text-muted text-xs mt-1">
              Member since {formatDate(user.joined_at)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Connected Accounts ── */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <h3 className="text-beige font-semibold mb-4">Connected Accounts</h3>
        <div className="space-y-3">
          {MOCK_CONNECTED.map(acc => (
            <div key={acc.provider}
              className="flex items-center justify-between px-4 py-3
                         bg-surface2 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                {/* Google G icon */}
                <div className="w-8 h-8 rounded-full bg-white flex items-center
                                justify-center text-sm font-bold text-gray-700">
                  G
                </div>
                <div>
                  <p className="text-beige text-sm font-medium">{acc.provider}</p>
                  <p className="text-muted text-xs">{acc.email}</p>
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium
                ${acc.connected
                  ? 'text-green-400 bg-green-900/20 border-green-800'
                  : 'text-muted bg-surface border-border'
                }`}>
                {acc.connected ? 'Connected' : 'Not connected'}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

// ── Security Tab ───────────────────────────────────────────
function SecurityTab() {
  const [current,  setCurrent]  = useState('')
  const [newPass,  setNewPass]  = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showCurr, setShowCurr] = useState(false)
  const [showNew,  setShowNew]  = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [saved,    setSaved]    = useState(false)

  const canSave = current && newPass.length >= 8 && newPass === confirm

  const handleSave = () => {
    setSaved(true)
    setCurrent(''); setNewPass(''); setConfirm('')
    setTimeout(() => setSaved(false), 3000)
  }

  const PasswordField = ({
    label, value, show, onChange, onToggle, placeholder,
  }: {
    label:       string
    value:       string
    show:        boolean
    onChange:    (v: string) => void
    onToggle:    () => void
    placeholder: string
  }) => (
    <div>
      <label className="text-muted text-xs uppercase tracking-wider mb-1.5 block">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className="input pr-10"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2
                     text-muted hover:text-beige transition-colors"
        >
          {show
            ? <EyeSlashIcon className="w-4 h-4" />
            : <EyeIcon      className="w-4 h-4" />
          }
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* ── Change Password ── */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <ShieldCheckIcon className="w-5 h-5 text-beige-dim" />
          <h3 className="text-beige font-semibold">Change Password</h3>
        </div>

        <div className="space-y-4 max-w-sm">
          <PasswordField
            label="Current Password"
            value={current}
            show={showCurr}
            onChange={setCurrent}
            onToggle={() => setShowCurr(o => !o)}
            placeholder="Enter current password"
          />
          <PasswordField
            label="New Password"
            value={newPass}
            show={showNew}
            onChange={setNewPass}
            onToggle={() => setShowNew(o => !o)}
            placeholder="Min 8 characters"
          />
          <PasswordField
            label="Confirm New Password"
            value={confirm}
            show={showConf}
            onChange={setConfirm}
            onToggle={() => setShowConf(o => !o)}
            placeholder="Repeat new password"
          />

          {/* Mismatch warning */}
          {confirm && newPass !== confirm && (
            <p className="text-red-400 text-xs">Passwords do not match</p>
          )}
          {/* Too short warning */}
          {newPass && newPass.length < 8 && (
            <p className="text-yellow-400 text-xs">
              Password must be at least 8 characters
            </p>
          )}

          {saved && (
            <p className="text-green-400 text-xs flex items-center gap-1.5">
              <CheckIcon className="w-3.5 h-3.5" />
              Password updated successfully
            </p>
          )}

          <button
            disabled={!canSave}
            onClick={handleSave}
            className="btn-primary text-sm disabled:opacity-40"
          >
            Update Password
          </button>
        </div>
      </div>

    </div>
  )
}

// ── Storage Tab ────────────────────────────────────────────
function StorageTab() {
  const { used, total, breakdown } = MOCK_STORAGE
  const pct = (used / total) * 100

  const barColors = ['bg-blue-400', 'bg-purple-400', 'bg-green-400']

  return (
    <div className="space-y-6">

      {/* ── Overall Usage ── */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <CloudIcon className="w-5 h-5 text-beige-dim" />
          <h3 className="text-beige font-semibold">Storage Usage</h3>
        </div>

        {/* Big usage display */}
        <div className="flex items-end gap-2 mb-3">
          <span className="text-4xl font-bold text-beige">{used} GB</span>
          <span className="text-muted text-lg mb-1">/ {total} GB</span>
        </div>

        {/* Overall bar */}
        <div className="h-3 bg-surface2 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500
              ${pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-yellow-400' : 'bg-beige'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-muted text-xs">
          {(total - used).toFixed(1)} GB free · {pct.toFixed(0)}% used
        </p>
      </div>

      {/* ── Breakdown ── */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <h3 className="text-beige font-semibold mb-5">Breakdown by Type</h3>

        <div className="space-y-4">
          {breakdown.map((item, i) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-beige-dim">
                  {item.icon}
                  <span className="text-sm">{item.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-beige text-sm font-medium">
                    {item.size} GB
                  </span>
                  <span className="text-muted text-xs ml-2">
                    ({((item.size / used) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColors[i]}`}
                  style={{ width: `${(item.size / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Segmented bar */}
        <div className="mt-6 h-2 rounded-full overflow-hidden flex">
          {breakdown.map((item, i) => (
            <div
              key={item.label}
              className={`h-full ${barColors[i]}`}
              style={{ width: `${(item.size / total) * 100}%` }}
            />
          ))}
          {/* Free space */}
          <div
            className="h-full bg-surface2 flex-1"
          />
        </div>
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          {breakdown.map((item, i) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${barColors[i]}`} />
              <span className="text-muted text-xs">{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-surface2 border border-border" />
            <span className="text-muted text-xs">Free</span>
          </div>
        </div>
      </div>

    </div>
  )
}

// ── Main Component ─────────────────────────────────────────
export default function Profile() {
  const navigate = useNavigate()

  const [user,        setUser]        = useState<UserData>(MOCK_USER)
  const [activeTab,   setActiveTab]   = useState<Tab>('profile')
  const [showLogout,  setShowLogout]  = useState(false)
  const [showDelete,  setShowDelete]  = useState(false)

  const TABS: { key: Tab; label: string; icon: JSX.Element }[] = [
    { key: 'profile',  label: 'Profile',  icon: <UserCircleIcon  className="w-4 h-4" /> },
    { key: 'security', label: 'Security', icon: <ShieldCheckIcon className="w-4 h-4" /> },
    { key: 'storage',  label: 'Storage',  icon: <CloudIcon       className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-main-bg px-6 py-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Avatar user={user} size="sm" />
          <div>
            <h1 className="text-2xl font-bold text-beige">{user.name}</h1>
            <p className="text-muted text-sm">{user.email}</p>
          </div>
        </div>

        <button
          onClick={() => setShowLogout(true)}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          Logout
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 bg-surface border border-border
                      rounded-xl p-1 w-fit mb-8">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                        font-medium transition-colors
              ${activeTab === tab.key
                ? 'bg-beige text-bg'
                : 'text-muted hover:text-beige'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="max-w-2xl">
        {activeTab === 'profile'  && (
          <ProfileTab
            user={user}
            onUpdate={u => setUser(prev => ({ ...prev, ...u }))}
          />
        )}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'storage'  && <StorageTab />}
      </div>

      {/* ── Danger Zone ── */}
      <div className="max-w-2xl mt-8">
        <div className="bg-surface border border-red-900/40 rounded-2xl p-6">
          <h3 className="text-red-400 font-semibold mb-1 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5" />
            Danger Zone
          </h3>
          <p className="text-muted text-sm mb-4">
            Permanently delete your account and all your files. This cannot be undone.
          </p>
          <button
            onClick={() => setShowDelete(true)}
            className="btn-danger flex items-center gap-2 text-sm"
          >
            <TrashIcon className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      </div>

      {/* ── Modals ── */}
      {showLogout && (
        <ConfirmModal
          title="Log out?"
          message="You will be signed out of your account."
          confirmLabel="Log Out"
          onConfirm={() => navigate('/login')}
          onCancel={() => setShowLogout(false)}
        />
      )}
      {showDelete && (
        <ConfirmModal
          title="Delete account?"
          message="All your files, albums and data will be permanently deleted. This cannot be undone."
          confirmLabel="Delete Forever"
          onConfirm={() => navigate('/login')}
          onCancel={() => setShowDelete(false)}
        />
      )}

    </div>
  )
}
