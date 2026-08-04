import { useState, useEffect } from 'react'
import { apiGetPendingLogs, apiApproveLog, apiRejectLog } from '../services/api'
import StatusBadge from './StatusBadge'
import { useToast } from './Toast'

export default function PendingLogsList() {
  const { showToast } = useToast()
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectMode, setRejectMode] = useState(false)
  const [approveConfirm, setApproveConfirm] = useState(null) // log to approve
  const [acting, setActing] = useState(false)

  const load = (p = 1) => {
    setLoading(true)
    apiGetPendingLogs(p).then(({ data }) => {
      setLogs(data.items || [])
      setTotalPages(data.total_pages || 1)
      setPage(p)
    }).catch(() => showToast('Failed to load logs', 'error')).finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const handleApprove = async () => {
    if (!approveConfirm) return
    setActing(true)
    try {
      await apiApproveLog(approveConfirm.id)
      showToast('Log approved successfully! ✅', 'success')
      setApproveConfirm(null)
      setSelected(null)
      load(page)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Approval failed', 'error')
    } finally { setActing(false) }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) { showToast('Please provide a rejection reason', 'error'); return }
    setActing(true)
    try {
      await apiRejectLog(selected.id, { reason: rejectReason })
      showToast('Log returned to intern', 'info')
      setSelected(null)
      setRejectMode(false)
      setRejectReason('')
      load(page)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Rejection failed', 'error')
    } finally { setActing(false) }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pending Log Approvals</h1>
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner spinner-md" /></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <div className="empty-state-title">All caught up!</div>
          <p>No pending logs to review.</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Intern</th><th>Date</th><th>Status</th><th>Flagged</th><th>Action</th></tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>{log.intern?.full_name || '—'}</td>
                    <td>{log.entry_date}</td>
                    <td><StatusBadge status={log.status} /></td>
                    <td>{log.is_flagged ? '⚠️' : '—'}</td>
                    <td><button className="btn btn-primary btn-sm" onClick={() => { setSelected(log); setRejectMode(false) }}>Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button className="page-btn" disabled={page <= 1} onClick={() => load(page - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i + 1} className={'page-btn' + (page === i + 1 ? ' active' : '')} onClick={() => load(i + 1)}>{i + 1}</button>
            ))}
            <button className="page-btn" disabled={page >= totalPages} onClick={() => load(page + 1)}>›</button>
          </div>
        </>
      )}

      {/* Review modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => { setSelected(null); setRejectMode(false) }}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Review Log — {selected.entry_date}</h3>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <StatusBadge status={selected.status} />
                  {selected.is_onsite
                    ? <span style={{ color: 'var(--brand-green)', fontSize: '0.8rem' }}>✅ On-site</span>
                    : <span style={{ color: '#EF4444', fontSize: '0.8rem' }}>❌ Off-site</span>}
                  {selected.is_flagged && <span style={{ color: '#F59E0B', fontSize: '0.8rem' }}>⚠️ {selected.flag_reason}</span>}
                </div>
              </div>
              <button className="modal-close" onClick={() => { setSelected(null); setRejectMode(false) }}>×</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div className="form-label" style={{ marginBottom: 4 }}>ACTIVITIES PERFORMED</div>
              <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, lineHeight: 1.7 }}>
                {selected.activities_performed}
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div className="form-label" style={{ marginBottom: 4 }}>SOLUTIONS OFFERED</div>
              <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, lineHeight: 1.7 }}>
                {selected.solutions_scrubbed || selected.solutions_offered}
              </p>
            </div>

            {selected.images?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="form-label" style={{ marginBottom: 8 }}>EVIDENCE PHOTOS</div>
                <div className="image-gallery">
                  {selected.images.map(img => (
                    <img key={img.id} className="gallery-img"
                      src={`/api/uploads/${img.file_path.split(/[\\/]/).pop()}`}
                      alt={img.original_filename} />
                  ))}
                </div>
              </div>
            )}

            {!rejectMode ? (
              <div className="modal-footer">
                <button className="btn btn-danger" onClick={() => setRejectMode(true)} disabled={acting}>Return to Intern</button>
                <button className="btn btn-primary" onClick={() => setApproveConfirm(selected)} disabled={acting}>
                  ✅ Approve Log
                </button>
              </div>
            ) : (
              <div>
                <div className="form-group">
                  <label className="form-label">Reason for returning *</label>
                  <textarea className="form-textarea" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explain what needs to be improved..." />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setRejectMode(false)} disabled={acting}>Back</button>
                  <button className="btn btn-danger" onClick={handleReject} disabled={acting}>
                    {acting ? <span className="spinner spinner-sm" /> : 'Confirm Return'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approve confirmation popup */}
      {approveConfirm && (
        <div className="modal-overlay" onClick={() => setApproveConfirm(null)}>
          <div className="modal confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Confirm Approval</h3>
              <button className="modal-close" onClick={() => setApproveConfirm(null)}>×</button>
            </div>
            <p className="confirm-message">
              Are you sure you want to approve the logbook entry for <strong>{approveConfirm.entry_date}</strong>?
              The intern will be notified immediately.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setApproveConfirm(null)} disabled={acting}>Cancel</button>
              <button className="btn btn-primary" onClick={handleApprove} disabled={acting}>
                {acting ? <span className="spinner spinner-sm" /> : '✅ Yes, Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
