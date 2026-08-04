import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiCreateLog, apiUpdateLog, apiGetLog } from '../services/api'
import { useToast } from './Toast'
import GeolocationCapture from './GeolocationCapture'
import ImageUploader from './ImageUploader'
import PIIScrubPreview from './PIIScrubPreview'

export default function LogbookEntryForm() {
  const navigate = useNavigate()
  const { id } = useParams()           // present when editing an existing draft
  const { showToast } = useToast()
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    entry_date: today,
    activities_performed: '',
    solutions_offered: '',
  })
  const [geo, setGeo] = useState({ latitude: null, longitude: null, isOnsite: false, accuracy: null })
  const [logId, setLogId] = useState(id || null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(!!id)
  const [showPII, setShowPII] = useState(false)
  const [errors, setErrors] = useState({})

  // Load existing draft when editing
  useEffect(() => {
    if (!id) return
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
        })
        setLogId(data.id)
      })
      .catch(() => { showToast('Failed to load entry', 'error'); navigate('/intern/logs') })
      .finally(() => setFetching(false))
  }, [id])

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: '' }))
  }

  const countWords = (text) => text.trim() === '' ? 0 : text.trim().split(/\s+/).length
  const MAX_WORDS = 250
  const totalWords = countWords(form.activities_performed) + countWords(form.solutions_offered)
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
    if (!geo.isOnsite) {
      showToast('You must verify your location before submitting', 'error')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...form,
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy_m: geo.accuracy ?? null,
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
            onChange={set('entry_date')}
            max={today}
          />
          {errors.entry_date && <span className="form-error">{errors.entry_date}</span>}
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

        {/* Geolocation */}
        <div className="form-group">
          <label className="form-label">Location Verification</label>
          <GeolocationCapture onResult={setGeo} />
          {!geo.isOnsite && (
            <p className="form-hint" style={{ marginTop: 4 }}>
              ⚠️ Location must be verified as on-site before you can submit.
            </p>
          )}
        </div>

        {/* Image uploader — only available after draft is saved */}
        {logId ? (
          <div className="form-group">
            <label className="form-label">Evidence Photos (max 3 JPEGs)</label>
            <ImageUploader logId={logId} />
          </div>
        ) : (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            💡 Save as draft first to upload evidence photos.
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={saveDraft} disabled={loading}>
            {loading ? <span className="spinner spinner-sm" /> : '💾 Save Draft'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading || !geo.isOnsite}
            title={!geo.isOnsite ? 'Verify your location first' : ''}
          >
            {loading ? <span className="spinner spinner-sm" /> : '📤 Submit for Approval'}
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/intern/logs')} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
