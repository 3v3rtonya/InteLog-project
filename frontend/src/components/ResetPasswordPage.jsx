import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { apiResetPassword, getApiErrorMessage } from '../services/api'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

const PASSWORD_RULES = [
  { test: (p) => p.length >= 8,           label: 'At least 8 characters' },
  { test: (p) => /[A-Z]/.test(p),         label: 'At least one uppercase letter' },
  { test: (p) => /\d/.test(p),            label: 'At least one number' },
  { test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p), label: 'At least one special character' },
]

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const strength = PASSWORD_RULES.filter(r => r.test(password)).length

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}><AlertTriangle size={48} color="#F59E0B" /></div>
          <h2 style={{ marginBottom: 8 }}>Invalid Reset Link</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
            This password reset link is missing or invalid. Please request a new one.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/login')}>Back to Login</button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}><CheckCircle2 size={48} color="#10B981" /></div>
          <h2 style={{ marginBottom: 8 }}>Password Reset!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
            Your password has been updated. You can now log in with your new password.
          </p>
          <button className="btn btn-primary btn-full" onClick={() => navigate('/login')}>Go to Login</button>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (strength < 4) {
      setError('Password does not meet all requirements.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await apiResetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img
            src="/dekut-logo.png"
            alt="Dedan Kimathi University of Technology"
            style={{ width: 90, height: 90, objectFit: 'contain', margin: '0 auto', display: 'block' }}
          />
          <div className="auth-logo-title">Set New Password</div>
          <div className="auth-logo-sub">InteLog MIS</div>
          <div className="auth-logo-sub" style={{ marginTop: 2, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Dedan Kimathi University of Technology
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="rp-password">New Password</label>
            <input
              id="rp-password"
              className="form-input"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Min 8 characters"
              autoComplete="new-password"
              autoFocus
              disabled={loading}
            />
            {password && (
              <>
                <div className="password-strength" role="meter" aria-valuenow={strength} aria-valuemin={0} aria-valuemax={4}>
                  {[1,2,3,4].map(i => (
                    <div key={i} className={'strength-bar' + (strength >= i ? ' ' + ['','weak','fair','good','strong'][strength] : '')} />
                  ))}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: 6 }}>
                  {PASSWORD_RULES.map(rule => (
                    <li key={rule.label} style={{ fontSize: '0.78rem', color: rule.test(password) ? 'var(--brand-green)' : 'var(--text-muted)', display: 'flex', gap: 4, marginBottom: 2 }}>
                      <span>{rule.test(password) ? '✓' : '○'}</span>{rule.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rp-confirm">Confirm Password</label>
            <input
              id="rp-confirm"
              className="form-input"
              type="password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError('') }}
              placeholder="Repeat new password"
              autoComplete="new-password"
              disabled={loading}
            />
            {confirm && password !== confirm && (
              <span className="form-error">Passwords do not match.</span>
            )}
          </div>

          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading || strength < 4 || password !== confirm}>
            {loading ? <span className="spinner spinner-sm" aria-hidden="true" /> : 'Reset Password'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 12, fontSize: '0.875rem' }}>
            <button type="button" style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => navigate('/login')}>
              ← Back to Login
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
