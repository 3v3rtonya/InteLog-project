import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'
import ForgotPasswordForm from './ForgotPasswordForm'
import { GoogleOAuthButton, GoogleCallback, IS_CONFIGURED } from './GoogleOAuthButton'

/**
 * Logo — green and blue circular design with "INTERN LOGBOOK" text.
 * Uses brand colors: deep green (#2E7D32), mid green (#4CAF50),
 * deep blue (#1565C0), and pale blue (#90CAF9).
 */
function Logo() {
  return (
    <img
      src="/dekut-logo.png"
      alt="Dedan Kimathi University of Technology"
      style={{ width: 90, height: 90, objectFit: 'contain', margin: '0 auto', display: 'block' }}
    />
  )
}

/**
 * AuthPage — public authentication page.
 *
 * Behaviour:
 * - If the URL contains `?code=` (Google OAuth callback), renders <GoogleCallback />.
 * - If the pathname is `/supervisor/login` or the URL has `?role=supervisor`,
 *   shows the Supervisor Portal heading and hides the Sign Up tab.
 * - If the pathname is `/admin/login` or the URL has `?role=admin`,
 *   shows the Admin Portal heading and hides the Sign Up tab.
 * - Otherwise shows the standard intern login/signup tabs.
 *
 * Footer contains two low-contrast links — "Supervisor Portal" and "Admin Portal" —
 * that navigate to their respective login pages. These are intentionally subtle
 * (small font, muted color, reduced opacity) and not prominently displayed.
 */
export default function AuthPage() {
  const [tab, setTab] = useState('login')
  const [searchParams] = useSearchParams()

  // Detect Google OAuth callback
  const code = searchParams.get('code')
  if (code) return <GoogleCallback />

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* ── Logo & title ─────────────────────────────────────────── */}
        <div className="auth-logo">
          <Logo />
          <div className="auth-logo-title">InteLog MIS</div>
          <div className="auth-logo-sub">Intern Management Information System</div>
        </div>

        {/* ── Tab switcher ─────────────────────────────────────────── */}
        {tab !== 'forgot' && (
          <div className="auth-tabs" role="tablist" aria-label="Authentication options">
            <button
              role="tab"
              aria-selected={tab === 'login'}
              aria-controls="auth-panel"
              className={'auth-tab' + (tab === 'login' ? ' active' : '')}
              onClick={() => setTab('login')}
            >
              Login
            </button>
            <button
              role="tab"
              aria-selected={tab === 'signup'}
              aria-controls="auth-panel"
              className={'auth-tab' + (tab === 'signup' ? ' active' : '')}
              onClick={() => setTab('signup')}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* ── Active form panel ────────────────────────────────────── */}
        <div id="auth-panel" role="tabpanel">
          {tab === 'login' && (
            <LoginForm
              onSwitch={() => setTab('signup')}
              onForgot={() => setTab('forgot')}
            />
          )}
          {tab === 'signup' && <SignupForm onSwitch={() => setTab('login')} />}
          {tab === 'forgot' && <ForgotPasswordForm onBack={() => setTab('login')} />}
        </div>

        {/* ── Google OAuth divider + button (not on forgot screen) ─── */}
        {tab !== 'forgot' && IS_CONFIGURED && (
          <>
            <div className="auth-divider" aria-hidden="true">or</div>
            <GoogleOAuthButton />
          </>
        )}

      </div>
    </div>
  )
}