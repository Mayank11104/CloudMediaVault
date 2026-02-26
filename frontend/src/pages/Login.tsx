import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudIcon, EyeIcon, EyeSlashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { signIn, signUp, confirmSignUp, resendCode, loginToBackend } from '@/auth/cognitoService'
import { useAuthStore } from '@/auth/useAuthStore'
import { checkUsername } from '@/lib/api'

type Screen = 'signin' | 'signup' | 'verify'

// ── Constants ──────────────────────────────────────────────
const USERNAME_SUFFIX = '-cloudmediavault'

// ── Password Input Component ──────────────────────────────
interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  onEnter: () => void
  loading: boolean
  screen: Screen
  showPass: boolean
  setShowPass: (show: boolean) => void
  clearError: () => void
}

const PasswordInput = ({ 
  value, 
  onChange, 
  onEnter, 
  loading, 
  screen, 
  showPass, 
  setShowPass,
  clearError 
}: PasswordInputProps) => (
  <div className="relative">
    <input
      type={showPass ? 'text' : 'password'}
      autoComplete={screen === 'signup' ? 'new-password' : 'current-password'}
      className="input w-full pr-10"
      placeholder={screen === 'signup' ? 'Password (min 8 characters)' : 'Password'}
      value={value}
      onChange={e => { onChange(e.target.value); clearError() }}
      onKeyDown={e => e.key === 'Enter' && onEnter()}
      disabled={loading}
    />
    <button
      type="button"
      onClick={() => setShowPass(!showPass)}
      className="absolute right-3 top-1/2 -translate-y-1/2
                 text-muted hover:text-beige transition-colors"
    >
      {showPass
        ? <EyeSlashIcon className="w-4 h-4" />
        : <EyeIcon className="w-4 h-4" />
      }
    </button>
  </div>
)

// ── Reserved Usernames ─────────────────────────────────────
const RESERVED_USERNAMES = new Set([
  'admin', 'root', 'api', 'support', 'help', 'system', 
  'moderator', 'cdn', 'static', 'username', 'null', 'undefined'
])

// ── Main Component ─────────────────────────────────────────
export default function Login() {
  const navigate  = useNavigate()
  const setTokens = useAuthStore(s => s.setTokens)

  const [screen,   setScreen]   = useState<Screen>('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [username, setUsername] = useState('')  // Base username (without suffix)
  const [code,     setCode]     = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  // Username validation state
  const [usernameError, setUsernameError] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState(false)
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)

  const clearError = () => setError('')

  const goTo = (s: Screen) => {
    setScreen(s)
    setCode('')
    setError('')
    setUsernameError('')
  }

  // ✨ Debounced username validation with suffix
  useEffect(() => {
    setUsernameError('')
    setUsernameAvailable(false)

    if (username.length < 3) return

    // Format validation (base username only, without suffix)
    const usernameRegex = /^[a-z0-9_]{3,20}$/
    if (!usernameRegex.test(username)) {
      setUsernameError('Username must be 3-20 characters (lowercase, numbers, _ only)')
      return
    }

    // Check reserved usernames
    if (RESERVED_USERNAMES.has(username.toLowerCase())) {
      setUsernameError('This username is reserved')
      return
    }

    // ✨ Check availability with FULL username (including suffix)
    const fullUsername = `${username}${USERNAME_SUFFIX}`
    
    const timer = setTimeout(async () => {
      setIsCheckingUsername(true)
      try {
        const result = await checkUsername(fullUsername)
        if (result.available) {
          setUsernameAvailable(true)
          setUsernameError('')
        } else {
          setUsernameError('Username already taken')
          setUsernameAvailable(false)
        }
      } catch (err: any) {
        console.error('Username check failed:', err)
        setUsernameError('Could not check availability')
      } finally {
        setIsCheckingUsername(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [username])

  // Username input handler
  const handleUsernameChange = (value: string) => {
    // Auto-convert to lowercase and remove invalid characters
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(cleaned)
    clearError()
  }

  // ── Sign In ────────────────────────────────────────────
  const handleSignIn = async () => {
    if (!email || !password) return setError('Please fill all fields')
    setLoading(true); clearError()
    try {
      const tokens = await signIn(email, password)
      
      // Backend will fetch username from DynamoDB
      await loginToBackend(tokens, '')
      
      setTokens({ 
        email: tokens.email, 
        name: tokens.name,
        username: ''  // Will be set by backend response
      })
      
      setPassword('')
      setEmail('')
      
      navigate('/library', { replace: true })
    } catch (e: any) {
      if (e.message?.includes('429') || e.message?.includes('Too many')) {
        setError('Too many attempts. Please wait and try again.')
      } else {
        setError(e.message ?? 'Sign in failed')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Sign Up ────────────────────────────────────────────
  const handleSignUp = async () => {
    if (!email || !password || !name || !username) {
      return setError('Please fill all fields')
    }
    if (password.length < 8) {
      return setError('Password must be at least 8 characters')
    }
    if (username.length < 3) {
      return setError('Username must be at least 3 characters')
    }
    if (usernameError) {
      return setError('Please fix username errors')
    }
    if (!usernameAvailable) {
      return setError('Username is not available')
    }

    setLoading(true); clearError()
    try {
      await signUp(email, password, name)
      goTo('verify')
    } catch (e: any) {
      setError(e.message ?? 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Verify OTP ─────────────────────────────────────────
  const handleVerify = async () => {
    if (!code) return setError('Enter the verification code')
    if (code.length !== 6) return setError('Code must be 6 digits')
    setLoading(true); clearError()
    try {
      await confirmSignUp(email, code)
      const tokens = await signIn(email, password)
      
      // ✨ Send FULL username with suffix to backend
      const fullUsername = `${username}${USERNAME_SUFFIX}`
      await loginToBackend(tokens, fullUsername)
      
      setTokens({ 
        email: tokens.email, 
        name: tokens.name,
        username: fullUsername  // ← Store full username with suffix
      })
      
      setPassword('')
      setEmail('')
      setCode('')
      setUsername('')
      
      navigate('/library', { replace: true })
    } catch (e: any) {
      setError(e.message ?? 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Resend Code ────────────────────────────────────────
  const handleResend = async () => {
    try {
      await resendCode(email)
      setError('Code resent! Check your email.')
    } catch (e: any) {
      setError(e.message ?? 'Failed to resend code')
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">

        {/* ── Logo ── */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-full bg-beige flex items-center justify-center">
            <CloudIcon className="w-8 h-8 text-bg" />
          </div>
          <h1 className="text-3xl font-bold text-beige">CloudMediaVault</h1>
          <p className="text-muted text-sm">Your personal cloud storage</p>
        </div>

        {/* ── Card ── */}
        <div className="card space-y-5">

          {/* ── Sign In ── */}
          {screen === 'signin' && (
            <>
              <h2 className="text-beige font-semibold text-lg">Sign In</h2>

              <div className="space-y-3">
                <input
                  type="email"
                  autoComplete="email"
                  className="input w-full"
                  placeholder="Email address"
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearError() }}
                  onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                  disabled={loading}
                />
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  onEnter={handleSignIn}
                  loading={loading}
                  screen={screen}
                  showPass={showPass}
                  setShowPass={setShowPass}
                  clearError={clearError}
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs">{error}</p>
              )}

              <button
                onClick={handleSignIn}
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50
                           flex items-center justify-center gap-2"
              >
                {loading && (
                  <div className="w-4 h-4 border-2 border-bg/30 border-t-bg
                                  rounded-full animate-spin" />
                )}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <p className="text-center text-muted text-sm">
                No account?{' '}
                <button
                  onClick={() => goTo('signup')}
                  className="text-beige hover:underline"
                >
                  Create one
                </button>
              </p>
            </>
          )}

          {/* ── Sign Up ── */}
          {screen === 'signup' && (
            <>
              <h2 className="text-beige font-semibold text-lg">Create Account</h2>

              <div className="space-y-3">
                <input
                  type="text"
                  autoComplete="name"
                  className="input w-full"
                  placeholder="Full name"
                  value={name}
                  onChange={e => { setName(e.target.value); clearError() }}
                  disabled={loading}
                  autoFocus
                />
                
                <input
                  type="email"
                  autoComplete="email"
                  className="input w-full"
                  placeholder="Email address"
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearError() }}
                  disabled={loading}
                />

                {/* ✨ Username Input with Fixed Suffix */}
                <div className="space-y-1">
                  <label className="text-muted text-sm">Username</label>
                  
                  {/* Input Container with Suffix */}
                  <div className="relative">
                    <div className="flex items-center input w-full p-0 overflow-hidden">
                      {/* User Input Part */}
                      <input
                        type="text"
                        autoComplete="username"
                        className="flex-1 bg-transparent border-none outline-none px-3 py-2
                                   text-beige placeholder:text-muted/50 focus:ring-0"
                        placeholder="aditya"
                        value={username}
                        onChange={e => handleUsernameChange(e.target.value)}
                        disabled={loading}
                        minLength={3}
                        maxLength={20}
                      />
                      
                      {/* Fixed Suffix */}
                      <div className="px-3 py-2 text-muted/70 text-sm border-l border-border/50
                                      bg-border/10 flex items-center gap-2 whitespace-nowrap">
                        {USERNAME_SUFFIX}
                        
                        {/* Status Icons */}
                        {isCheckingUsername && (
                          <div className="w-4 h-4 border-2 border-beige/30 border-t-beige
                                          rounded-full animate-spin" />
                        )}
                        {usernameAvailable && !isCheckingUsername && username.length >= 3 && (
                          <CheckIcon className="w-4 h-4 text-green-400" />
                        )}
                        {usernameError && !isCheckingUsername && username.length >= 3 && (
                          <XMarkIcon className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Validation Messages */}
                  {usernameError && (
                    <p className="text-red-400 text-xs">{usernameError}</p>
                  )}
                  {usernameAvailable && !usernameError && username.length >= 3 && (
                    <p className="text-green-400 text-xs">
                      ✓ {username}{USERNAME_SUFFIX} is available
                    </p>
                  )}
                  {username.length === 0 && (
                    <p className="text-muted text-xs">
                      3-20 characters, lowercase, numbers, and underscores only
                    </p>
                  )}
                </div>

                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  onEnter={handleSignUp}
                  loading={loading}
                  screen={screen}
                  showPass={showPass}
                  setShowPass={setShowPass}
                  clearError={clearError}
                />
              </div>

              {password.length > 0 && password.length < 8 && (
                <p className="text-yellow-400 text-xs">
                  Password must be at least 8 characters
                </p>
              )}

              {error && (
                <p className="text-red-400 text-xs">{error}</p>
              )}

              <button
                onClick={handleSignUp}
                disabled={loading || !usernameAvailable || !!usernameError}
                className="btn-primary w-full disabled:opacity-50
                           flex items-center justify-center gap-2"
              >
                {loading && (
                  <div className="w-4 h-4 border-2 border-bg/30 border-t-bg
                                  rounded-full animate-spin" />
                )}
                {loading ? 'Creating account…' : 'Create Account'}
              </button>

              <p className="text-center text-muted text-sm">
                Already have an account?{' '}
                <button
                  onClick={() => goTo('signin')}
                  className="text-beige hover:underline"
                >
                  Sign in
                </button>
              </p>
            </>
          )}

          {/* ── Verify OTP ── */}
          {screen === 'verify' && (
            <>
              <h2 className="text-beige font-semibold text-lg">Verify Email</h2>
              <p className="text-muted text-sm">
                We sent a 6-digit code to{' '}
                <span className="text-beige font-medium">{email}</span>
              </p>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="input w-full tracking-widest text-center text-xl"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={e => {
                  setCode(e.target.value.replace(/\D/g, ''))
                  clearError()
                }}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
                disabled={loading}
                autoFocus
              />

              {error && (
                <p className={`text-xs ${
                  error.includes('resent') ? 'text-green-400' : 'text-red-400'
                }`}>
                  {error}
                </p>
              )}

              <button
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className="btn-primary w-full disabled:opacity-50
                           flex items-center justify-center gap-2"
              >
                {loading && (
                  <div className="w-4 h-4 border-2 border-bg/30 border-t-bg
                                  rounded-full animate-spin" />
                )}
                {loading ? 'Verifying…' : 'Verify & Sign In'}
              </button>

              <p className="text-center text-muted text-sm">
                Didn't get a code?{' '}
                <button
                  onClick={handleResend}
                  disabled={loading}
                  className="text-beige hover:underline disabled:opacity-50"
                >
                  Resend
                </button>
                {' · '}
                <button
                  onClick={() => goTo('signup')}
                  className="text-muted hover:text-beige"
                >
                  Go back
                </button>
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
