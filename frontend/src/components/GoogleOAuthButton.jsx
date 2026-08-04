import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { apiGoogleAuth } from '../services/api'
import { useToast } from './Toast'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const REDIRECT_URI = typeof window !== 'undefined' ? window.location.origin + '/auth/google/callback' : ''

// Consider Google OAuth unconfigured if the value is a placeholder
export const IS_CONFIGURED = CLIENT_ID &&
  CLIENT_ID !== 'your_google_client_id_here' &&
  CLIENT_ID !== 'GOOGLE_CLIENT_ID' &&
  CLIENT_ID.endsWith('.apps.googleusercontent.com')

/**
 * GoogleOAuthButton — renders a "Continue with Google" button.
 * Hidden entirely when VITE_GOOGLE_CLIENT_ID is not a real credential.
 */
export function GoogleOAuthButton() {
  const [loading, setLoading] = useState(false)

  // Don't render the button at all if Google OAuth isn't configured
  if (!IS_CONFIGURED) return null

  const handleClick = () => {
    setLoading(true)
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'email profile',
      access_type: 'offline',
      prompt: 'select_account',
    })
    window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params
  }

  return (
    <button
      type="button"
      className="btn-google"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <span className="spinner spinner-sm" />
      ) : (
        /* Google "G" logo — official brand colours */
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
      )}
      {loading ? 'Redirecting…' : 'Continue with Google'}
    </button>
  )
}

/**
 * GoogleCallback — rendered by AuthPage when a `?code=` query param is
 * detected in the URL (i.e. after Google redirects back to /login).
 *
 * Exchanges the authorization code for a JWT via POST /auth/google, then
 * routes the user based on their status and role:
 *   - pending  → /pending
 *   - admin    → /admin/dashboard
 *   - supervisor → /supervisor/dashboard
 *   - intern   → /intern/dashboard
 */
export function GoogleCallback() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { showToast } = useToast()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      navigate('/login', { replace: true })
      return
    }

    apiGoogleAuth(code)
      .then(({ data }) => {
        login(data)
        showToast('Signed in with Google!', 'success')
        const { status, role } = data.user
        if (status === 'pending') navigate('/pending', { replace: true })
        else if (role === 'admin') navigate('/admin/dashboard', { replace: true })
        else if (role === 'supervisor') navigate('/supervisor/dashboard', { replace: true })
        else navigate('/intern/dashboard', { replace: true })
      })
      .catch(() => {
        showToast('Google sign-in failed. Please try again.', 'error')
        navigate('/login', { replace: true })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="spinner-center" role="status" aria-label="Signing in with Google…">
      <div className="spinner spinner-lg" />
    </div>
  )
}
