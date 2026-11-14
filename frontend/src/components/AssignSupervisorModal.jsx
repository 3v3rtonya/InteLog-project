import { useState, useEffect } from 'react'
import { apiGetUsers, apiAssignIntern } from '../services/api'
import { useToast } from './Toast'

/**
 * AssignSupervisorModal " repurposed as "Assign to Lecturer" modal.
 * Admin picks a lecturer to assign the intern to; approval happens later by the lecturer.
 */
export default function AssignSupervisorModal({ intern, onClose }) {
  const { showToast } = useToast()
  const [lecturers, setLecturers] = useState([])
  const [lecturerId, setLecturerId] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    apiGetUsers({ role: 'lecturer', status: 'active', page_size: 100 })
      .then(({ data }) => setLecturers(data.items || []))
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [intern.school])

  const handleConfirm = async () => {
    if (!lecturerId) { showToast('Please select a lecturer', 'error'); return }
    setLoading(true)
    try {
      await apiAssignIntern({ intern_id: intern.id, lecturer_id: lecturerId })
      showToast(`${intern.full_name} assigned to lecturer. They will approve the pairing.`, 'success')
      onClose()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Assignment failed', 'error')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Assign to Lecturer</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"></button>
        </div>

        <p style={{ marginBottom: 8, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Assign <strong>{intern.full_name}</strong> to a lecturer. The lecturer will then
          approve the intern/supervisor pairing and activate both accounts.
        </p>

        {/* Intern details */}
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px',
          marginBottom: 16, fontSize: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '6px 16px',
        }}>
          <span><strong>Student ID:</strong> {intern.student_id || '"'}</span>
          <span><strong>School:</strong> {intern.school || '"'}</span>
          <span><strong>Dept:</strong> {intern.department || '"'}</span>
          <span><strong>Supervisor:</strong> {intern.supervisor_id ? ' Linked' : ' Not yet linked'}</span>
        </div>

        <div className="form-group">
          <label className="form-label">Select Lecturer *</label>
          {fetching ? (
            <div className="spinner-center"><div className="spinner spinner-sm" /></div>
          ) : lecturers.length === 0 ? (
            <p style={{ color: '#EF4444', fontSize: '0.875rem' }}>
              No active lecturers found{intern.school ? ` for ${intern.school}` : ''}. Create one first.
            </p>
          ) : (
            <select
              className="form-input"
              value={lecturerId}
              onChange={e => setLecturerId(e.target.value)}
            >
              <option value="">" Select a lecturer "</option>
              {lecturers.map(l => (
                <option key={l.id} value={l.id}>
                  {l.full_name}  {l.department || l.school || l.email}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={loading || !lecturerId || fetching}
          >
            {loading ? <span className="spinner spinner-sm" /> : 'Assign to Lecturer'}
          </button>
        </div>
      </div>
    </div>
  )
}
