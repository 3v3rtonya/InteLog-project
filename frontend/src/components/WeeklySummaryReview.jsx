import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGetWeeklySummary, apiSupervisorReviewSummary } from '../services/api'
import { useToast } from './Toast'
import StatusBadge from './StatusBadge'
import { CheckCircle, XCircle } from 'lucide-react'

export default function WeeklySummaryReview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [summary, setSummary] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [grade, setGrade] = useState(5)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    apiGetWeeklySummary(id)
      .then(({ data }) => { setSummary(data); setFeedback(data.supervisor_feedback || ''); setGrade(data.supervisor_grade ?? 5) })
      .catch(() => { showToast('Failed to load summary', 'error'); navigate(-1) })
      .finally(() => setLoading(false))
  }, [id])

  const review = async (decision) => {
    if (!feedback.trim()) { showToast('Please provide feedback', 'error'); return }
    setActing(true)
    try {
      await apiSupervisorReviewSummary(id, { feedback, decision, grade })
      showToast('Summary ' + decision, 'success')
      navigate('/supervisor/weekly-summaries')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Review failed', 'error')
    } finally { setActing(false) }
  }

  if (loading) return <div className="spinner-center"><div className="spinner spinner-lg" /></div>
  if (!summary) return null

  const alreadyReviewed = summary.status === 'approved' || summary.status === 'rejected'

  const band = (g) => {
    if (g <= 4) return { label: 'WEAK', color: '#dc2626' }
    if (g <= 7) return { label: 'GOOD', color: '#d97706' }
    return { label: 'EXCELLENT', color: '#16a34a' }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Weekly Summary Review</h1>
          <p className="page-subtitle">
            {summary.intern?.full_name} &nbsp;|&nbsp;
            {summary.week_start_date} to {summary.week_end_date}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <StatusBadge status={summary.status} />
          {summary.submitted_at && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Submitted {new Date(summary.submitted_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="form-label" style={{ marginBottom: 6 }}>Summary</div>
        <p style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-secondary)', padding: 16,
          borderRadius: 8, lineHeight: 1.7, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {summary.summary_text}
        </p>
      </div>

      <div className="card">
        <div className="form-group">
          <label className="form-label">Performance Grade</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <input
              type="range" min="0" max="10" step="1"
              value={grade}
              onChange={e => setGrade(Number(e.target.value))}
              disabled={alreadyReviewed || acting}
              style={{ flex: 1, minWidth: 160, accentColor: band(grade).color }}
            />
            <span style={{
              fontWeight: 700, fontSize: '1rem',
              color: band(grade).color,
              minWidth: 120
            }}>
              {grade}/10 — {band(grade).label}
            </span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Your Feedback *</label>
          <textarea className="form-textarea" rows={4}
            value={feedback} onChange={e => setFeedback(e.target.value)}
            disabled={alreadyReviewed || acting}
            placeholder="Comment on the intern's progress, areas for improvement, or commendations..."
          />
        </div>
        {!alreadyReviewed ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => review('approved')} disabled={acting}>
              {acting ? <span className="spinner spinner-sm" /> : <><CheckCircle size={15} style={{ marginRight: 6 }} />Approve</>}
            </button>
            <button className="btn btn-danger" onClick={() => review('rejected')} disabled={acting}>
              {acting ? <span className="spinner spinner-sm" /> : <><XCircle size={15} style={{ marginRight: 6 }} />Reject</>}
            </button>
            <button className="btn btn-outline" onClick={() => navigate(-1)} disabled={acting}>Cancel</button>
          </div>
        ) : (
          <div>
            <div className="alert alert-info">
              Already {summary.status} on {summary.reviewed_at ? new Date(summary.reviewed_at).toLocaleDateString() : ''}
            </div>
            <button className="btn btn-secondary" onClick={() => navigate(-1)}>Back</button>
          </div>
        )}
      </div>
    </div>
  )
}