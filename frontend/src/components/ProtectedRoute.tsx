import { useAuthGuard } from '@/auth/useAuthGuard'
import { Outlet } from 'react-router-dom'

export default function ProtectedRoute() {
  const { checking } = useAuthGuard()

  if (checking) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-beige border-t-transparent
                      rounded-full animate-spin" />
    </div>
  )

  return <Outlet />   // ✅ renders MainPage + all child routes
}
