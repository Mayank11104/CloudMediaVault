import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainPage from '@/pages/MainPage'
import NotFound from '@/pages/NotFound'
import Library from '@/pages/Library'
import Upload from '@/pages/Upload'
 import FileDetail from '@/pages/FileDetail'
 import Albums from '@/pages/Albums'
 import Photos from './pages/Photos'
 import Videos from './pages/Videos'
 import Documents from './pages/Documents'
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
          <Route path="upload"  element={<Upload />} />
          <Route path="photos"    element={<Photos />} />
          <Route path="videos"    element={<Videos />} />
          <Route path="documents" element={<Documents />} />
          <Route path="albums"    element={<Albums />} />
          <Route path="profile"   element={<ComingSoon label="Profile" />} />
          <Route path="files/:id" element={<FileDetail />} />
        </Route>

        <Route path="*" element={<NotFound />} />

      </Routes>
    </BrowserRouter>
  )
}
