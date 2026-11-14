import { useState, useEffect, useCallback } from 'react'
import { apiGetPendingLinks, apiApproveLecturerLink, apiGetUsers } from '../services/api'
import { useToast } from './Toast'
import StatusBadge from './StatusBadge'
import ConfirmDialog from './ConfirmDialog'

export default function LecturerPendingLinks() {
  const { showToast } = useToast()
  const [items, setItems] = useState([])     // pending interns
  const [supervisors, setSupervisors] = useState({})  // { supervisor_id: User }
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(null)
  const [confirm, setConfirm] = useState(null) // { intern }

  const PAGE_SIZE = 20

  const load = useCallback(() => {
    setLoading(true)
    apiGetPendingLinks(page)
      .then(async r => {
        const interns = r.data.items || []
        setItems(interns)
        setTotal(r.data.total || 0)

        // Load supervisor details for display
        const supIds = [...new Set(interns.map(i => i.supervisor_id).filter(Boolean))]
        if (supIds.length > 0) {
          const supMap = {}
          await Promise.all(supIds.map(id =>
            apiGetUsers({ role: 'supervisor', page_size: 100 })
              .then(res => {
                res.data.items?.forEach(s => { supMap[s.id] = s })
              }).catch(() => {})
          ))
          setSupervisors(supMap)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  const handleApprove = async (intern) => {
    setApproving(intern.id)
    try {
      await apiApproveLecturerLink({ intern_id: intern.id })
      showToast(`${intern.full_name} approved successfully`, 'success')
      setItems(prev => prev.filter(i => i.id !== intern.id))
      setTotal(t => Math.max(0, t - 1))
    } catch (err) {
      showToast(err.response?.data?.detail || 'Approval failed', 'error')
    } finally {
      setApproving(null)
      setConfirm(null)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pending Approvals</h1>
          <p className="page-subtitle">Approve intern & supervisor pairings for your cohort</p>
        </div>
      </div>

      {loading
        ? <div className="spinner-center"><div className="spinner spinner-lg" /></div>
        : items.length === 0
          ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ fontSize: '2rem', marginBottom: 8 }}>✅</p>
              <p style={{ color: 'var(--text-muted)' }}>No pending approvals. All assigned interns are active.</p>
            </div>
          )
          : (
            <div className="card" style={{ padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Intern</th>
                    <th>Student ID</th>
                    <th>Dept / School</th>
                    <th>Supervisor</th>
                    <th>Intern Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(intern => {
                    const sup = supervisors[intern.supervisor_id]
                    return (
                      <tr key={intern.id}>
                        <td>
                          <strong>{intern.full_name}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{intern.email}</div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                          {intern.student_id || '—'}
                        </td>
                        <td>
                          <div>{intern.department || '—'}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{intern.school || '—'}</div>
                        </td>
                        <td>
                          {sup
                            ? (
                              <>
                                <div>{sup.full_name}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{sup.email}</div>
                              </>
                            )
                            : intern.supervisor_id
                              ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading…</span>
                              : <span style={{ color: '#EF4444', fontSize: '0.8rem' }}>Not linked yet</span>
                          }
                        </td>
                        <td><StatusBadge status={intern.status} /></td>
                        <td>
                          {intern.supervisor_id
                            ? (
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={approving === intern.id}
                                onClick={() => setConfirm({ intern })}
                              >
                                {approving === intern.id
                                  ? <span className="spinner spinner-sm" />
                                  : '✅ Approve'}
                              </button>
                            )
                            : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Waiting for supervisor
                              </span>
                            )
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
                  <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                  <span style={{ lineHeight: '2rem', fontSize: '0.875rem' }}>Page {page} / {totalPages}</span>
                  <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </div>
          )
      }

      {confirm && (
        <ConfirmDialog
          title="Approve Pairing"
          message={`Activate ${confirm.intern.full_name} and their linked supervisor? Both accounts will become active immediately.`}
          confirmLabel="Approve"
          onConfirm={() => handleApprove(confirm.intern)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
