import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGetLogs, apiDeleteLog } from '../services/api'
import StatusBadge from './StatusBadge'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from './Toast'

export default function LogbookList() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', date_from: '', date_to: '' })
  const [deleteId, setDeleteId] = useState(null)

  const load = (p = 1) => {
    setLoading(true)
    const params = { page: p, page_size: 20, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }
    apiGetLogs(params).then(({ data }) => {
      setLogs(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.total_pages || 1)
      setPage(p)
    }).catch(() => showToast('Failed to load logs', 'error')).finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [filters])

  const handleDelete = async () => {
    try {
      await apiDeleteLog(deleteId)
      showToast('Draft deleted', 'success')
      setDeleteId(null)
      load(page)
    } catch { showToast('Delete failed', 'error') }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Logbook</h1>
          <p className="page-subtitle">{total} total entries</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/intern/logs/new')}>+ New Entry</button>
      </div>

      <div className="filter-bar">
        <select className="form-select" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <input className="form-input" type="date" value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} placeholder="From" />
        <input className="form-input" type="date" value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} placeholder="To" />
        <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ status: '', date_from: '', date_to: '' })}>Clear</button>
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner spinner-md" /></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
          <div className="empty-state-title">No entries found</div>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Date</th><th>Status</th><th>On-site</th><th>Flagged</th><th>Actions</th></tr></thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>{log.entry_date}</td>
                    <td><StatusBadge status={log.status} /></td>
                    <td>{log.is_onsite ? '✅' : '❌'}</td>
                    <td>{log.is_flagged ? '⚠️' : '—'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/intern/logs/${log.id}`)}>View</button>
                      {log.status === 'draft' && (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/intern/logs/${log.id}`)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(log.id)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button className="page-btn" disabled={page <= 1} onClick={() => load(page - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i + 1} className={'page-btn' + (page === i + 1 ? ' active' : '')} onClick={() => load(i + 1)}>{i + 1}</button>
            ))}
            <button className="page-btn" disabled={page >= totalPages} onClick={() => load(page + 1)}>›</button>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Draft"
        message="Are you sure you want to delete this draft entry? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}