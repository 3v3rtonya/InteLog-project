import { useState } from 'react'
import { useToast } from './Toast'
import { apiSetAttachmentDates } from '../services/api'

/**
 * AttachmentDateModal
 * Blocks the intern dashboard until they enter their attachment start/end dates.
 * Shows how many changes remain after the first set.
 */
export default function AttachmentDateModal({ changesRemaining = 3, onSaved }) {
  const { showToast } = useToast()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const isFirstTime = changesRemaining === 3

  const validate = () => {
    const e = {}
    if (!startDate) e.start = 'Start date is required'
    if (!endDate) e.end = 'End date is required'
    if (startDate && endDate && endDate <= startDate)
      e.end = 'End date must be after start date'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await apiSetAttachmentDates({ attachment_start: startDate, attachment_end: endDate })
      showToast('Attachment dates saved', 'success')
      onSaved()
    } catch (err) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') showToast(detail, 'error')
      else showToast('Failed to save dates', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        padding: 32, width: '100%', maxWidth: 460,
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}></div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: 4 }}>
            {isFirstTime ? 'Set Your Attachment Period' : 'Update Attachment Dates'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>
            {isFirstTime
              ? 'Enter the start and end dates from your offer letter. This defines your attendance period.'
              : `Enter your updated attachment dates. You have ${changesRemaining} change${changesRemaining !== 1 ? 's' : ''} remaining.`
            }
          </p>
        </div>

        {/* Date inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Start Date *</label>
            <input
              type="date"
              className={`form-input ${errors.start ? 'input-error' : ''}`}
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setErrors(ev => ({ ...ev, start: '' })) }}
              disabled={loading}
            />
            {errors.start && <span className="form-error">{errors.start}</span>}
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">End Date *</label>
            <input
              type="date"
              className={`form-input ${errors.end ? 'input-error' : ''}`}
              value={endDate}
              min={startDate || undefined}
              onChange={e => { setEndDate(e.target.value); setErrors(ev => ({ ...ev, end: '' })) }}
              disabled={loading}
            />
            {errors.end && <span className="form-error">{errors.end}</span>}
          </div>
        </div>

        {/* Duration preview */}
        {startDate && endDate && endDate > startDate && (
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius)',
            padding: '10px 14px', marginBottom: 20, fontSize: '0.85rem',
            color: 'var(--text-secondary)', textAlign: 'center',
          }}>
            {(() => {
              const days = Math.round((new Date(endDate) - new Date(startDate)) / 86400000)
              const weeks = Math.floor(days / 7)
              return `${days} calendar days  ~${weeks} weeks`
            })()}
          </div>
        )}

        {/* Warning if limited changes */}
        {!isFirstTime && (
          <div style={{
            background: '#FFF3CD', border: '1px solid #FFD700', borderRadius: 'var(--radius)',
            padding: '10px 14px', marginBottom: 20, fontSize: '0.82rem', color: '#856404',
          }}>
             After {changesRemaining} more change{changesRemaining !== 1 ? 's' : ''}, only your supervisor can update these dates.
          </div>
        )}

        <button
          className="btn btn-primary btn-full"
          onClick={handleSave}
          disabled={loading || !startDate || !endDate}
          style={{ fontSize: '1rem', padding: '12px' }}
        >
          {loading ? <span className="spinner spinner-sm" /> : ' Save Attachment Dates'}
        </button>
      </div>
    </div>
  )
}
