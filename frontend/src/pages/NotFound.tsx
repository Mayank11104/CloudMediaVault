import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg text-center px-4">
      <h1 className="text-7xl font-bold text-beige mb-4">404</h1>
      <p className="text-beige-dim text-lg mb-2">Page not found</p>
      <p className="text-muted text-sm mb-8">
        The page you're looking for doesn't exist.
      </p>
      <button
        onClick={() => navigate('/library')}
        className="btn-primary"
      >
        Back to Library
      </button>
    </div>
  )
}
