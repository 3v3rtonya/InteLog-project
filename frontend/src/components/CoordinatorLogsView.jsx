import { useState, useEffect } from 'react'
import { apiCoordinatorLogs } from '../services/api'
import { useToast } from './Toast'
import StatusBadge from './StatusBadge'

export default function CoordinatorLogsView() {
  const { showToast } = useToast()
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filterFlagged, setFilterFlagged] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')

  const PAGE_SIZE = 20

  const load = async () => {
    setLoading(true)
    try {
      const params = { page, page_size: PAGE_SIZE }
      if (filterFlagged) params.is_flagged = true
      if (filterStatus) params.status = filterStatus
      const res = await apiCoordinatorLogs(params)
      setLogs(res.data.items || [])
      setTotal(res.data.total || 0)
    } catch {
      showToast('Failed to load logs', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, filterFlagged, filterStatus])

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">School Logs</h1>
        <p className="page-subtitle">{total} log{total !== 1 ? 's' : ''} in your school</p>
      </div>

      {/* Filters */}
      <div className="card" style={{marginBottom: 16, padding: '12px 16px'}}>
        <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center'}}>
          <label style={{display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem'}}>
            <input
              type="checkbox"
              checked={filterFlagged}
              onChange={e => { setFilterFlagged(e.target.checked); setPage(1) }}
            />
            Flagged only
          </label>
          <select
            className="form-select"
            style={{width: 160}}
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="spinner-center"><div className="spinner" /></div>
          ) : logs.length === 0 ? (
            <p style={{textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0'}}>No logs found</p>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Intern</th>
                    <th>Status</th>
                    <th>Flagged</th>
                    <th>Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td style={{whiteSpace: 'nowrap'}}>{log.entry_date}</td>
                      <td>{log.intern?.full_name || '—'}</td>
                      <td><StatusBadge status={log.status} /></td>
                      <td>{log.is_flagged ? <span style={{color: '#E53E3E', fontWeight: 600}}>⚑ Flagged</span> : '—'}</td>
                      <td style={{fontSize: '0.82rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        {log.activities_performed}
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
