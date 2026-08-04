import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGetPendingLogs, apiGetSupervisorInterns } from '../services/api'
import StatusBadge from './StatusBadge'

export default function SupervisorDashboard() {
  const navigate = useNavigate()
  const [pendingCount, setPendingCount] = useState(0)
  const [internCount, setInternCount] = useState(0)
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([apiGetPendingLogs(1), apiGetSupervisorInterns()])
      .then(([logsRes, internsRes]) => {
        setPendingCount(logsRes.data.total || 0)
        setInternCount((internsRes.data || []).length)
        setRecentLogs((logsRes.data.items || []).slice(0, 5))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Supervisor Dashboard</h1>
          <p className="page-subtitle">Manage your interns and approve log entries</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card yellow">
          <div className="stat-card-icon">📋</div>
          <div className="stat-card-label">Pending Logs</div>
          <div className="stat-card-value">{pendingCount}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-card-icon">👥</div>
          <div className="stat-card-label">My Interns</div>
          <div className="stat-card-value">{internCount}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Pending Approvals</h2>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/supervisor/logs')}>View All</button>
        </div>
        {loading ? (
          <div className="spinner-center"><div className="spinner spinner-md" /></div>
        ) : recentLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">No pending logs</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Intern</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {recentLogs.map(log => (
                  <tr key={log.id}>
                    <td>{log.intern?.full_name || '—'}</td>
                    <td>{log.entry_date}</td>
                    <td><StatusBadge status={log.status} /></td>
                    <td><button className="btn btn-primary btn-sm" onClick={() => navigate('/supervisor/logs')}>Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}