import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { apiGetLogs, apiGetPeriodStatus } from '../services/api'
import StatusBadge from './StatusBadge'
import AttachmentDateModal from './AttachmentDateModal'
import AbsenceRequestForm from './AbsenceRequestForm'
import { AlertTriangle, BookOpen, Palmtree, Lock, Calendar, ClipboardList, CheckCircle, Hourglass, FileEdit } from 'lucide-react'
import ClockInOut from './ClockInOut'

export default function InternDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, draft: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  // Attachment period state
  const [periodStatus, setPeriodStatus] = useState(null)   // null while loading
  const [periodLoading, setPeriodLoading] = useState(true)
  const [showDateModal, setShowDateModal] = useState(false)
  const [showAbsenceForm, setShowAbsenceForm] = useState(false)

  // Load period status
  useEffect(() => {
    apiGetPeriodStatus()
      .then(r => {
        setPeriodStatus(r.data)
        if (r.data.status === 'no_dates') setShowDateModal(true)
      })
      .catch(() => {})
      .finally(() => setPeriodLoading(false))
  }, [])

  // Load logbook summary
  useEffect(() => {
    apiGetLogs({ page_size: 50 }).then(({ data }) => {
      const items = data.items || []
      setStats({
        total: data.total || 0,
        approved: items.filter(l => l.status === 'approved').length,
        pending: items.filter(l => l.status === 'pending_approval').length,
        draft: items.filter(l => l.status === 'draft').length,
      })
      setRecent(items.slice(0, 5))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const isReadOnly = periodStatus?.read_only
  const isExpired  = periodStatus?.expired

  return (
    <div>
      {/* ── Attachment date modal — mandatory ──────────────────── */}
      {showDateModal && (
        <AttachmentDateModal
          changesRemaining={periodStatus?.changes_remaining ?? 3}
          onSaved={() => {
            setShowDateModal(false)
            // Re-fetch period status
            apiGetPeriodStatus().then(r => setPeriodStatus(r.data)).catch(() => {})
            // attendance refreshed
          }}
        />
      )}

      {/* ── Absence form modal ──────────────────────────────────── */}
      {showAbsenceForm && (
        <AbsenceRequestForm
          onClose={() => setShowAbsenceForm(false)}
          onSubmitted={() => {}}
        />
      )}

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {user?.full_name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">
            {isExpired ? <><AlertTriangle size={16} style={{ verticalAlign: 'text-bottom' }} /> Attachment period ended — read-only view</> :
             isReadOnly ? <><BookOpen size={16} style={{ verticalAlign: 'text-bottom' }} /> Read-only mode (3-day window after attachment end)</> :
             'Your logbook & attendance overview'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isExpired && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAbsenceForm(true)}
            >
              <Palmtree size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Report Absence
            </button>
          )}
          {!isReadOnly && !isExpired && (
            <button className="btn btn-primary" onClick={() => navigate('/intern/logs/new')}>
              + New Entry
            </button>
          )}
        </div>
      </div>

      {/* ── Expired banner ──────────────────────────────────────── */}
      {isExpired && (
        <div style={{
          background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 'var(--radius)',
          padding: '12px 16px', marginBottom: 16, fontSize: '0.875rem', color: '#991B1B',
        }}>
          <Lock size={16} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> Your attachment period ended on <strong>{periodStatus?.attachment_end}</strong>.
          Your logbook is now read-only. Contact your supervisor or university coordinator if you need to extend your period.
        </div>
      )}

      {/* ── Read-only banner ────────────────────────────────────── */}
      {isReadOnly && !isExpired && (
        <div style={{
          background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 'var(--radius)',
          padding: '12px 16px', marginBottom: 16, fontSize: '0.875rem', color: '#713F12',
        }}>
          <BookOpen size={16} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> Your attachment ended on <strong>{periodStatus?.attachment_end}</strong>.
          You have a 3-day window to view your records but cannot submit new entries.
        </div>
      )}

      {/* ── Attachment period chip ──────────────────────────────── */}
      {!periodLoading && periodStatus?.attachment_start && !isExpired && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-secondary)', borderRadius: 20,
          padding: '6px 14px', fontSize: '0.8rem', marginBottom: 16,
          color: 'var(--text-secondary)',
        }}>
          <Calendar size={14} style={{ marginRight: 2 }} /> Attachment: <strong>{periodStatus.attachment_start}</strong> → <strong>{periodStatus.attachment_end}</strong>
          {!isReadOnly && periodStatus.changes_remaining > 0 && (
            <button
              className="btn btn-outline"
              style={{ padding: '2px 10px', fontSize: '0.72rem', marginLeft: 4 }}
              onClick={() => setShowDateModal(true)}
            >
              Edit ({periodStatus.changes_remaining} left)
            </button>
          )}
        </div>
      )}

      {/* ── Stats grid ──────────────────────────────────────────── */}
      <ClockInOut />
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-card-icon"><ClipboardList size={28} /></div>
          <div className="stat-card-label">Total Logs</div>
          <div className="stat-card-value">{stats.total}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-card-icon"><CheckCircle size={28} /></div>
          <div className="stat-card-label">Approved</div>
          <div className="stat-card-value">{stats.approved}</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-card-icon"><Hourglass size={28} /></div>
          <div className="stat-card-label">Pending</div>
          <div className="stat-card-value">{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><FileEdit size={28} /></div>
          <div className="stat-card-label">Drafts</div>
          <div className="stat-card-value">{stats.draft}</div>
        </div>
      </div>

      {/* ── Recent logs ─────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Entries</h2>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/intern/logs')}>View All</button>
        </div>
        {loading ? (
          <div className="spinner-center"><div className="spinner spinner-md" /></div>
        ) : recent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><BookOpen size={48} color="var(--brand-green)" /></div>
            <div className="empty-state-title">No log entries yet</div>
            {!isReadOnly && !isExpired && (
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/intern/logs/new')}>
                Create First Entry
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Date</th><th>Status</th><th>Flagged</th><th>Action</th></tr>
              </thead>
              <tbody>
                {recent.map(log => (
                  <tr key={log.id}>
                    <td>{log.entry_date}</td>
                    <td><StatusBadge status={log.status} /></td>
                    <td>{log.is_flagged ? <><AlertTriangle size={14} color="#F59E0B" style={{ verticalAlign: 'middle', marginRight: 4 }} /> Flagged</> : '—'}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/intern/logs/${log.id}`)}
                      >View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
