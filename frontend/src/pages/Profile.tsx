import { useState, useRef, useEffect, useCallback } from 'react'
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
import { useAuthStore } from '@/auth/useAuthStore'
import { api } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────
type Tab = 'profile' | 'security' | 'storage'

interface UserData {
  name:       string
  email:      string
  avatar_url: string | null
  joined_at:  string
}

interface StorageStats {
  total_bytes:       number
  total_gb:          number
  images_bytes:      number
  videos_bytes:      number
  documents_bytes:   number
  file_count:        number
}

// ── Helpers ────────────────────────────────────────────────
const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

const bytesToGB = (bytes: number) =>
  parseFloat((bytes / (1024 ** 3)).toFixed(2))

// ── Confirm Modal ──────────────────────────────────────────
function ConfirmModal({
  title, message, confirmLabel, onConfirm, onCancel,
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
  user, size = 'lg', onUpload,
}: {
  user:      UserData
  size?:     'lg' | 'sm'
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
  user, onUpdate,
}: {
  user:     UserData
  onUpdate: (u: Partial<UserData>) => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [name,        setName]        = useState(user.name)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  // ── Update name via Cognito ────────────────────────────
  const saveName = async () => {
    if (!name.trim() || name === user.name) {
      setEditingName(false)
      return
    }
    setSaving(true)
    setError('')
    try {
      await api('/auth/update-profile', {
        method: 'PATCH',
        body:   JSON.stringify({ name: name.trim() }),
      })
      onUpdate({ name: name.trim() })
      setEditingName(false)
    } catch (e: any) {
      setError(e.message ?? 'Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-6">
          <Avatar
            user={user}
            size="lg"
            onUpload={url => onUpdate({ avatar_url: url })}
          />
          <div className="flex-1 min-w-0">
            <p className="text-muted text-xs uppercase tracking-wider mb-1">
              Full Name
            </p>

            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  className="input text-lg font-semibold py-1.5 max-w-xs"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  autoFocus
                  disabled={saving}
                />
                <button
                  onClick={saveName}
                  disabled={saving}
                  className="w-8 h-8 rounded-full bg-beige flex items-center
                             justify-center hover:bg-beige-dim transition-colors
                             disabled:opacity-40"
                >
                  {saving
                    ? <div className="w-3 h-3 border border-bg border-t-transparent rounded-full animate-spin" />
                    : <CheckIcon className="w-4 h-4 text-bg" />
                  }
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

            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
            <p className="text-muted text-sm mt-1">{user.email}</p>
            <p className="text-muted text-xs mt-1">
              Member since {formatDate(user.joined_at)}
            </p>
          </div>
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
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')

  const canSave = current && newPass.length >= 8 && newPass === confirm

  // ── Change password via Cognito ────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body:   JSON.stringify({
          current_password: current,
          new_password:     newPass,
        }),
      })
      setSaved(true)
      setCurrent(''); setNewPass(''); setConfirm('')
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message ?? 'Failed to update password')
    } finally {
      setSaving(false)
    }
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

          {confirm && newPass !== confirm && (
            <p className="text-red-400 text-xs">Passwords do not match</p>
          )}
          {newPass && newPass.length < 8 && (
            <p className="text-yellow-400 text-xs">
              Password must be at least 8 characters
            </p>
          )}
          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}
          {saved && (
            <p className="text-green-400 text-xs flex items-center gap-1.5">
              <CheckIcon className="w-3.5 h-3.5" />
              Password updated successfully
            </p>
          )}

          <button
            disabled={!canSave || saving}
            onClick={handleSave}
            className="btn-primary text-sm disabled:opacity-40 flex items-center gap-2"
          >
            {saving && (
              <div className="w-3.5 h-3.5 border border-bg border-t-transparent
                              rounded-full animate-spin" />
            )}
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Storage Tab ────────────────────────────────────────────
function StorageTab() {
  const [stats,   setStats]   = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const TOTAL_GB    = 10   // plan limit
  const barColors   = ['bg-blue-400', 'bg-purple-400', 'bg-green-400']

  // ── Fetch real storage stats ───────────────────────────
  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api('/files/stats')
      setStats(data)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load storage stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-beige border-t-transparent
                      rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="text-center py-20">
      <p className="text-red-400 mb-3">{error}</p>
      <button onClick={fetchStats} className="btn-primary text-sm">Retry</button>
    </div>
  )

  if (!stats) return null

  const usedGB  = bytesToGB(stats.total_bytes)
  const pct     = Math.min((usedGB / TOTAL_GB) * 100, 100)

  const breakdown = [
    {
      label: 'Photos',
      size:  bytesToGB(stats.images_bytes),
      icon:  <PhotoIcon        className="w-4 h-4" />,
      color: barColors[0],
    },
    {
      label: 'Videos',
      size:  bytesToGB(stats.videos_bytes),
      icon:  <FilmIcon         className="w-4 h-4" />,
      color: barColors[1],
    },
    {
      label: 'Documents',
      size:  bytesToGB(stats.documents_bytes),
      icon:  <DocumentTextIcon className="w-4 h-4" />,
      color: barColors[2],
    },
  ]

  return (
    <div className="space-y-6">

      {/* ── Total usage ── */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <CloudIcon className="w-5 h-5 text-beige-dim" />
          <h3 className="text-beige font-semibold">Storage Usage</h3>
          <span className="ml-auto text-muted text-xs">
            {stats.file_count} file{stats.file_count !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-end gap-2 mb-3">
          <span className="text-4xl font-bold text-beige">{usedGB} GB</span>
          <span className="text-muted text-lg mb-1">/ {TOTAL_GB} GB</span>
        </div>

        <div className="h-3 bg-surface2 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500
              ${pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-yellow-400' : 'bg-beige'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-muted text-xs">
          {(TOTAL_GB - usedGB).toFixed(2)} GB free · {pct.toFixed(0)}% used
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
                    ({usedGB > 0 ? ((item.size / usedGB) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.color}`}
                  style={{ width: `${(item.size / TOTAL_GB) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Combined bar */}
        <div className="mt-6 h-2 rounded-full overflow-hidden flex">
          {breakdown.map(item => (
            <div
              key={item.label}
              className={`h-full ${item.color}`}
              style={{ width: `${(item.size / TOTAL_GB) * 100}%` }}
            />
          ))}
          <div className="h-full bg-surface2 flex-1" />
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
  const navigate  = useNavigate()
  const logout    = useAuthStore(s => s.logout)
  const user_info = useAuthStore(s => s.user)

  const [user, setUser] = useState<UserData>({
    name:       user_info?.name  || 'User',
    email:      user_info?.email || '',
    avatar_url: null,
    joined_at:  '2025-12-01T00:00:00Z',
  })

  const [activeTab,  setActiveTab]  = useState<Tab>('profile')
  const [showLogout, setShowLogout] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  // ── Fetch real user info from /auth/me ─────────────────
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const data = await api('/auth/me')
        setUser(prev => ({
          ...prev,
          name:  data.name  || prev.name,
          email: data.email || prev.email,
        }))
      } catch {}
    }
    fetchMe()
  }, [])

  // ── Logout ─────────────────────────────────────────────
  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  // ── Delete account ─────────────────────────────────────
  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      // Delete all files first
      await api('/files/delete-all', { method: 'DELETE' })
        .catch(() => {})  // ignore if endpoint not ready
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setDeleting(false)
    }
  }

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
          onConfirm={handleLogout}
          onCancel={() => setShowLogout(false)}
        />
      )}
      {showDelete && (
        <ConfirmModal
          title="Delete account?"
          message="All your files, albums and data will be permanently deleted. This cannot be undone."
          confirmLabel={deleting ? 'Deleting…' : 'Delete Forever'}
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDelete(false)}
        />
      )}

    </div>
  )
}
