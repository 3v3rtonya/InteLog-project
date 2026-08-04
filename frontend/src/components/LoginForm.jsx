import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { apiLogin, getApiErrorMessage } from '../services/api'
import { useToast } from './Toast'

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

function EyeIcon({ visible }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export default function LoginForm({ onSwitch, onForgot }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' })

  const { login } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  // Validate individual fields and return true if all pass
  const validate = () => {
    const errors = { email: '', password: '' }
    let valid = true

    if (!email.trim()) {
      errors.email = 'Email is required.'
      valid = false
    } else if (!isValidEmail(email)) {
      errors.email = 'Please enter a valid email address.'
      valid = false
    }

    if (!password) {
      errors.password = 'Password is required.'
      valid = false
    }

    setFieldErrors(errors)
    return valid
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!validate()) return

    setLoading(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const { data } = await apiLogin({ email: normalizedEmail, password })
      login(data)
      showToast('Welcome back!', 'success')

      // pending or waiting — always go to holding page regardless of role
      if (data.user.status === 'pending' || data.user.status === 'waiting') {
        navigate('/pending')
        return
      }

      // shell — account not yet activated, should not be able to log in
      // (backend blocks this, but guard on frontend too)
      if (data.user.status === 'shell' || data.user.status === 'suspended') {
        setError('Your account is not active. Please contact your university coordinator.')
        return
      }

      // role-based redirect
      if (data.user.role === 'admin') navigate('/admin/dashboard')
      else if (data.user.role === 'supervisor') navigate('/supervisor/dashboard')
      else if (data.user.role === 'lecturer') navigate('/lecturer/dashboard')
      else navigate('/intern/dashboard')
    } catch (err) {
      const detail = getApiErrorMessage(err)
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  // Clear field-level error on change
  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }))
  }

  const handlePasswordChange = (e) => {
    setPassword(e.target.value)
    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }))
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Server-side / submission error */}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {/* Email field */}
      <div className="form-group">
        <label className="form-label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          className="form-input"
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="you@example.com"
          autoComplete="email"
          aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
          aria-invalid={!!fieldErrors.email}
          disabled={loading}
        />
        {fieldErrors.email && (
          <span id="login-email-error" className="form-error" role="alert">
            {fieldErrors.email}
          </span>
        )}
      </div>

      {/* Password field */}
      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="form-label" htmlFor="login-password">Password</label>
          {onForgot && (
            <button
              type="button"
              style={{ fontSize: '0.78rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={onForgot}
            >
              Forgot password?
            </button>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <input
            id="login-password"
            className="form-input"
            type={showPwd ? 'text' : 'password'}
            value={password}
            onChange={handlePasswordChange}
            placeholder="••••••••"
            autoComplete="current-password"
            aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
            aria-invalid={!!fieldErrors.password}
            disabled={loading}
            style={{ paddingRight: 40 }}
          />
          <button
            type="button"
            onClick={() => setShowPwd(v => !v)}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center',
            }}
            aria-label={showPwd ? 'Hide password' : 'Show password'}
          >
            <EyeIcon visible={showPwd} />
          </button>
        </div>
        {fieldErrors.password && (
          <span id="login-password-error" className="form-error" role="alert">
            {fieldErrors.password}
          </span>
        )}
      </div>

      <button
        className="btn btn-primary btn-full btn-lg"
        type="submit"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? <span className="spinner spinner-sm" aria-hidden="true" /> : 'Sign In'}
      </button>

      {onSwitch && (
        <p style={{ textAlign: 'center', marginTop: 12, fontSize: '0.875rem' }}>
          No account?{' '}
          <button
            type="button"
            className="btn-icon"
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={onSwitch}
          >
            Create one
          </button>
        </p>
      )}
    </form>
  )
}
