import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainPage from '@/pages/MainPage'
import NotFound from '@/pages/NotFound'
import Library from '@/pages/Library'
const ComingSoon = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center min-h-screen">
    <p className="text-muted text-lg">{label} — coming soon</p>
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Directly load MainPage — no auth for now */}
        <Route path="/" element={<MainPage />}>
          <Route index element={<Navigate to="/library" replace />} />
          <Route path="library" element={<Library />} />
          <Route path="upload"    element={<ComingSoon label="Upload" />} />
          <Route path="photos"    element={<ComingSoon label="Photos" />} />
          <Route path="videos"    element={<ComingSoon label="Videos" />} />
          <Route path="documents" element={<ComingSoon label="Documents" />} />
          <Route path="albums"    element={<ComingSoon label="Albums" />} />
          <Route path="profile"   element={<ComingSoon label="Profile" />} />
          <Route path="files/:id" element={<ComingSoon label="File Detail" />} />
        </Route>

        <Route path="*" element={<NotFound />} />

      </Routes>
    </BrowserRouter>
  )
}
