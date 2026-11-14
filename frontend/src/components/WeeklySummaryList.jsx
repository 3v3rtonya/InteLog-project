import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import {
  apiListWeeklySummaries, apiSupervisorListSummaries,
  apiLecturerListSummaries, apiAdminListSummaries
} from '../services/api'
import StatusBadge from './StatusBadge'
import { FileText, Plus } from 'lucide-react'

const STATUS_COLORS = {
  draft:    { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  pending:  { bg: 'rgba(234,179,8,0.15)',   color: '#fbbf24' },
  approved: { bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
  rejected: { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
}

function SummaryBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.draft
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 10px',
      borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
      {status}
    </span>
  )
}

export default function WeeklySummaryList() {
  const { user } = useAuth()

  const band = (g) => {
    if (g == null) return null
    if (g <= 4) return { label: 'WEAK', color: '#dc2626' }
    if (g <= 7) return { label: 'GOOD', color: '#d97706' }
    return { label: 'EXCELLENT', color: '#16a34a' }
  }
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchFn = user?.role === 'supervisor' ? apiSupervisorListSummaries
    : user?.role === 'lecturer' ? apiLecturerListSummaries
    : user?.role === 'admin'    ? apiAdminListSummaries
    : apiListWeeklySummaries

  const load = (p = 1) => {
    setLoading(true)
    fetchFn({ page: p, page_size: 20 })
      .then(({ data }) => {
        setItems(data.items || [])
        setTotal(data.total || 0)
        setTotalPages(data.total_pages || 1)
        setPage(p)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const isIntern = user?.role === 'intern'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Weekly Summaries</h1>
          <p className="page-subtitle">{total} total</p>
        </div>
        {isIntern && (
          <button className="btn btn-primary" onClick={() => navigate('/intern/weekly-summary/new')}>
            <Plus size={16} style={{ marginRight: 6 }} />New Summary
          </button>
        )}
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner spinner-md" /></div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FileText size={48} color="var(--text-muted)" /></div>
          <div className="empty-state-title">No summaries yet</div>
          {isIntern && <button className="btn btn-primary" style={{ marginTop: 12 }}
            onClick={() => navigate('/intern/weekly-summary/new')}>Write First Summary</button>}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                {!isIntern && <th>Intern</th>}
                <th>Week</th>
                <th>Status</th>
                <th>Grade</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id}>
                  {!isIntern && <td>{s.intern?.full_name || '--'}</td>}
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {s.week_start_date} to {s.week_end_date}
                  </td>
                  <td><SummaryBadge status={s.status} /></td>
                  <td>
                    {s.supervisor_grade != null ? (
                      <span style={{
                        background: band(s.supervisor_grade).color,
                        color: '#fff',
                        borderRadius: 20,
                        padding: '2px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {s.supervisor_grade}/10 {band(s.supervisor_grade).label}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>--</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '--'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isIntern && s.status === 'draft' && (
                        <button className="btn btn-outline btn-sm"
                          onClick={() => navigate('/intern/weekly-summary/' + s.id + '/edit')}>
                          Edit
                        </button>
                      )}
                      {user?.role === 'supervisor' && s.status === 'pending' && (
                        <button className="btn btn-primary btn-sm"
                          onClick={() => navigate('/supervisor/weekly-summaries/' + s.id + '/review')}>
                          Review
                        </button>
                      )}
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => navigate(
                          isIntern ? '/intern/weekly-summary/' + s.id
                          : user?.role === 'supervisor' ? '/supervisor/weekly-summaries/' + s.id + '/review'
                          : '#'
                        )}>
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => load(page - 1)}>Prev</button>
              <span style={{ lineHeight: '2rem', fontSize: '0.875rem' }}>Page {page} / {totalPages}</span>
              <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}