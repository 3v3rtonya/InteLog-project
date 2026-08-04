import { useState } from 'react'
import { apiForgotPassword } from '../services/api'

export default function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) { setError('Email is required.'); return }
    setError('')
    setLoading(true)
    try {
      await apiForgotPassword(normalizedEmail)
      setSent(true)
    } catch {
      // Always show success to prevent enumeration
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>📧</div>
        <h3 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>Check your email</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 20 }}>
          If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.
          Check your spam folder if you don't see it.
        </p>
        <button className="btn btn-secondary btn-full" onClick={onBack}>← Back to Login</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 6, color: 'var(--text-primary)' }}>Reset your password</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Enter your email and we'll send you a reset link.
        </p>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="form-group">
        <label className="form-label" htmlFor="forgot-email">Email address</label>
        <input
          id="forgot-email"
          className="form-input"
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setError('') }}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          disabled={loading}
        />
      </div>

      <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
        {loading ? <span className="spinner spinner-sm" aria-hidden="true" /> : 'Send Reset Link'}
      </button>

      <p style={{ textAlign: 'center', marginTop: 12, fontSize: '0.875rem' }}>
        <button
          type="button"
          style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={onBack}
        >
          ← Back to Login
        </button>
      </p>
    </form>
  )
}
