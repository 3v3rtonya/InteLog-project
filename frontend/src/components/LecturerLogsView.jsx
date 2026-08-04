import { useState, useEffect, useCallback } from 'react'
import { apiGetCohortLogs, apiGetCohortLog } from '../services/api'
import { useToast } from './Toast'
import StatusBadge from './StatusBadge'
import LogReviewModal from './LogReviewModal'

export default function LecturerLogsView() {
  const { showToast } = useToast()
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ status: '', is_flagged: '' })
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState(null)

  const PAGE_SIZE = 20

  const load = useCallback(() => {
    setLoading(true)
    const params = { page, page_size: PAGE_SIZE }
    if (filters.status) params.status = filters.status
    if (filters.is_flagged !== '') params.is_flagged = filters.is_flagged === 'true'
    apiGetCohortLogs(params)
      .then(r => { setLogs(r.data.items || []); setTotal(r.data.total || 0) })
      .catch(() => showToast('Failed to load logs', 'error'))
      .finally(() => setLoading(false))
  }, [page, filters])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  const setFilter = (k) => (e) => {
    setFilters(f => ({ ...f, [k]: e.target.value }))
    setPage(1)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cohort Logs</h1>
          <p className="page-subtitle">All logbook entries from your assigned interns</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select className="form-input" style={{ width: 'auto' }} value={filters.status} onChange={setFilter('status')}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filters.is_flagged} onChange={setFilter('is_flagged')}>
          <option value="">All Logs</option>
          <option value="true">Flagged Only</option>
          <option value="false">Not Flagged</option>
        </select>
        <button className="btn btn-outline btn-sm" onClick={() => { setFilters({ status: '', is_flagged: '' }); setPage(1) }}>
          Reset
        </button>
      </div>

      {loading
        ? <div className="spinner-center"><div className="spinner spinner-lg" /></div>
        : logs.length === 0
          ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: 'var(--text-muted)' }}>No log entries found.</p>
            </div>
          )
          : (
            <div className="card" style={{ padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Intern</th>
                    <th>Status</th>
                    <th>On-site</th>
                    <th>Flagged</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td>{log.entry_date}</td>
                      <td style={{ fontSize: '0.875rem' }}>
                        {log.intern?.full_name || '—'}
                        {log.intern?.student_id && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {log.intern.student_id}
                          </div>
                        )}
                      </td>
                      <td><StatusBadge status={log.status} /></td>
                      <td>{log.is_onsite ? '✅' : '❌'}</td>
                      <td>{log.is_flagged ? <span style={{ color: '#F59E0B' }}>⚠️ {log.flag_reason?.split(';')[0]}</span> : '—'}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => setSelectedLog(log)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
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

      {/* Log detail modal — read-only for lecturer */}
      {selectedLog && (
        <LogReviewModal
          log={selectedLog}
          readOnly={true}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  )
}
