import { useState, useEffect } from 'react'
import { apiGetAllLogs, apiGetAdminLog, apiGetUsers } from '../services/api'
import { useToast } from './Toast'
import StatusBadge from './StatusBadge'

export default function AdminLogsView() {
  const { showToast } = useToast()
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ intern_id: '', status: '', is_flagged: '' })
  const [interns, setInterns] = useState([])
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    apiGetUsers({ role: 'intern', page_size: 100 })
      .then(({ data }) => setInterns(data.items || []))
      .catch(() => {})
  }, [])

  const load = (p = 1) => {
    setLoading(true)
    const params = { page: p, page_size: 20 }
    if (filters.intern_id) params.intern_id = filters.intern_id
    if (filters.status) params.status = filters.status
    if (filters.is_flagged !== '') params.is_flagged = filters.is_flagged === 'true'
    apiGetAllLogs(params).then(({ data }) => {
      setLogs(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.total_pages || 1)
      setPage(p)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [filters])

  const openDetail = async (log) => {
    setDetailLoading(true)
    try {
      const { data } = await apiGetAdminLog(log.id)
      setSelected(data)
    } catch { showToast('Failed to load log detail', 'error') }
    finally { setDetailLoading(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">All Intern Logs</h1>
          <p className="page-subtitle">{total} total entries</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select className="form-select" value={filters.intern_id} onChange={e => setFilters(f => ({ ...f, intern_id: e.target.value }))}>
          <option value="">All Interns</option>
          {interns.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}
        </select>
        <select className="form-select" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className="form-select" value={filters.is_flagged} onChange={e => setFilters(f => ({ ...f, is_flagged: e.target.value }))}>
          <option value="">All Logs</option>
          <option value="true">Flagged Only</option>
          <option value="false">Not Flagged</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ intern_id: '', status: '', is_flagged: '' })}>Clear</button>
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner spinner-md" /></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"></div>
          <div className="empty-state-title">No logs found</div>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Intern</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>On-site</th>
                  <th>Flagged</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 500 }}>{log.intern?.full_name || ''}</td>
                    <td>{log.entry_date}</td>
                    <td><StatusBadge status={log.status} /></td>
                    <td>{log.is_onsite ? '' : ''}</td>
                    <td>{log.is_flagged ? <span style={{ color: '#F59E0B' }}> {log.flag_reason?.slice(0, 30)}</span> : ''}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openDetail(log)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button className="page-btn" disabled={page <= 1} onClick={() => load(page - 1)}></button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i + 1} className={'page-btn' + (page === i + 1 ? ' active' : '')} onClick={() => load(i + 1)}>{i + 1}</button>
            ))}
            <button className="page-btn" disabled={page >= totalPages} onClick={() => load(page + 1)}></button>
          </div>
        </>
      )}

      {/* Detail modal */}
      {(selected || detailLoading) && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            {detailLoading ? (
              <div className="spinner-center"><div className="spinner spinner-md" /></div>
            ) : selected && (
              <>
                <div className="modal-header">
                  <div>
                    <h3 className="modal-title">Log  {selected.entry_date}</h3>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <StatusBadge status={selected.status} />
                      {selected.is_onsite
                        ? <span style={{ color: 'var(--brand-green)', fontSize: '0.8rem' }}> On-site</span>
                        : <span style={{ color: '#EF4444', fontSize: '0.8rem' }}> Off-site</span>}
                      {selected.is_flagged && <span style={{ color: '#F59E0B', fontSize: '0.8rem' }}> Flagged</span>}
                    </div>
                  </div>
                  <button className="modal-close" onClick={() => setSelected(null)}></button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <strong>Intern:</strong> {selected.intern?.full_name || ''} &nbsp;|&nbsp;
                  <strong>Student ID:</strong> {selected.intern?.student_id || ''}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div className="form-label" style={{ marginBottom: 4 }}>Activities Performed</div>
                  <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, lineHeight: 1.7 }}>
                    {selected.activities_performed}
                  </p>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div className="form-label" style={{ marginBottom: 4 }}>Solutions Offered</div>
                  <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, lineHeight: 1.7 }}>
                    {selected.solutions_scrubbed || selected.solutions_offered}
                  </p>
                </div>

                {selected.flag_reason && (
                  <div className="alert alert-warning"> {selected.flag_reason}</div>
                )}

                {selected.images?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div className="form-label" style={{ marginBottom: 8 }}>Evidence Photos</div>
                    <div className="image-gallery">
                      {selected.images.map(img => (
                        <img key={img.id} className="gallery-img"
                          src={`/api/uploads/${img.file_path.split(/[\\/]/).pop()}`}
                          alt={img.original_filename} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
