import { useState, useEffect } from 'react'
import { apiGetPendingLogs } from '../services/api'
import StatusBadge from './StatusBadge'
import LogReviewModal from './LogReviewModal'
import { AlertTriangle } from 'lucide-react'

export default function PendingLogsList() {
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  const load = (p = 1) => {
    setLoading(true)
    apiGetPendingLogs(p).then(({ data }) => {
      setLogs(data.items || [])
      setTotalPages(data.total_pages || 1)
      setPage(p)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pending Log Approvals</h1>
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner spinner-md" /></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">All caught up! No pending logs to review.</div>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Intern</th><th>Date</th><th>Status</th><th>Flagged</th><th>Action</th></tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>
                      <div>{log.intern?.full_name || '—'}</div>
                      {log.intern?.student_id && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {log.intern.student_id}
                        </div>
                      )}
                    </td>
                    <td>{log.entry_date}</td>
                    <td><StatusBadge status={log.status} /></td>
                    <td>
                      {log.is_flagged
                        ? <span style={{ color: '#F59E0B', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={14} /> Flagged
                          </span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => setSelected(log)}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="page-btn" disabled={page <= 1} onClick={() => load(page - 1)}>←</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i + 1} className={'page-btn' + (page === i + 1 ? ' active' : '')} onClick={() => load(i + 1)}>{i + 1}</button>
              ))}
              <button className="page-btn" disabled={page >= totalPages} onClick={() => load(page + 1)}>→</button>
            </div>
          )}
        </>
      )}

      {selected && (
        <LogReviewModal
          log={selected}
          onClose={() => setSelected(null)}
          onAction={() => { setSelected(null); load(page) }}
        />
      )}
    </div>
  )
}