import { useState, useEffect } from 'react'
import { apiGetPendingRequests } from '../services/api'
import { useToast } from './Toast'
import AssignSupervisorModal from './AssignSupervisorModal'
import StatusBadge from './StatusBadge'

export default function PendingRequestsList() {
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  const load = (p = 1) => {
    setLoading(true)
    apiGetPendingRequests(p)
      .then(({ data }) => {
        setUsers(data.items || [])
        setTotalPages(data.total_pages || 1)
        setTotal(data.total || 0)
        setPage(p)
      })
      .catch(() => showToast('Failed to load', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Unassigned Queue</h1>
          <p className="page-subtitle">
            Interns and supervisors awaiting assignment to a lecturer
            {total > 0 && <strong style={{ color: '#F59E0B', marginLeft: 6 }}>({total})</strong>}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner spinner-md" /></div>
      ) : users.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: '2rem', marginBottom: 8 }}>✅</p>
          <p style={{ color: 'var(--text-muted)' }}>No unassigned pending users.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Student ID</th>
                <th>School / Dept</th>
                <th>Supervisor Link</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.full_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{u.student_id || '—'}</td>
                  <td>
                    <div style={{ fontSize: '0.85rem' }}>{u.school || '—'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.department || '—'}</div>
                  </td>
                  <td>
                    {u.role === 'intern'
                      ? u.supervisor_id
                        ? <span style={{ color: 'var(--brand-green)', fontSize: '0.8rem' }}>✓ Linked</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>⏳ Waiting</span>
                      : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                    }
                  </td>
                  <td><StatusBadge status={u.status} /></td>
                  <td style={{ fontSize: '0.8rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    {u.role === 'intern' ? (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setSelected(u)}
                      >
                        Assign to Lecturer
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {u.status === 'waiting' ? 'Awaiting intern' : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => load(page - 1)}>← Prev</button>
              <span style={{ lineHeight: '2rem', fontSize: '0.875rem' }}>Page {page} / {totalPages}</span>
              <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {selected && (
        <AssignSupervisorModal
          intern={selected}
          onClose={() => { setSelected(null); load(page) }}
        />
      )}
    </div>
  )
}
