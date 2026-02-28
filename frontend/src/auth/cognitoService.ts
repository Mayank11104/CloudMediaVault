import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js'

const userPool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
})

// ── Sign Up ────────────────────────────────────────────────
export const signUp = (
  email: string,
  password: string,
  name: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const attributes = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'name', Value: name }),
    ]
    userPool.signUp(email, password, attributes, [], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })

// ── Confirm Sign Up (OTP) ──────────────────────────────────
export const confirmSignUp = (
  email: string,
  code: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool })
    user.confirmRegistration(code, true, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })

// ── Resend OTP ─────────────────────────────────────────────
export const resendCode = (email: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool })
    user.resendConfirmationCode((err) => {
      if (err) reject(err)
      else resolve()
    })
  })

// ── Sign In ────────────────────────────────────────────────
export interface AuthTokens {
  idToken: string
  accessToken: string
  refreshToken: string
  email: string
  name: string
}

export const signIn = (
  email: string,
  password: string,
): Promise<AuthTokens> =>
  new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool })
    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    })

    user.authenticateUser(authDetails, {
      onSuccess: (session) => {
        const payload = session.getIdToken().decodePayload()
        resolve({
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
          email: payload['email'] ?? '',
          name: payload['name'] ?? '',
        })
      },
      onFailure: reject,
      newPasswordRequired: () => {
        reject(new Error('New password required'))
      },
    })
  })

// ── Sign Out ───────────────────────────────────────────────
export const signOut = (): void => {
  const user = userPool.getCurrentUser()
  if (user) user.signOut()
}

// ── Forgot Password ────────────────────────────────────────
export const forgotPassword = (email: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool })
    user.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: reject,
    })
  })

// ── Confirm New Password ───────────────────────────────────
export const confirmNewPassword = (
  email: string,
  code: string,
  password: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool })
    user.confirmPassword(code, password, {
      onSuccess: () => resolve(),
      onFailure: reject,
    })
  })

// ── Login to Backend (sets httpOnly cookies) ───────────────
// ✨ UPDATED: Now accepts username parameter
export const loginToBackend = async (
  tokens: AuthTokens,
  username: string  // ← NEW PARAMETER
): Promise<{ username: string }> => {
  console.log('🔑 [LOGIN] Starting backend login...')
  console.log('🔑 [LOGIN] Username provided:', username || '(empty - will fetch from DB)')
  console.log('🔑 [LOGIN] Email:', tokens.email)

  const requestBody = {
    access_token: tokens.accessToken,
    id_token: tokens.idToken,
    refresh_token: tokens.refreshToken,
    username: username,
  }
  
  console.log('🔑 [LOGIN] Request body:', { ...requestBody, access_token: '[REDACTED]', id_token: '[REDACTED]', refresh_token: '[REDACTED]' })

  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  console.log('🔑 [LOGIN] Response status:', response.status)

  if (!response.ok) {
    const error = await response.json()
    console.error('❌ [LOGIN] Backend login failed:', error)
    console.error('❌ [LOGIN] Error detail:', error.detail)
    throw new Error(error.detail ?? 'Backend login failed')
  }

  const data = await response.json()
  console.log('✅ [LOGIN] Backend login successful')
  console.log('✅ [LOGIN] Response data:', data)
  console.log('✅ [LOGIN] Username from backend:', data.user?.username)
  console.log('🍪 [LOGIN] Cookies after login:', document.cookie)
  
  return { username: data.user?.username || username }
}
