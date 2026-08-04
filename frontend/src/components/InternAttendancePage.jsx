import { useState } from 'react'
import AttendanceCalendar from './AttendanceCalendar'
import AbsenceRequestForm from './AbsenceRequestForm'
import { apiGetMyAbsences } from '../services/api'
import { useEffect } from 'react'
import StatusBadge from './StatusBadge'

const ABSENCE_LABELS = {
  sick:      '🤒 Sick Day',
  day_off:   '🏖️ Day Off',
  emergency: '⚠️ Emergency',
  half_day:  '🕛 Half Day',
}

export default function InternAttendancePage() {
  const [showForm, setShowForm]       = useState(false)
  const [absences, setAbsences]       = useState([])
  const [absLoading, setAbsLoading]   = useState(true)
  const [calKey, setCalKey]           = useState(0)

  const loadAbsences = () => {
    setAbsLoading(true)
    apiGetMyAbsences()
      .then(r => setAbsences(r.data || []))
      .catch(() => {})
      .finally(() => setAbsLoading(false))
  }

  useEffect(() => { loadAbsences() }, [])

  const STATUS_COLORS = {
    pending:      { bg: '#fef9c3', color: '#92400e' },
    acknowledged: { bg: '#dcfce7', color: '#166534' },
    rejected:     { bg: '#fee2e2', color: '#991b1b' },
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Attendance</h1>
          <p className="page-subtitle">Track your attendance, absences, and logbook coverage</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
          + Report Absence
        </button>
      </div>

      {/* Calendar + progress bars */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2 className="card-title">Attendance Overview</h2>
        </div>
        <AttendanceCalendar key={calKey} />
      </div>

      {/* Absence history */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">My Absence Requests</h2>
          <button className="btn btn-outline btn-sm" onClick={() => setShowForm(true)}>
            + New
          </button>
        </div>

        {absLoading ? (
          <div className="spinner-center"><div className="spinner spinner-sm" /></div>
        ) : absences.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '12px 0' }}>
            No absence requests yet.
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {absences.map(a => {
                  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending
                  return (
                    <tr key={a.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{a.date}</td>
                      <td>{ABSENCE_LABELS[a.type] || a.type}</td>
                      <td style={{ maxWidth: 260, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {a.reason}
                      </td>
                      <td>
                        <span style={{
                          background: sc.bg, color: sc.color,
                          padding: '2px 10px', borderRadius: 20,
                          fontSize: '0.75rem', fontWeight: 600,
                        }}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Absence form modal */}
      {showForm && (
        <AbsenceRequestForm
          onClose={() => setShowForm(false)}
          onSubmitted={() => {
            loadAbsences()
            setCalKey(k => k + 1)
          }}
        />
      )}
    </div>
  )
}
