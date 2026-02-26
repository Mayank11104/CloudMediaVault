const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'



// ── Prevent parallel 401s ──────────────────────────────────
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null



const refreshTokens = (): Promise<boolean> => {
  if (isRefreshing && refreshPromise) {
    console.log('⏳ Token refresh already in progress')
    return refreshPromise
  }



  console.log('🔄 Starting token refresh...')
  isRefreshing = true
  refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(res => {
      console.log(`${res.ok ? '✅' : '❌'} Token refresh ${res.ok ? 'SUCCESS' : 'FAILED'}`)
      return res.ok
    })
    .catch(() => {
      console.log('❌ Token refresh: NETWORK ERROR')
      return false
    })
    .finally(() => {
      isRefreshing = false
      refreshPromise = null
    })



  return refreshPromise
}



// ── Base API client ────────────────────────────────────────
export const api = async (
  endpoint: string,
  options: RequestInit = {},
  _retry = true,
): Promise<any> => {
  console.log(`📡 ${options.method || 'GET'} ${endpoint}`)



  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })



  console.log(`📥 ${res.status} ${endpoint}`)



  // Handle 401 - Token expired, try refresh
  if (res.status === 401 && _retry) {
    console.log('🔒 Got 401, attempting refresh...')
    const ok = await refreshTokens()
    if (ok) {
      console.log('♻️  Retrying request...')
      return api(endpoint, options, false)
    } else {
      console.log('❌ Refresh failed, redirecting to /login')
      window.location.href = '/login'
      return
    }
  }



  // Parse response
  const contentType = res.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Request failed')
    return data
  }



  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res
}



// ── Username validation ────────────────────────────────────
export const checkUsername = async (username: string): Promise<{
  available: boolean
  message: string
}> => {
  console.log(`🔍 Checking username: ${username}`)
  return api(`/auth/check-username/${username}`, { method: 'GET' })
}



// ── File upload with dimensions and abort signal ───────────
export const uploadFile = async (
  file: File,
  width?: number,
  height?: number,
  signal?: AbortSignal  // ✅ Add abort signal parameter
): Promise<any> => {
  const formData = new FormData()
  formData.append('file', file)
  
  // ✅ Add dimensions if available
  if (width) formData.append('width', width.toString())
  if (height) formData.append('height', height.toString())


  console.log(`📤 Uploading: ${file.name} ${width && height ? `(${width}×${height})` : ''}`)


  const res = await fetch(`${BASE_URL}/files/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
    signal,  // ✅ Pass abort signal to fetch
  })


  console.log(`📥 Upload: ${res.status}`)


  // Handle 401 - Token expired, try refresh
  if (res.status === 401) {
    console.log('🔒 Upload got 401, attempting refresh...')
    const ok = await refreshTokens()
    if (ok) {
      console.log('♻️  Retrying upload...')
      return uploadFile(file, width, height, signal)  // ✅ Pass signal on retry
    }
    console.log('❌ Refresh failed, redirecting to /login')
    window.location.href = '/login'
    return
  }


  const data = await res.json()
  if (!res.ok) throw new Error(data.detail ?? 'Upload failed')
  return data
}
