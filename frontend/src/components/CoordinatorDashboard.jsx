import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { apiCoordinatorPending, apiCoordinatorUsers, apiCoordinatorLogs, apiCoordinatorApprove } from '../services/api'
import { useToast } from './Toast'
import StatusBadge from './StatusBadge'

export default function CoordinatorDashboard() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [stats, setStats] = useState({ pending: 0, interns: 0, flagged: 0 })
  const [pendingUsers, setPendingUsers] = useState([])
  const [flaggedLogs, setFlaggedLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [pendingRes, internsRes, flaggedRes] = await Promise.all([
        apiCoordinatorPending({ page: 1, page_size: 5 }),
        apiCoordinatorUsers({ role: 'intern', status: 'active', page_size: 1 }),
        apiCoordinatorLogs({ is_flagged: true, page_size: 5 }),
      ])
      setPendingUsers(pendingRes.data.items || [])
      setFlaggedLogs(flaggedRes.data.items || [])
      setStats({
        pending: pendingRes.data.total || 0,
        interns: internsRes.data.total || 0,
        flagged: flaggedRes.data.total || 0,
      })
    } catch {
      showToast('Failed to load dashboard data', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleApprove = async (userId, name) => {
    try {
      await apiCoordinatorApprove(userId)
      showToast(`${name} approved`, 'success')
      loadData()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Approval failed', 'error')
    }
  }

  if (loading) return <div className="spinner-center"><div className="spinner spinner-lg" /></div>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">School Overview</h1>
          <p className="page-subtitle">
            Coordinator portal — {user?.school || 'Your school'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24}}>
        <div className="card" style={{padding: '20px 24px', textAlign: 'center'}}>
          <div style={{fontSize: '2rem', fontWeight: 700, color: '#E53E3E'}}>{stats.pending}</div>
          <div style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4}}>Pending Approvals</div>
        </div>
        <div className="card" style={{padding: '20px 24px', textAlign: 'center'}}>
          <div style={{fontSize: '2rem', fontWeight: 700, color: '#3182CE'}}>{stats.interns}</div>
          <div style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4}}>Active Interns</div>
        </div>
        <div className="card" style={{padding: '20px 24px', textAlign: 'center'}}>
          <div style={{fontSize: '2rem', fontWeight: 700, color: '#D69E2E'}}>{stats.flagged}</div>
          <div style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4}}>Flagged Logs</div>
        </div>
      </div>

      {/* Pending approvals */}
      <div className="card" style={{marginBottom: 24}}>
        <div className="card-header">
          <h2 className="card-title">Pending Approvals</h2>
        </div>
        <div className="card-body">
          {pendingUsers.length === 0 ? (
            <p style={{color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0'}}>No pending accounts</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>School</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map(u => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td><StatusBadge status={u.role} /></td>
                    <td>{u.school || '—'}</td>
                    <td><StatusBadge status={u.status} /></td>
                    <td>
                      <button
                        className="btn btn-xs btn-primary"
                        onClick={() => handleApprove(u.id, u.full_name)}
                      >Approve</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Flagged logs */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Flagged Logs</h2>
        </div>
        <div className="card-body">
          {flaggedLogs.length === 0 ? (
            <p style={{color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0'}}>No flagged logs</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Intern</th>
                  <th>Status</th>
                  <th>Flag Reason</th>
                </tr>
              </thead>
              <tbody>
                {flaggedLogs.map(log => (
                  <tr key={log.id}>
                    <td>{log.entry_date}</td>
                    <td>{log.intern?.full_name || log.intern_id}</td>
                    <td><StatusBadge status={log.status} /></td>
                    <td style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{log.flag_reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
