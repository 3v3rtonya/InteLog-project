import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { apiSignupIntern, apiSignupSupervisor, apiLogin } from '../services/api'
import { useToast } from './Toast'

const PASSWORD_RULES = [
  { test: (p) => p.length >= 8,           label: 'At least 8 characters' },
  { test: (p) => /[A-Z]/.test(p),         label: 'At least one uppercase letter' },
  { test: (p) => /\d/.test(p),            label: 'At least one number' },
  { test: (p) => /[!@#$%^&*()\-_=+\[\]{};':\"\\|,.<>/?`~]/.test(p), label: 'At least one special character' },
]
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_CLASSES = ['', 'weak', 'fair', 'good', 'strong']

// Broad Kenyan university student ID:
// Accepts formats like: C026-01-1234/2023, SCT211-0001-2022, ADM/001/2023,
// BIT/2021/001, 12345678 (8-digit numeric), or any alphanumeric ID 4-20 chars.
const STUDENT_ID_RE = /^[A-Z0-9][A-Z0-9/\-_]{2,19}$/i

function EyeIcon({ visible }) {
  return visible ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function PasswordInput({ id, value, onChange, placeholder, disabled, invalid, autoComplete = 'new-password' }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        className="form-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        disabled={disabled}
        style={{ paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center',
        }}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        <EyeIcon visible={show} />
      </button>
    </div>
  )
}

export default function SignupForm({ onSwitch }) {
  const [role, setRole] = useState('intern') // intern | supervisor
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '', confirm: '',
    student_id: '', school: '', department: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRules, setShowRules] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const strength = PASSWORD_RULES.filter(r => r.test(form.password)).length

  const set = (k) => (e) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    if (fieldErrors[k]) setFieldErrors(p => ({ ...p, [k]: '' }))
    if (serverError) setServerError('')
  }

  const validate = () => {
    const e = {}
    if (!form.full_name.trim() || form.full_name.trim().length < 2) e.full_name = 'Full name must be at least 2 characters.'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Please enter a valid email address.'
    if (form.phone && !/^\+?\d{7,15}$/.test(form.phone.trim())) e.phone = 'Phone must be 7–15 digits.'
    if (role === 'intern' && !form.phone.trim()) e.phone = 'Phone number is required.'
    if (!form.student_id.trim()) e.student_id = 'Student ID is required.'
    else if (!STUDENT_ID_RE.test(form.student_id.trim())) e.student_id = 'Invalid Student ID. Must be 4–20 alphanumeric characters (letters, numbers, /, -, _).'
    if (!form.school.trim()) e.school = 'School is required.'
    if (!form.department.trim()) e.department = 'Department / Course is required.'
    if (strength < 4) e.password = 'Password does not meet all requirements.'
    if (!form.confirm) e.confirm = 'Please confirm your password.'
    else if (form.password !== form.confirm) e.confirm = 'Passwords do not match.'
    setFieldErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        student_id: form.student_id.trim().toUpperCase(),
        school: form.school.trim(),
        department: form.department.trim(),
      }
      if (role === 'intern') {
        await apiSignupIntern(payload)
        const { data } = await apiLogin({ email: payload.email, password: form.password })
        login(data)
        showToast('Account created! Awaiting admin approval.', 'success')
        navigate('/pending')
      } else {
        await apiSignupSupervisor(payload)
        const { data } = await apiLogin({ email: payload.email, password: form.password })
        login(data)
        showToast('Supervisor account created! Awaiting admin approval.', 'success')
        navigate('/pending')
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 409 && typeof detail === 'string' && detail.toLowerCase().includes('email')) {
        setFieldErrors(p => ({ ...p, email: detail }))
      } else if (err.response?.status === 409 && typeof detail === 'string' && detail.toLowerCase().includes('student')) {
        setFieldErrors(p => ({ ...p, student_id: detail }))
      } else {
        setServerError(typeof detail === 'string' ? detail : 'Signup failed. Please try again.')
      }
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}

      {/* Role selector */}
      <div className="form-group">
        <label className="form-label">I am registering as</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['intern', 'supervisor'].map(r => (
            <button
              key={r} type="button"
              className={'btn' + (role === r ? ' btn-primary' : ' btn-secondary')}
              style={{ flex: 1, textTransform: 'capitalize' }}
              onClick={() => setRole(r)}
            >
              {r === 'intern' ? '🎓 Intern' : '👔 Supervisor'}
            </button>
          ))}
        </div>
      </div>

      {/* Student ID */}
      <div className="form-group">
        <label className="form-label" htmlFor="s-sid">
          {role === 'intern' ? 'Your Student ID *' : "Intern's Student ID *"}
        </label>
        <input
          id="s-sid" className="form-input"
          value={form.student_id} onChange={set('student_id')}
          placeholder="C026-01-1234/2023"
          aria-invalid={!!fieldErrors.student_id}
          disabled={loading}
        />
        {fieldErrors.student_id
          ? <span className="form-error">{fieldErrors.student_id}</span>
          : <span className="form-hint">
              {role === 'intern'
                ? 'Your university registration number (e.g. C026-01-1234/2023, SCT211-0001-2022, ADM/001/2023).'
                : 'The university registration number of the intern you supervise.'}
            </span>
        }
      </div>

      {/* Full name */}
      <div className="form-group">
        <label className="form-label" htmlFor="s-name">Full Name *</label>
        <input id="s-name" className="form-input" value={form.full_name} onChange={set('full_name')} placeholder="John Doe" disabled={loading} aria-invalid={!!fieldErrors.full_name} />
        {fieldErrors.full_name && <span className="form-error">{fieldErrors.full_name}</span>}
      </div>

      {/* School + Department */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="s-school">School *</label>
          <input
            id="s-school" className="form-input"
            value={form.school} onChange={set('school')}
            placeholder="e.g. School of Engineering"
            disabled={loading} aria-invalid={!!fieldErrors.school}
          />
          {fieldErrors.school && <span className="form-error">{fieldErrors.school}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="s-dept">Department / Course *</label>
          <input
            id="s-dept" className="form-input"
            value={form.department} onChange={set('department')}
            placeholder="e.g. Software Engineering"
            disabled={loading} aria-invalid={!!fieldErrors.department}
          />
          {fieldErrors.department && <span className="form-error">{fieldErrors.department}</span>}
        </div>
      </div>

      {/* Email + Phone */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="s-email">Email *</label>
          <input id="s-email" className="form-input" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" disabled={loading} aria-invalid={!!fieldErrors.email} />
          {fieldErrors.email && <span className="form-error">{fieldErrors.email}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="s-phone">
            Phone {role === 'intern'
              ? <span style={{ color: '#EF4444', fontWeight: 600 }}>*</span>
              : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
            }
          </label>
          <input id="s-phone" className="form-input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+254712345678" disabled={loading} aria-required={role === 'intern'} />
          {fieldErrors.phone && <span className="form-error">{fieldErrors.phone}</span>}
        </div>
      </div>

      {/* Password */}
      <div className="form-group">
        <label className="form-label" htmlFor="s-pwd">Password *</label>
        <PasswordInput
          id="s-pwd"
          value={form.password}
          onChange={set('password')}
          placeholder="Min 8 characters"
          disabled={loading}
          invalid={!!fieldErrors.password}
        />
        {form.password && (
          <>
            <div className="password-strength" role="meter" aria-valuenow={strength} aria-valuemin={0} aria-valuemax={4}>
              {[1,2,3,4].map(i => (
                <div key={i} className={'strength-bar' + (strength >= i ? ' ' + STRENGTH_CLASSES[strength] : '')} />
              ))}
            </div>
            <span className="form-hint">{STRENGTH_LABELS[strength]}</span>
          </>
        )}
        {(showRules || fieldErrors.password) && form.password && (
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 6 }}>
            {PASSWORD_RULES.map(rule => (
              <li key={rule.label} style={{ fontSize: '0.78rem', color: rule.test(form.password) ? 'var(--brand-green)' : 'var(--text-muted)', display: 'flex', gap: 4, marginBottom: 2 }}>
                <span>{rule.test(form.password) ? '✓' : '○'}</span>{rule.label}
              </li>
            ))}
          </ul>
        )}
        {fieldErrors.password && <span className="form-error">{fieldErrors.password}</span>}
      </div>

      {/* Confirm */}
      <div className="form-group">
        <label className="form-label" htmlFor="s-confirm">Confirm Password *</label>
        <PasswordInput
          id="s-confirm"
          value={form.confirm}
          onChange={set('confirm')}
          placeholder="Repeat password"
          disabled={loading}
          invalid={!!fieldErrors.confirm}
        />
        {fieldErrors.confirm && <span className="form-error">{fieldErrors.confirm}</span>}
      </div>

      <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading} aria-busy={loading}>
        {loading ? <span className="spinner spinner-sm" aria-hidden="true" /> : 'Create Account'}
      </button>

      <p style={{ textAlign: 'center', marginTop: 12, fontSize: '0.875rem' }}>
        Already have an account?{' '}
        <button type="button" style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={onSwitch} disabled={loading}>
          Sign in
        </button>
      </p>
    </form>
  )
}
