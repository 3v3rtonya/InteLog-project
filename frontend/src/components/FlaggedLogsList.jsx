import { useState, useEffect } from 'react'
import { apiGetFlaggedLogs } from '../services/api'
import { useToast } from './Toast'
import StatusBadge from './StatusBadge'

export default function FlaggedLogsList() {
  const { showToast } = useToast()
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = (p = 1) => {
    setLoading(true)
    apiGetFlaggedLogs(p).then(({ data }) => {
      setLogs(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.total_pages || 1)
      setPage(p)
    }).catch(() => showToast('Failed to load', 'error')).finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Flagged Logs</h1>
          <p className="page-subtitle">{total} flagged entries</p>
        </div>
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner spinner-md" /></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <div className="empty-state-title">No flagged logs</div>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Intern</th><th>Date</th><th>Flag Reason</th><th>Status</th></tr></thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>{log.intern?.full_name || '—'}</td>
                    <td>{log.entry_date}</td>
                    <td style={{ color: '#F59E0B', fontSize: '0.875rem' }}>{log.flag_reason}</td>
                    <td><StatusBadge status={log.status} /></td>
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
    </div>
  )
}