import { useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import { useNavigate } from 'react-router-dom'

export default function AuthCallback() {
  const auth     = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      navigate('/library', { replace: true })
    }
    if (!auth.isLoading && auth.error) {
      navigate('/login', { replace: true })
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.error, navigate])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-beige border-t-transparent
                        rounded-full animate-spin mx-auto" />
        <p className="text-beige-dim text-sm">Signing you in…</p>
      </div>
    </div>
  )
}
