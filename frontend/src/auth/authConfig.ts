export const cognitoAuthConfig = {
  authority:     'https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_mQl5pyQhn',
  client_id:     '7tqqndk8ojruig60g2nan001p2',
  redirect_uri:  'http://localhost:5173/auth/callback',
  response_type: 'code',
  scope:         'openid email profile',
  // Auto refresh token before expiry
  automaticSilentRenew: true,
  // Load user info from userinfo endpoint
  loadUserInfo: true,
}
