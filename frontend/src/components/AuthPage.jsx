import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'
import ForgotPasswordForm from './ForgotPasswordForm'
import { GoogleOAuthButton, GoogleCallback, IS_CONFIGURED } from './GoogleOAuthButton'

function Logo() {
  return (
    <img
      src="/dekut-logo.png"
      alt="Dedan Kimathi University of Technology"
      style={{ width: 90, height: 90, objectFit: 'contain', margin: '0 auto', display: 'block' }}
    />
  )
}

export default function AuthPage() {
  const [tab, setTab] = useState('login')
  const [searchParams] = useSearchParams()

  const code = searchParams.get('code')
  if (code) return <GoogleCallback />

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-logo">
          <Logo />
          <div className="auth-logo-title">InteLog MIS</div>
          <div className="auth-logo-sub">Intern Management Information System</div>
          <div className="auth-logo-sub" style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Dedan Kimathi University of Technology
          </div>
        </div>

        {tab !== 'forgot' && (
          <div className="auth-tabs" role="tablist" aria-label="Authentication options">
            <button
              role="tab"
              aria-selected={tab === 'login'}
              aria-controls="auth-panel"
              className={'auth-tab' + (tab === 'login' ? ' active' : '')}
              onClick={() => setTab('login')}
            >
              Sign In
            </button>
            <button
              role="tab"
              aria-selected={tab === 'signup'}
              aria-controls="auth-panel"
              className={'auth-tab' + (tab === 'signup' ? ' active' : '')}
              onClick={() => setTab('signup')}
            >
              Create Account
            </button>
          </div>
        )}

        <div id="auth-panel" role="tabpanel">
          {tab === 'login'  && <LoginForm  onSwitch={() => setTab('signup')} onForgot={() => setTab('forgot')} />}
          {tab === 'signup' && <SignupForm onSwitch={() => setTab('login')} />}
          {tab === 'forgot' && <ForgotPasswordForm onBack={() => setTab('login')} />}
        </div>

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