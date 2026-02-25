import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainPage      from '@/pages/MainPage'
import Login         from '@/pages/Login'
import NotFound      from '@/pages/NotFound'
import AuthCallback  from '@/auth/AuthCallback'
import ProtectedRoute from '@/components/ProtectedRoute'

import Library    from '@/pages/Library'
import Upload     from '@/pages/Upload'
import FileDetail from '@/pages/FileDetail'
import Albums     from '@/pages/Albums'
import Photos     from '@/pages/Photos'
import Videos     from '@/pages/Videos'
import Documents  from '@/pages/Documents'
import RecycleBin from '@/pages/RecycleBin'
import Profile    from '@/pages/Profile'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public */}
        <Route path="/login"          element={<Login />} />
        <Route path="/auth/callback"  element={<AuthCallback />} />

        {/* Protected — sidebar layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainPage />
            </ProtectedRoute>
          }
        >
          <Route index                  element={<Navigate to="/library" replace />} />
          <Route path="library"         element={<Library />} />
          <Route path="upload"          element={<Upload />} />
          <Route path="files/:id"       element={<FileDetail />} />
          <Route path="albums"          element={<Albums />} />
          <Route path="albums/:id"      element={<Albums />} />
          <Route path="photos"          element={<Photos />} />
          <Route path="videos"          element={<Videos />} />
          <Route path="documents"       element={<Documents />} />
          <Route path="recycle-bin"     element={<RecycleBin />} />
          <Route path="profile"         element={<Profile />} />
        </Route>

        <Route path="*" element={<NotFound />} />

      </Routes>
    </BrowserRouter>
  )
}
