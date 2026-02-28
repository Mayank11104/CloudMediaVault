const BASE_URL = import.meta.env.VITE_API_URL



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
  console.log(`📡 [API] ${options.method || 'GET'} ${endpoint}`)
  console.log(`📡 [API] Request options:`, { 
    ...options, 
    body: options.body ? '[BODY PRESENT]' : undefined,
    headers: options.headers 
  })

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  console.log(`📥 [API] ${res.status} ${res.statusText} ${endpoint}`)

  // Handle 401 - Token expired, try refresh
  if (res.status === 401 && _retry) {
    console.log('🔒 [API] Got 401, attempting token refresh...')
    const ok = await refreshTokens()
    if (ok) {
      console.log('♻️  [API] Refresh successful, retrying request...')
      return api(endpoint, options, false)
    } else {
      console.log('❌ [API] Refresh failed, redirecting to /login')
      window.location.href = '/login'
      return
    }
  }

  // Parse response
  const contentType = res.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    const data = await res.json()
    console.log(`📥 [API] Response data:`, data)
    if (!res.ok) {
      console.error(`❌ [API] Request failed:`, data)
      throw new Error(data.detail ?? 'Request failed')
    }
    return data
  }

  if (!res.ok) {
    console.error(`❌ [API] Request failed: ${res.status} ${res.statusText}`)
    throw new Error(`Request failed: ${res.status}`)
  }
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

  console.log(`📤 [UPLOAD] Starting upload: ${file.name}`)
  console.log(`📤 [UPLOAD] File size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
  console.log(`📤 [UPLOAD] File type: ${file.type}`)
  console.log(`📤 [UPLOAD] Dimensions: ${width && height ? `${width}×${height}` : 'N/A'}`)

  const res = await fetch(`${BASE_URL}/files/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
    signal,  // ✅ Pass abort signal to fetch
  })

  console.log(`📥 [UPLOAD] Response: ${res.status} ${res.statusText}`)

  // Handle 401 - Token expired, try refresh
  if (res.status === 401) {
    console.log('🔒 [UPLOAD] Got 401, attempting token refresh...')
    const ok = await refreshTokens()
    if (ok) {
      console.log('♻️  [UPLOAD] Refresh successful, retrying upload...')
      return uploadFile(file, width, height, signal)  // ✅ Pass signal on retry
    }
    console.log('❌ [UPLOAD] Refresh failed, redirecting to /login')
    window.location.href = '/login'
    return
  }

  const data = await res.json()
  console.log(`📥 [UPLOAD] Response data:`, data)
  
  if (!res.ok) {
    console.error(`❌ [UPLOAD] Upload failed:`, data)
    throw new Error(data.detail ?? 'Upload failed')
  }
  
  console.log(`✅ [UPLOAD] Upload successful: ${file.name}`)
  return data
}
