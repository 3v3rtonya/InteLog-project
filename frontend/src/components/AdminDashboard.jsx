import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGetPendingRequests, apiGetUsers, apiGetFlaggedLogs } from '../services/api'
import StatusBadge from './StatusBadge'
import { Inbox, Hourglass, GraduationCap, Briefcase, School, AlertTriangle } from 'lucide-react'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ pending: 0, interns: 0, supervisors: 0, lecturers: 0, flagged: 0 })
  const [pendingList, setPendingList] = useState([])
  const [flaggedList, setFlaggedList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiGetPendingRequests(1),
      apiGetUsers({ role: 'intern', status: 'active', page_size: 1 }),
      apiGetUsers({ role: 'supervisor', status: 'active', page_size: 1 }),
      apiGetUsers({ role: 'lecturer', page_size: 1 }),
      apiGetFlaggedLogs(1),
    ]).then(([pending, interns, supervisors, lecturers, flagged]) => {
      setStats({
        pending: pending.data.total || 0,
        interns: interns.data.total || 0,
        supervisors: supervisors.data.total || 0,
        lecturers: lecturers.data.total || 0,
        flagged: flagged.data.total || 0,
      })
      setPendingList((pending.data.items || []).slice(0, 5))
      setFlaggedList((flagged.data.items || []).slice(0, 5))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">System overview</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card blue" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/preregister')}>
          <div className="stat-card-icon"><Inbox size={28} /></div>
          <div className="stat-card-label">Pre-Register</div>
          <div className="stat-card-value" style={{ fontSize: '0.9rem' }}>Import</div>
        </div>
        <div className="stat-card yellow" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/pending')}>
          <div className="stat-card-icon"><Hourglass size={28} /></div>
          <div className="stat-card-label">Unassigned Queue</div>
          <div className="stat-card-value">{stats.pending}</div>
        </div>
        <div className="stat-card green" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/users')}>
          <div className="stat-card-icon"><GraduationCap size={28} /></div>
          <div className="stat-card-label">Active Interns</div>
          <div className="stat-card-value">{stats.interns}</div>
        </div>
        <div className="stat-card blue" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/users')}>
          <div className="stat-card-icon"><Briefcase size={28} /></div>
          <div className="stat-card-label">Supervisors</div>
          <div className="stat-card-value">{stats.supervisors}</div>
        </div>
        <div className="stat-card purple" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/users')}>
          <div className="stat-card-icon"><School size={28} /></div>
          <div className="stat-card-label">Lecturers</div>
          <div className="stat-card-value">{stats.lecturers}</div>
        </div>
        <div className="stat-card red" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/flagged')}>
          <div className="stat-card-icon"><AlertTriangle size={28} /></div>
          <div className="stat-card-label">Unassigned Flagged</div>
          <div className="stat-card-value">{stats.flagged}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Unassigned Queue */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Unassigned Queue</h2>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin/pending')}>View All</button>
          </div>
          {loading
            ? <div className="spinner-center"><div className="spinner spinner-sm" /></div>
            : pendingList.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No unassigned users</p>
              : pendingList.map(u => (
                <div key={u.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem' }}>
                  <strong>{u.full_name}</strong>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6, textTransform: 'capitalize' }}>{u.role}</span>
                  {u.school && <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.78rem' }}>. {u.school}</span>}
                </div>
              ))
          }
        </div>

        {/* Flagged Logs */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Unassigned Flagged Logs</h2>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin/flagged')}>View All</button>
          </div>
          {loading
            ? <div className="spinner-center"><div className="spinner spinner-sm" /></div>
            : flaggedList.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No unassigned flagged logs</p>
              : flaggedList.map(log => (
                <div key={log.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem' }}>
                  <strong>{log.entry_date}</strong>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.78rem' }}>
                    {log.flag_reason?.split(';')[0]}
                  </span>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )
}
