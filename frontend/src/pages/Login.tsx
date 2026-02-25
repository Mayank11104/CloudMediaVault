import { useAuth } from 'react-oidc-context'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudIcon } from '@heroicons/react/24/outline'

export default function Login() {
  const auth     = useAuth()
  const navigate = useNavigate()

  // Already logged in → go to library
  useEffect(() => {
    if (auth.isAuthenticated) navigate('/library', { replace: true })
  }, [auth.isAuthenticated, navigate])

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-beige border-t-transparent
                        rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-beige flex items-center justify-center">
            <CloudIcon className="w-8 h-8 text-bg" />
          </div>
          <h1 className="text-3xl font-bold text-beige">CloudMediaVault</h1>
          <p className="text-muted text-sm">Your personal cloud storage</p>
        </div>

        {/* Login Card */}
        <div className="card space-y-4">
          <p className="text-beige-dim text-sm">
            Sign in to access your files, photos and videos
          </p>

          {/* Error */}
          {auth.error && (
            <div className="bg-red-900/20 border border-red-800
                            rounded-xl px-4 py-3 text-red-400 text-sm">
              {auth.error.message}
            </div>
          )}

          {/* Sign in button */}
          <button
            onClick={() => auth.signinRedirect()}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <CloudIcon className="w-4 h-4" />
            Continue with CloudMediaVault
          </button>

          {/* Google sign in */}
          <button
            onClick={() => auth.signinRedirect({
              extraQueryParams: { identity_provider: 'Google' }
            })}
            className="btn-ghost w-full flex items-center justify-center gap-2"
          >
            {/* Google G */}
            <span className="w-4 h-4 rounded-full bg-white text-gray-700
                             text-xs font-bold flex items-center justify-center">
              G
            </span>
            Continue with Google
          </button>
        </div>

        <p className="text-muted text-xs">
          By signing in you agree to our terms of service
        </p>
      </div>
    </div>
  )
}
