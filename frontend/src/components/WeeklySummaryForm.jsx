import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  apiCreateWeeklySummary, apiGetWeeklySummary,
  apiUpdateWeeklySummary, apiSubmitWeeklySummary
} from '../services/api'
import { useToast } from './Toast'
import { Save, Send } from 'lucide-react'

export default function WeeklySummaryForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [text, setText] = useState('')
  const [status, setStatus] = useState('draft')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(!!id)
  const [weekLabel, setWeekLabel] = useState('')
  const [supervisorGrade, setSupervisorGrade] = useState(null)
  const [supervisorFeedback, setSupervisorFeedback] = useState('')

  useEffect(() => {
    if (!id) {
      // Compute current week label
      const today = new Date()
      const mon = new Date(today)
      mon.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1))
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      setWeekLabel(mon.toLocaleDateString() + ' - ' + sun.toLocaleDateString())
      return
    }
    apiGetWeeklySummary(id)
      .then(({ data }) => {
        setText(data.summary_text)
        setStatus(data.status)
        setWeekLabel(data.week_start_date + ' to ' + data.week_end_date)
        setSupervisorGrade(data.supervisor_grade ?? null)
        setSupervisorFeedback(data.supervisor_feedback || '')
      })
      .catch(() => { showToast('Failed to load summary', 'error'); navigate('/intern/weekly-summary') })
      .finally(() => setFetching(false))
  }, [id])

  const saveDraft = async () => {
    if (!text.trim() || text.trim().length < 10) {
      showToast('Summary must be at least 10 characters', 'error'); return
    }
    setLoading(true)
    try {
      if (id) {
        await apiUpdateWeeklySummary(id, { summary_text: text })
      } else {
        const { data } = await apiCreateWeeklySummary({ summary_text: text })
        navigate('/intern/weekly-summary/' + data.id + '/edit', { replace: true })
      }
      showToast('Draft saved', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Save failed', 'error')
    } finally { setLoading(false) }
  }

  const submit = async () => {
    if (!id) { showToast('Save as draft first', 'error'); return }
    setLoading(true)
    try {
      await apiSubmitWeeklySummary(id)
      showToast('Summary submitted for review', 'success')
      navigate('/intern/weekly-summary')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Submission failed', 'error')
    } finally { setLoading(false) }
  }

  if (fetching) return <div className="spinner-center"><div className="spinner spinner-lg" /></div>

  const isDraft = status === 'draft' || !id

  const band = (g) => {
    if (g == null) return null
    if (g <= 4) return { label: 'WEAK', color: '#dc2626' }
    if (g <= 7) return { label: 'GOOD', color: '#d97706' }
    return { label: 'EXCELLENT', color: '#16a34a' }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{id ? 'Edit' : 'New'} Weekly Summary</h1>
          <p className="page-subtitle">{weekLabel}</p>
        </div>
      </div>
      <div className="card">
        {!isDraft && (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            This summary has been submitted and cannot be edited.
          </div>
        )}
        {!isDraft && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 8, color: 'var(--text-primary)' }}>
              Supervisor Feedback
            </div>
            {supervisorGrade != null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  background: band(supervisorGrade).color,
                  color: '#fff',
                  borderRadius: 20,
                  padding: '3px 12px',
                  fontWeight: 700,
                  fontSize: '0.85rem'
                }}>
                  {band(supervisorGrade).label}
                </span>
                <span style={{ fontWeight: 600, color: band(supervisorGrade).color }}>
                  {supervisorGrade}/10
                </span>
              </div>
            ) : (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                Not yet graded
              </div>
            )}
            {supervisorFeedback && (
              <blockquote style={{
                margin: 0, borderLeft: '3px solid var(--brand-red)',
                paddingLeft: 12, color: 'var(--text-secondary)',
                fontSize: '0.88rem', lineHeight: 1.6
              }}>
                {supervisorFeedback}
              </blockquote>
            )}
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Summary *</label>
          <textarea
            className="form-textarea"
            rows={10}
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={!isDraft || loading}
            placeholder="Describe what you worked on this week, what you learned, challenges you faced, and your progress..."
            style={{ minHeight: 200 }}
          />
          <span className="form-hint">
            {text.trim().split(/\s+/).filter(Boolean).length} words
          </span>
        </div>
        {isDraft && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={saveDraft} disabled={loading}>
              {loading ? <span className="spinner spinner-sm" /> : <><Save size={15} style={{ marginRight: 6 }} />Save Draft</>}
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={loading || !id}>
              {loading ? <span className="spinner spinner-sm" /> : <><Send size={15} style={{ marginRight: 6 }} />Submit for Review</>}
            </button>
            <button className="btn btn-outline" onClick={() => navigate(-1)} disabled={loading}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}