import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from './useAuthStore'
import { api } from '@/lib/api'

export const useAuthGuard = () => {
  const navigate = useNavigate()
  const setUser = useAuthStore(s => s.setUser)
  const logout = useAuthStore(s => s.logout)
  const hasVerified = useRef(false)
  const [checking, setChecking] = useState(true)  // ✅ Add state

  useEffect(() => {
    if (hasVerified.current) return
    hasVerified.current = true

    const verify = async () => {
      try {
        const data = await api('/auth/me')
        setUser(data)
      } catch (err) {
        logout()
        navigate('/login', { replace: true })
      } finally {
        setChecking(false)  // ✅ Stop loading
      }
    }

    verify()
  }, [])

  return { checking }  // ✅ Return checking state
}
