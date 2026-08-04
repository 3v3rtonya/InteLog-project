import { useState, useEffect } from 'react'
import {
  apiGetSupervisorInterns, apiUpdateIntern, apiSuspendIntern,
  apiSupervisorSetDates, apiGetInternAbsences,
} from '../services/api'
import { useToast } from './Toast'
import StatusBadge from './StatusBadge'
import ConfirmDialog from './ConfirmDialog'
import AttendanceCalendar from './AttendanceCalendar'

export default function InternManagement() {
  const { showToast } = useToast()
  const [interns, setInterns] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [suspendId, setSuspendId] = useState(null)
  const [editForm, setEditForm] = useState({ full_name: '', phone: '' })

  // Dates modal
  const [datesModal, setDatesModal] = useState(null)   // { intern }
  const [datesForm, setDatesForm] = useState({ attachment_start: '', attachment_end: '' })
  const [datesLoading, setDatesLoading] = useState(false)

  // Attendance drawer
  const [attendanceIntern, setAttendanceIntern] = useState(null)  // intern object
  const [absences, setAbsences] = useState([])
  const [absencesLoading, setAbsencesLoading] = useState(false)

  const load = () => {
    setLoading(true)
    apiGetSupervisorInterns()
      .then(({ data }) => setInterns(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openEdit = (intern) => {
    setEditing(intern)
    setEditForm({ full_name: intern.full_name, phone: intern.phone || '' })
  }

  const handleEdit = async () => {
    try {
      await apiUpdateIntern(editing.id, editForm)
      showToast('Intern updated', 'success')
      setEditing(null)
      load()
    } catch { showToast('Update failed', 'error') }
  }

  const handleSuspend = async () => {
    try {
      await apiSuspendIntern(suspendId)
      showToast('Intern suspended', 'info')
      setSuspendId(null)
      load()
    } catch { showToast('Suspend failed', 'error') }
  }

  const openDates = (intern) => {
    setDatesModal({ intern })
    setDatesForm({
      attachment_start: intern.attachment_start || '',
      attachment_end:   intern.attachment_end   || '',
    })
  }

  const handleSaveDates = async () => {
    if (!datesForm.attachment_start || !datesForm.attachment_end) {
      showToast('Both dates are required', 'error'); return
    }
    if (datesForm.attachment_end <= datesForm.attachment_start) {
      showToast('End date must be after start date', 'error'); return
    }
    setDatesLoading(true)
    try {
      await apiSupervisorSetDates(datesModal.intern.id, {
        attachment_start: datesForm.attachment_start,
        attachment_end:   datesForm.attachment_end,
      })
      showToast('Attachment dates updated', 'success')
      setDatesModal(null)
      load()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update dates', 'error')
    } finally {
      setDatesLoading(false)
    }
  }

  const openAttendance = async (intern) => {
    setAttendanceIntern(intern)
    setAbsencesLoading(true)
    try {
      const r = await apiGetInternAbsences(intern.id)
      setAbsences(r.data || [])
    } catch {
      setAbsences([])
    } finally {
      setAbsencesLoading(false)
    }
  }

  const ABSENCE_LABELS = {
    sick:      '🤒 Sick',
    day_off:   '🏖️ Day Off',
    emergency: '⚠️ Emergency',
    half_day:  '🕛 Half Day',
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Interns</h1>
          <p className="page-subtitle">Manage interns, set attachment dates, and view attendance</p>
        </div>
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner spinner-md" /></div>
      ) : interns.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <div className="empty-state-title">No interns assigned</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Student ID</th>
                <th>Attachment Period</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {interns.map(intern => (
                <tr key={intern.id}>
                  <td>
                    <div><strong>{intern.full_name}</strong></div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{intern.email}</div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{intern.student_id || '—'}</td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {intern.attachment_start ? (
                      <>
                        <div>{intern.attachment_start}</div>
                        <div style={{ color: 'var(--text-muted)' }}>→ {intern.attachment_end}</div>
                      </>
                    ) : (
                      <span style={{ color: '#EF4444', fontSize: '0.78rem' }}>⚠️ Not set</span>
                    )}
                  </td>
                  <td><StatusBadge status={intern.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(intern)}>Edit</button>
                      <button className="btn btn-outline btn-sm" onClick={() => openDates(intern)}>
                        📅 Dates
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => openAttendance(intern)}>
                        📊 Attendance
                      </button>
                      {intern.status !== 'suspended' && (
                        <button className="btn btn-danger btn-sm" onClick={() => setSuspendId(intern.id)}>
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit intern modal ──────────────────────────────────── */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit — {editing.full_name}</h3>
              <button className="modal-close" onClick={() => setEditing(null)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={editForm.full_name}
                onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={editForm.phone}
                onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Attachment dates modal ─────────────────────────────── */}
      {datesModal && (
        <div className="modal-overlay" onClick={() => setDatesModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 className="modal-title">Attachment Dates — {datesModal.intern.full_name}</h3>
              <button className="modal-close" onClick={() => setDatesModal(null)}>×</button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              As supervisor you can update these dates without limit.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input type="date" className="form-input"
                  value={datesForm.attachment_start}
                  onChange={e => setDatesForm(f => ({ ...f, attachment_start: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input type="date" className="form-input"
                  value={datesForm.attachment_end}
                  min={datesForm.attachment_start || undefined}
                  onChange={e => setDatesForm(f => ({ ...f, attachment_end: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDatesModal(null)} disabled={datesLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveDates} disabled={datesLoading}>
                {datesLoading ? <span className="spinner spinner-sm" /> : 'Save Dates'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Attendance drawer ──────────────────────────────────── */}
      {attendanceIntern && (
        <>
          <div
            onClick={() => setAttendanceIntern(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 900 }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 520,
            background: 'var(--bg-card)', zIndex: 901, overflowY: 'auto',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', padding: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{attendanceIntern.full_name}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {attendanceIntern.department} · {attendanceIntern.student_id}
                </p>
              </div>
              <button className="modal-close" style={{ fontSize: '1.4rem' }} onClick={() => setAttendanceIntern(null)}>×</button>
            </div>

            {/* Attendance calendar */}
            <AttendanceCalendar internId={attendanceIntern.id} />

            {/* Absences list */}
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>Absence Requests</h3>
              {absencesLoading ? (
                <div className="spinner-center"><div className="spinner spinner-sm" /></div>
              ) : absences.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No absences recorded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {absences.map(a => (
                    <div key={a.id} style={{
                      background: 'var(--bg-secondary)', borderRadius: 'var(--radius)',
                      padding: '10px 14px', fontSize: '0.85rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong>{a.date}</strong>
                        <span style={{
                          background: a.status === 'acknowledged' ? '#dcfce7' : a.status === 'rejected' ? '#fee2e2' : '#fef9c3',
                          color: a.status === 'acknowledged' ? '#166534' : a.status === 'rejected' ? '#991b1b' : '#92400e',
                          padding: '1px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                        }}>{a.status}</span>
                      </div>
                      <div>{ABSENCE_LABELS[a.type] || a.type}</div>
                      <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{a.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={!!suspendId}
        title="Suspend Intern"
        message="Are you sure? The intern will not be able to log in."
        confirmLabel="Suspend"
        onConfirm={handleSuspend}
        onCancel={() => setSuspendId(null)}
      />
    </div>
  )
}
