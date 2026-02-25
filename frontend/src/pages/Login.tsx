import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { signIn, signUp, confirmSignUp, resendCode, loginToBackend } from '@/auth/cognitoService'
import { useAuthStore } from '@/auth/useAuthStore'

type Screen = 'signin' | 'signup' | 'verify'

// ✅ Move PasswordInput OUTSIDE to prevent re-mounting
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

export default function Login() {
  const navigate  = useNavigate()
  const setTokens = useAuthStore(s => s.setTokens)

  const [screen,   setScreen]   = useState<Screen>('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [code,     setCode]     = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const clearError = () => setError('')

  const goTo = (s: Screen) => {
    setScreen(s)
    setCode('')
    setError('')
  }

  // ── Sign In ────────────────────────────────────────────
  const handleSignIn = async () => {
    if (!email || !password) return setError('Please fill all fields')
    setLoading(true); clearError()
    try {
      const tokens = await signIn(email, password)
      await loginToBackend(tokens)
      setTokens(tokens)
      
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
    if (!email || !password || !name) return setError('Please fill all fields')
    if (password.length < 8) return setError('Password must be at least 8 characters')
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
      await loginToBackend(tokens)
      setTokens(tokens)
      
      setPassword('')
      setEmail('')
      setCode('')
      
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
                disabled={loading}
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
