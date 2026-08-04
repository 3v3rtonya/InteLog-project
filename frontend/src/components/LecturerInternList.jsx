import { useState, useEffect, useCallback } from 'react'
import { apiGetLecturerInterns, apiGetCohortLogs } from '../services/api'
import StatusBadge from './StatusBadge'
import { useToast } from './Toast'

export default function LecturerInternList() {
  const { showToast } = useToast()
  const [interns, setInterns] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [internLogs, setInternLogs] = useState({}) // { internId: logs[] }
  const [logsLoading, setLogsLoading] = useState({})

  const PAGE_SIZE = 20

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page, page_size: PAGE_SIZE })
    if (search) params.append('search', search)
    apiGetLecturerInterns()
      .then(r => {
        setInterns(r.data.items || [])
        setTotal(r.data.total || 0)
      })
      .catch(() => showToast('Failed to load interns', 'error'))
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { load() }, [load])

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
  }

  const toggleExpand = async (internId) => {
    if (expandedId === internId) { setExpandedId(null); return }
    setExpandedId(internId)
    if (internLogs[internId]) return // already loaded

    setLogsLoading(p => ({ ...p, [internId]: true }))
    try {
      const r = await apiGetCohortLogs({ intern_id: internId, page_size: 10 })
      setInternLogs(p => ({ ...p, [internId]: r.data.items || [] }))
    } catch {
      showToast('Failed to load logs', 'error')
    } finally {
      setLogsLoading(p => ({ ...p, [internId]: false }))
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Interns</h1>
          <p className="page-subtitle">Cohort assigned to you</p>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            placeholder="Search by name, student ID, or department…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" type="submit">Search</button>
          {search && (
            <button className="btn btn-outline btn-sm" type="button"
              onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}>
              Clear
            </button>
          )}
        </form>
      </div>

      {loading
        ? <div className="spinner-center"><div className="spinner spinner-lg" /></div>
        : interns.length === 0
          ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: 'var(--text-muted)' }}>
                {search ? 'No interns match your search.' : 'No interns assigned to you yet.'}
              </p>
            </div>
          )
          : (
            <div className="card" style={{ padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Student ID</th>
                    <th>Department</th>
                    <th>School</th>
                    <th>Status</th>
                    <th>Supervisor</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {interns.map(intern => (
                    <>
                      <tr key={intern.id}>
                        <td><strong>{intern.full_name}</strong></td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{intern.student_id || '—'}</td>
                        <td>{intern.department || '—'}</td>
                        <td>{intern.school || '—'}</td>
                        <td><StatusBadge status={intern.status} /></td>
                        <td>
                          {intern.supervisor_id
                            ? <span style={{ fontSize: '0.8rem', color: 'var(--brand-green)' }}>✓ Linked</span>
                            : <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Not linked</span>
                          }
                        </td>
                        <td>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => toggleExpand(intern.id)}
                          >
                            {expandedId === intern.id ? 'Hide Logs ▲' : 'View Logs ▼'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded log rows */}
                      {expandedId === intern.id && (
                        <tr key={`${intern.id}-logs`}>
                          <td colSpan={7} style={{ background: 'var(--surface-alt, #f8f9fa)', padding: '12px 16px' }}>
                            {logsLoading[intern.id]
                              ? <div className="spinner-center"><div className="spinner spinner-sm" /></div>
                              : !internLogs[intern.id] || internLogs[intern.id].length === 0
                                ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>No log entries yet.</p>
                                : (
                                  <table className="table" style={{ marginBottom: 0 }}>
                                    <thead>
                                      <tr>
                                        <th>Date</th>
                                        <th>Status</th>
                                        <th>Flagged</th>
                                        <th>Flag Reason</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {internLogs[intern.id].map(log => (
                                        <tr key={log.id}>
                                          <td>{log.entry_date}</td>
                                          <td><StatusBadge status={log.status} /></td>
                                          <td>{log.is_flagged ? '⚠️ Yes' : '—'}</td>
                                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {log.flag_reason || '—'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )
                            }
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
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
    </div>
  )
}
