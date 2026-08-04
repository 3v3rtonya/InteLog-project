import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { apiGetLecturerInterns, apiGetPendingLinks, apiGetFlaggedCohortLogs } from '../services/api'

export default function LecturerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ interns: 0, pendingLinks: 0, flagged: 0 })
  const [pendingList, setPendingList] = useState([])
  const [flaggedList, setFlaggedList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiGetLecturerInterns(),
      apiGetPendingLinks(1),
      apiGetFlaggedCohortLogs(1),
    ]).then(([interns, links, flagged]) => {
      setStats({
        interns: interns.data.total ?? (interns.data.items?.length ?? 0),
        pendingLinks: links.data.total ?? 0,
        flagged: flagged.data.total ?? 0,
      })
      setPendingList((links.data.items || []).slice(0, 5))
      setFlaggedList((flagged.data.items || []).slice(0, 5))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Lecturer Dashboard</h1>
          <p className="page-subtitle">
            {user?.school && user?.department
              ? `${user.school} — ${user.department}`
              : 'Cohort overview'}
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-card-icon">🎓</div>
          <div className="stat-card-label">My Interns</div>
          <div className="stat-card-value">{stats.interns}</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-card-icon">⏳</div>
          <div className="stat-card-label">Pending Approvals</div>
          <div className="stat-card-value">{stats.pendingLinks}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-card-icon">⚠️</div>
          <div className="stat-card-label">Flagged Logs</div>
          <div className="stat-card-value">{stats.flagged}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Pending Approvals */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Pending Approvals</h2>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/lecturer/pending-links')}>
              View All
            </button>
          </div>
          {loading
            ? <div className="spinner-center"><div className="spinner spinner-sm" /></div>
            : pendingList.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No pending approvals</p>
              : pendingList.map(u => (
                <div key={u.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem' }}>
                  <strong>{u.full_name}</strong>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                    {u.department} · {u.student_id}
                  </span>
                </div>
              ))
          }
        </div>

        {/* Flagged Logs */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Flagged Logs</h2>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/lecturer/flagged')}>
              View All
            </button>
          </div>
          {loading
            ? <div className="spinner-center"><div className="spinner spinner-sm" /></div>
            : flaggedList.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No flagged logs</p>
              : flaggedList.map(log => (
                <div key={log.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem' }}>
                  <strong>{log.entry_date}</strong>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{log.flag_reason}</span>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )
}
