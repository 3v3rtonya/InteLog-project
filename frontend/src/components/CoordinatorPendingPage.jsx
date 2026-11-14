import { useState, useEffect } from 'react'
import { apiCoordinatorPending, apiCoordinatorApprove } from '../services/api'
import { useToast } from './Toast'
import StatusBadge from './StatusBadge'

export default function CoordinatorPendingPage() {
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const PAGE_SIZE = 20

  const load = async () => {
    setLoading(true)
    try {
      const res = await apiCoordinatorPending({ page, page_size: PAGE_SIZE })
      setUsers(res.data.items || [])
      setTotal(res.data.total || 0)
    } catch {
      showToast('Failed to load pending accounts', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page])

  const handleApprove = async (id, name) => {
    try {
      await apiCoordinatorApprove(id)
      showToast(`${name} approved`, 'success')
      load()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Approval failed', 'error')
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Pending Approvals</h1>
        <p className="page-subtitle">{total} account{total !== 1 ? 's' : ''} awaiting approval in your school</p>
      </div>
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="spinner-center"><div className="spinner" /></div>
          ) : users.length === 0 ? (
            <p style={{textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0'}}>No pending accounts</p>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>School</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.full_name}</td>
                      <td style={{fontSize: '0.82rem'}}>{u.email}</td>
                      <td><StatusBadge status={u.role} /></td>
                      <td>{u.school || '—'}</td>
                      <td>{u.department || '—'}</td>
                      <td><StatusBadge status={u.status} /></td>
                      <td style={{fontSize: '0.82rem'}}>{new Date(u.created_at).toLocaleDateString()}</td>
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
              {totalPages > 1 && (
                <div style={{display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16}}>
                  <button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                  <span style={{lineHeight: '2rem', fontSize: '0.85rem'}}>Page {page} of {totalPages}</span>
                  <button className="btn btn-sm btn-ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
