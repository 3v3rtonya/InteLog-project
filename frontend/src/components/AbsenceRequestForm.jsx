import { useState } from 'react'
import { apiSubmitAbsence } from '../services/api'
import { useToast } from './Toast'

const TYPES = [
  { value: 'sick',      label: '🤒 Sick Day',         desc: 'You are unwell and cannot attend' },
  { value: 'day_off',   label: '🏖️ Day Off',           desc: 'Your supervisor gave you a day off' },
  { value: 'emergency', label: '⚠️ Emergency',         desc: 'Floods, protests, transport failure, etc.' },
  { value: 'half_day',  label: '🕛 Half Day',          desc: 'You attended but left early' },
]

/**
 * AbsenceRequestForm
 *
 * Props:
 *   onClose   — called when modal should close
 *   onSubmitted — called after a successful submission
 */
export default function AbsenceRequestForm({ onClose, onSubmitted }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: '',
    reason: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  // Allow up to 1 day in the future (half-day planning)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const validate = () => {
    const e = {}
    if (!form.date) e.date = 'Date is required'
    if (!form.type) e.type = 'Please select an absence type'
    if (!form.reason.trim() || form.reason.trim().length < 5)
      e.reason = 'Please provide a reason (at least 5 characters)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await apiSubmitAbsence({
        date: form.date,
        type: form.type,
        reason: form.reason.trim(),
      })
      showToast('Absence request submitted', 'success')
      onSubmitted?.()
      onClose()
    } catch (err) {
      const detail = err.response?.data?.detail
      showToast(typeof detail === 'string' ? detail : 'Submission failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3 className="modal-title">Submit Absence Request</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
          No geofence required — you can submit this from anywhere.
        </p>

        {/* Date */}
        <div className="form-group">
          <label className="form-label">Date *</label>
          <input
            type="date"
            className="form-input"
            value={form.date}
            max={tomorrow}
            onChange={e => { setForm(f => ({ ...f, date: e.target.value })); setErrors(ev => ({ ...ev, date: '' })) }}
            disabled={loading}
          />
          {errors.date && <span className="form-error">{errors.date}</span>}
        </div>

        {/* Type selector */}
        <div className="form-group">
          <label className="form-label">Absence Type *</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => { setForm(f => ({ ...f, type: t.value })); setErrors(ev => ({ ...ev, type: '' })) }}
                style={{
                  padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: `2px solid ${form.type === t.value ? 'var(--accent)' : 'var(--border-color)'}`,
                  background: form.type === t.value ? 'var(--accent-light, #e8f5e9)' : 'var(--bg-card)',
                  cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
                }}
                disabled={loading}
              >
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{t.label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{t.desc}</div>
              </button>
            ))}
          </div>
          {errors.type && <span className="form-error" style={{ marginTop: 4, display: 'block' }}>{errors.type}</span>}
        </div>

        {/* Emergency auto-acknowledge notice */}
        {form.type === 'emergency' && (
          <div style={{
            background: '#FFF3CD', border: '1px solid #FFD700',
            borderRadius: 'var(--radius)', padding: '10px 14px',
            fontSize: '0.82rem', color: '#856404', marginBottom: 12,
          }}>
            ✅ Emergency absences are <strong>automatically acknowledged</strong> by the system. No supervisor action needed.
          </div>
        )}

        {/* Reason */}
        <div className="form-group">
          <label className="form-label">Reason *</label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder={
              form.type === 'sick'      ? 'e.g. Fever and headache since morning' :
              form.type === 'day_off'   ? 'e.g. Supervisor granted a day off due to low workload' :
              form.type === 'emergency' ? 'e.g. Maandamano protests blocking all transport routes' :
              form.type === 'half_day'  ? 'e.g. Attended morning session, left at 1pm due to medical appointment' :
              'Describe the reason for your absence…'
            }
            value={form.reason}
            onChange={e => { setForm(f => ({ ...f, reason: e.target.value })); setErrors(ev => ({ ...ev, reason: '' })) }}
            disabled={loading}
          />
          {errors.reason && <span className="form-error">{errors.reason}</span>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="spinner spinner-sm" /> : 'Submit Absence'}
          </button>
        </div>
      </div>
    </div>
  )
}
