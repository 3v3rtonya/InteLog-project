import { useState } from 'react'
import { apiApproveLog, apiRejectLog } from '../services/api'
import { useToast } from './Toast'
import StatusBadge from './StatusBadge'

/**
 * LogReviewModal
 *
 * Props:
 *   log       the log entry object
 *   onClose   called when the modal should close
 *   onAction  optional callback after approve/reject (receives updated log status)
 *   readOnly  if true, hides approve/reject buttons (used by lecturer view)
 */
export default function LogReviewModal({ log, onClose, onAction, readOnly = false }) {
  const { showToast } = useToast()
  const [step, setStep] = useState('review') // review | reject
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    try {
      await apiApproveLog(log.id)
      showToast('Log approved successfully ', 'success')
      onAction?.('approved')
      onClose()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Approval failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      showToast('Please provide a rejection reason', 'error')
      return
    }
    setLoading(true)
    try {
      await apiRejectLog(log.id, { reason: rejectReason })
      showToast('Log returned to intern', 'info')
      onAction?.('rejected')
      onClose()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Rejection failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            {readOnly ? 'Log Entry' : 'Review Log'}  {log.entry_date}
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"></button>
        </div>

        {/* Status chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusBadge status={log.status} />
          {log.is_onsite
            ? <span style={{ color: 'var(--brand-green)', fontSize: '0.875rem' }}> On-site</span>
            : <span style={{ color: '#EF4444', fontSize: '0.875rem' }}> Off-site</span>}
          {log.is_flagged && (
            <span style={{ color: '#F59E0B', fontSize: '0.875rem' }}> {log.flag_reason}</span>
          )}
        </div>

        {/* Intern info (shown in lecturer read-only view) */}
        {readOnly && log.intern && (
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px',
            marginBottom: 16, fontSize: '0.875rem',
          }}>
            <strong>{log.intern.full_name}</strong>
            {log.intern.student_id && (
              <span style={{ marginLeft: 8, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                {log.intern.student_id}
              </span>
            )}
            {log.intern.department && (
              <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}> {log.intern.department}</span>
            )}
          </div>
        )}

        {/* Activities */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Activities Performed
          </div>
          <p style={{
            whiteSpace: 'pre-wrap', color: 'var(--text-secondary)',
            background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, margin: 0,
          }}>
            {log.activities_performed}
          </p>
        </div>

        {/* Solutions */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Solutions Offered
          </div>
          <p style={{
            whiteSpace: 'pre-wrap', color: 'var(--text-secondary)',
            background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, margin: 0,
          }}>
            {log.solutions_scrubbed || log.solutions_offered}
          </p>
        </div>

        {/* Images */}
        {log.images?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Evidence Photos
            </div>
            <div className="image-gallery">
              {log.images.map(img => (
                <img
                  key={img.id}
                  className="gallery-img"
                  src={`/api/uploads/${img.file_path?.split(/[/\\]/).pop()}`}
                  alt={img.original_filename || 'Evidence photo'}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer  supervisor actions or read-only close */}
        {readOnly ? (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            {step === 'review' && log.status === 'pending_approval' && (
              <div className="modal-footer">
                <button className="btn btn-danger" onClick={() => setStep('reject')} disabled={loading}>
                  Reject
                </button>
                <button className="btn btn-primary" onClick={handleApprove} disabled={loading}>
                  {loading ? <span className="spinner spinner-sm" /> : ' Approve'}
                </button>
              </div>
            )}

            {step === 'review' && log.status !== 'pending_approval' && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
              </div>
            )}

            {step === 'reject' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Rejection Reason *</label>
                  <textarea
                    className="form-textarea"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Explain why this log is being returned to the intern"
                    rows={3}
                  />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setStep('review')} disabled={loading}>
                    Back
                  </button>
                  <button className="btn btn-danger" onClick={handleReject} disabled={loading}>
                    {loading ? <span className="spinner spinner-sm" /> : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
