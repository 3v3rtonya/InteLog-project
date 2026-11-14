import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiCreateLog, apiUpdateLog, apiGetLog, apiGetLogs, apiAssessLogbook } from '../services/api'
import { useToast } from './Toast'
import ImageUploader from './ImageUploader'
import PIIScrubPreview from './PIIScrubPreview'
import { AlertTriangle, Lightbulb, Save, Send, Wand2 } from 'lucide-react'
import useAutosave from '../hooks/useAutosave'

export default function LogbookEntryForm() {
  const navigate = useNavigate()
  const { id } = useParams()           // present when editing an existing draft
  const { showToast } = useToast()
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    entry_date: today,
    activities_performed: '',
    solutions_offered: '',
    problems_encountered: '',
    lessons_learned: '',
  })
  const [logId, setLogId] = useState(id || null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(!!id)
  const [showPII, setShowPII] = useState(false)
  const [errors, setErrors] = useState({})
  const [assessment, setAssessment] = useState(null)
  const [assessing, setAssessing] = useState(false)

  const { saveStatus, savedAt } = useAutosave(form, logId, setLogId, loading)
  const [pendingDraft, setPendingDraft] = useState(null)

  // Load existing draft when editing, or resume today's draft in new-entry mode
  useEffect(() => {
    if (id) {
      // Edit mode — load the specific draft by id
      apiGetLog(id)
        .then(({ data }) => {
          if (data.status !== 'draft') {
            showToast('Only draft entries can be edited', 'error')
            navigate('/intern/logs')
            return
          }
          setForm({
            entry_date: data.entry_date,
            activities_performed: data.activities_performed,
            solutions_offered: data.solutions_offered,
            problems_encountered: data.problems_encountered || '',
            lessons_learned: data.lessons_learned || '',
          })
          setLogId(data.id)
        })
        .catch(() => { showToast('Failed to load entry', 'error'); navigate('/intern/logs') })
        .finally(() => setFetching(false))
    } else {
      // New entry mode: check for an existing draft for today and resume it
      apiGetLogs({ status: 'draft', date_from: today, date_to: today, page_size: 1 })
        .then(({ data }) => {
          const drafts = data.items || []
          if (drafts.length > 0) {
            const d = drafts[0]
            setForm({
              entry_date: d.entry_date,
              activities_performed: d.activities_performed,
              solutions_offered: d.solutions_offered,
              problems_encountered: d.problems_encountered || '',
              lessons_learned: d.lessons_learned || '',
            })
            setLogId(d.id)
          }
        })
        .catch(() => {})  // silent — if check fails just show blank form
    }
  }, [id])

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: '' }))
  }

  const handleDateChange = (e) => {
    const newDate = e.target.value
    setForm((f) => ({ ...f, entry_date: newDate }))
    if (errors.entry_date) setErrors((prev) => ({ ...prev, entry_date: '' }))
    // Check for an existing draft on the new date (only in new-entry mode)
    if (!id && newDate) {
      apiGetLogs({ status: 'draft', date_from: newDate, date_to: newDate, page_size: 1 })
        .then(({ data }) => {
          const drafts = data.items || []
          if (drafts.length > 0 && drafts[0].id !== logId) {
            setPendingDraft(drafts[0])
          }
        })
        .catch(() => {})
    }
  }

  const countWords = (text) => text.trim() === '' ? 0 : text.trim().split(/\s+/).length
  const MAX_WORDS = 500
  const totalWords = countWords(form.activities_performed) + 
                     countWords(form.solutions_offered) +
                     countWords(form.problems_encountered) +
                     countWords(form.lessons_learned)
  const wordsLeft = MAX_WORDS - totalWords

  const validate = () => {
    const e = {}
    if (!form.entry_date) e.entry_date = 'Date is required.'
    if (!form.activities_performed.trim()) e.activities_performed = 'Activities are required.'
    if (!form.solutions_offered.trim()) e.solutions_offered = 'Solutions are required.'
    if (totalWords > MAX_WORDS) e.solutions_offered = `Total word count (${totalWords}) exceeds the ${MAX_WORDS}-word maximum.`
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleAssess = async () => {
    if (!form.activities_performed.trim() && !form.solutions_offered.trim()) {
      showToast('Please enter activities and solutions first.', 'error')
      return
    }
    setAssessing(true)
    try {
      const combinedText = [
        form.activities_performed, 
        form.solutions_offered, 
        form.problems_encountered, 
        form.lessons_learned
      ].filter(Boolean).join('\n')
      
      const { data } = await apiAssessLogbook({ text: combinedText })
      setAssessment(data)
      showToast('Assessment complete', 'success')
    } catch (err) {
      showToast('Failed to assess entry', 'error')
    } finally {
      setAssessing(false)
    }
  }

  const saveDraft = async () => {
    if (!validate()) return null
    setLoading(true)
    try {
      let data
      if (logId) {
        ;({ data } = await apiUpdateLog(logId, { ...form, status: 'draft' }))
      } else {
        ;({ data } = await apiCreateLog({ ...form, status: 'draft' }))
        setLogId(data.id)
      }
      showToast('Draft saved!', 'success')
      return data.id
    } catch (err) {
      showToast(err.response?.data?.detail || 'Save failed', 'error')
      return null
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        ...form,
        status: 'pending_approval',
      }
      if (logId) {
        await apiUpdateLog(logId, payload)
      } else {
        await apiCreateLog(payload)
      }
      showToast('Log submitted for approval!', 'success')
      navigate('/intern/logs')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Submission failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) return <div className="spinner-center"><div className="spinner spinner-lg" /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{id ? 'Edit Draft' : 'New Log Entry'}</h1>
          <p className="page-subtitle">Record your daily activities</p>
        </div>
      </div>

      <div className="card">
        {/* Date */}
        <div className="form-group">
          <label className="form-label" htmlFor="log-date">Entry Date *</label>
          <input
            id="log-date"
            className="form-input"
            type="date"
            value={form.entry_date}
            onChange={handleDateChange}
            max={today}
          />
          {errors.entry_date && <span className="form-error">{errors.entry_date}</span>}
          {pendingDraft && (
            <div className="alert alert-info" style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.88rem' }}>
                A draft exists for {pendingDraft.entry_date} — load it?
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => {
                  setForm({
                    entry_date: pendingDraft.entry_date,
                    activities_performed: pendingDraft.activities_performed,
                    solutions_offered: pendingDraft.solutions_offered,
                    problems_encountered: pendingDraft.problems_encountered || '',
                    lessons_learned: pendingDraft.lessons_learned || '',
                  })
                  setLogId(pendingDraft.id)
                  setPendingDraft(null)
                }}>Load Draft</button>
                <button className="btn btn-outline btn-sm" type="button" onClick={() => setPendingDraft(null)}>Dismiss</button>
              </div>
            </div>
          )}
        </div>

        {/* Activities */}
        <div className="form-group">
          <label className="form-label" htmlFor="log-activities">Activities Performed *</label>
          <textarea
            id="log-activities"
            className="form-textarea"
            rows={5}
            value={form.activities_performed}
            onChange={set('activities_performed')}
            placeholder="Describe the activities you performed today..."
            style={{ minHeight: 120 }}
          />
          <span className="form-hint" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {countWords(form.activities_performed)} words
          </span>
          {errors.activities_performed && <span className="form-error">{errors.activities_performed}</span>}
        </div>

        {/* Solutions */}
        <div className="form-group">
          <label className="form-label" htmlFor="log-solutions">Solutions Offered *</label>
          <textarea
            id="log-solutions"
            className="form-textarea"
            rows={5}
            value={form.solutions_offered}
            onChange={set('solutions_offered')}
            placeholder="Describe solutions or contributions you provided..."
            style={{ minHeight: 120 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 4 }}>
            <span className="form-hint" style={{ margin: 0 }}>
              {countWords(form.solutions_offered)} words
            </span>
            <span style={{
              fontSize: '0.78rem', fontWeight: 600,
              color: wordsLeft < 0 ? '#EF4444' : wordsLeft < 20 ? '#F59E0B' : 'var(--text-muted)',
            }}>
              Combined: {totalWords} / {MAX_WORDS} words
              {wordsLeft < 0 && ` — ${Math.abs(wordsLeft)} over limit`}
            </span>
          </div>
          {wordsLeft < 0 && (
            <span className="form-error">Total word count exceeds the {MAX_WORDS}-word maximum. Please shorten your entries.</span>
          )}
          {errors.solutions_offered && <span className="form-error">{errors.solutions_offered}</span>}
          {form.solutions_offered.length > 10 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 6 }}
              onClick={() => setShowPII((p) => !p)}
            >
              {showPII ? 'Hide' : 'Preview'} PII Scrubbing
            </button>
          )}
        </div>

        {showPII && <PIIScrubPreview text={form.solutions_offered} />}



        {/* Problems Encountered */}
        <div className="form-group">
          <label className="form-label" htmlFor="log-problems">Unique Problems Encountered</label>
          <textarea
            id="log-problems"
            className="form-textarea"
            rows={4}
            value={form.problems_encountered}
            onChange={set('problems_encountered')}
            placeholder="Describe any challenges or unique problems you faced..."
            style={{ minHeight: 90 }}
          />
        </div>

        {/* Lessons Learned */}
        <div className="form-group">
          <label className="form-label" htmlFor="log-lessons">Lessons Learnt</label>
          <textarea
            id="log-lessons"
            className="form-textarea"
            rows={4}
            value={form.lessons_learned}
            onChange={set('lessons_learned')}
            placeholder="What new skills or lessons did you learn today?"
            style={{ minHeight: 90 }}
          />
        </div>

        {/* Image uploader — only available after draft is saved */}
        {logId ? (
          <div className="form-group">
            <label className="form-label">Evidence Photos (max 3 JPEGs)</label>
            <ImageUploader logId={logId} />
          </div>
        ) : (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            <Lightbulb size={16} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> Save as draft first to upload evidence photos.
          </div>
        )}

        {/* Action buttons */}
        {assessment && (
          <div className={`alert ${assessment.classification === 'HIGH_QUALITY' ? 'alert-success' : assessment.classification === 'LOW_DETAIL' ? 'alert-warning' : 'alert-error'}`} style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1em' }}>AI Feedback: {assessment.classification.replace('_', ' ')}</h4>
            <p style={{ margin: '0 0 8px 0' }}>{assessment.feedback}</p>
            <p style={{ margin: 0, fontSize: '0.85em', opacity: 0.8 }}>Confidence: {(assessment.confidence * 100).toFixed(1)}%</p>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <button 
            className="btn" 
            style={{ 
              background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)', 
              color: 'white', 
              border: 'none', 
              boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.3)' 
            }} 
            onClick={handleAssess} 
            disabled={loading || assessing} 
            type="button"
          >
            {assessing ? <span className="spinner spinner-sm" /> : <><Wand2 size={16} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> Pre-Assess with AI</>}
          </button>
          <button className="btn btn-secondary" onClick={saveDraft} disabled={loading || assessing}>
            {loading ? <span className="spinner spinner-sm" /> : <><Save size={16} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> Save Draft</>}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <span className="spinner spinner-sm" /> : <><Send size={16} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> Submit for Approval</>}
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/intern/logs')} disabled={loading}>
            Cancel
          </button>
        </div>

        {/* Autosave status indicator */}
        {saveStatus === 'saving' && (
          <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Saving…
          </div>
        )}
        {saveStatus === 'saved' && savedAt && (
          <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#16a34a' }}>
            Saved ✓ {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        {saveStatus === 'error' && (
          <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--danger, #dc2626)' }}>
            Autosave failed
          </div>
        )}
      </div>
    </div>
  )
}
