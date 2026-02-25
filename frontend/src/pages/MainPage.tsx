import Sidebar from '@/components/Sidebar'
import { Outlet } from 'react-router-dom'

export default function MainPage() {
  return (
    <div className="flex min-h-screen bg-bg">

      {/* Sidebar — always visible */}
      <Sidebar />

      {/* Main content area — offset by sidebar width */}
      <main className="ml-[280px] flex-1 min-h-screen overflow-y-auto">
        <Outlet />
      </main>

    </div>
  )
}
