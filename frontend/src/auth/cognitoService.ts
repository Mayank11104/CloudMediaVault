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
export const loginToBackend = async (tokens: AuthTokens): Promise<void> => {
  console.log('🔑 Logging in to backend...')

  const response = await fetch('http://localhost:8000/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: tokens.accessToken,
      id_token: tokens.idToken,
      refresh_token: tokens.refreshToken,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail ?? 'Backend login failed')
  }

  console.log('✅ Backend login successful')
  console.log('🍪 Cookies after login:', document.cookie)
}
