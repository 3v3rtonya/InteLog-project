import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { apiCoordinatorStats, apiCoordinatorPending, apiCoordinatorApprove } from '../services/api'
import StatusBadge from './StatusBadge'
import { useToast } from './Toast'
import { Users, Clock, AlertTriangle, GraduationCap, CheckCircle } from 'lucide-react'

export default function CoordinatorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [stats, setStats] = useState({ pending: 0, interns: 0, lecturers: 0, flagged: 0 })
  const [pendingUsers, setPendingUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    setLoading(true)
    Promise.all([
      apiCoordinatorStats(),
      apiCoordinatorPending({ page: 1, page_size: 5 }),
    ])
      .then(([statsRes, pendingRes]) => {
        const s = statsRes.data || {}
        setStats({
          pending:   s.pending_approvals || 0,
          interns:   s.active_interns    || 0,
          lecturers: s.active_lecturers  || 0,
          flagged:   s.flagged_logs      || 0,
        })
        setPendingUsers(pendingRes.data.items || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleApprove = async (userId, name) => {
    try {
      await apiCoordinatorApprove(userId)
      showToast(name + ' approved', 'success')
      loadData()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Approval failed', 'error')
    }
  }

  if (loading) return <div className="spinner-center"><div className="spinner spinner-lg" /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">School Overview</h1>
          <p className="page-subtitle">Coordinator portal — {user?.school || 'Your school'}</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card yellow" style={{ cursor: 'pointer' }} onClick={() => navigate('/coordinator/pending')}>
          <div className="stat-card-icon"><Clock size={28} /></div>
          <div className="stat-card-label">Pending Approvals</div>
          <div className="stat-card-value">{stats.pending}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-card-icon"><GraduationCap size={28} /></div>
          <div className="stat-card-label">Active Interns</div>
          <div className="stat-card-value">{stats.interns}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-card-icon"><Users size={28} /></div>
          <div className="stat-card-label">Active Lecturers</div>
          <div className="stat-card-value">{stats.lecturers}</div>
        </div>
        <div className="stat-card red" style={{ cursor: 'pointer' }} onClick={() => navigate('/coordinator/logs')}>
          <div className="stat-card-icon"><AlertTriangle size={28} /></div>
          <div className="stat-card-label">Flagged Logs</div>
          <div className="stat-card-value">{stats.flagged}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Pending Approvals</h2>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/coordinator/pending')}>View All</button>
        </div>
        {pendingUsers.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <CheckCircle size={36} color="var(--brand-green)" />
            <div className="empty-state-title" style={{ marginTop: 8 }}>All caught up!</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Name</th><th>Role</th><th>School</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {pendingUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.full_name}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{u.email}</div>
                    </td>
                    <td><StatusBadge status={u.role} /></td>
                    <td style={{ fontSize: '0.82rem' }}>{u.school || '-'}</td>
                    <td><StatusBadge status={u.status} /></td>
                    <td>
                      <button className="btn btn-sm" style={{ background: '#16a34a', color: '#fff' }}
                        onClick={() => handleApprove(u.id, u.full_name)}>
                        Approve
                      </button>
                    </td>
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