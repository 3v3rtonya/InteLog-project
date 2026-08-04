import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiGetLog } from '../services/api'
import StatusBadge from './StatusBadge'

export default function LogbookDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [log, setLog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)

  const getUploadUrl = (path) => {
    const filename = path?.split(/[/\\]/).pop()
    return filename ? `/uploads/${filename}` : ''
  }

  useEffect(() => {
    apiGetLog(id)
      .then(({ data }) => setLog(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="spinner-center"><div className="spinner spinner-lg" /></div>
  if (!log) return (
    <div className="empty-state">
      <div className="empty-state-icon">🔍</div>
      <div className="empty-state-title">Log entry not found</div>
      <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => navigate(-1)}>
        ← Go Back
      </button>
    </div>
  )

  const timeline = [
    { label: 'Created',   date: log.created_at,   done: true },
    { label: 'Submitted', date: log.submitted_at,  done: !!log.submitted_at },
    { label: 'Approved',  date: log.approved_at,   done: log.status === 'approved' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="page-title">Log — {log.entry_date}</h1>
          <StatusBadge status={log.status} />
          {log.is_onsite
            ? <span style={{ color: 'var(--brand-green)', fontSize: '0.875rem' }}>✅ On-site</span>
            : <span style={{ color: '#EF4444', fontSize: '0.875rem' }}>❌ Off-site</span>
          }
        </div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Back</button>
      </div>

      {/* Flag warning */}
      {log.is_flagged && (
        <div className="alert alert-warning">⚠️ Flagged: {log.flag_reason}</div>
      )}

      {/* Rejection / flag reason — flag_reason stores both flag text and rejection reason */}
      {log.status === 'rejected' && log.flag_reason && (
        <div className="alert alert-error">❌ Returned by supervisor: {log.flag_reason}</div>
      )}

      {/* Activities */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3 className="card-title">Activities Performed</h3></div>
        <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {log.activities_performed}
        </p>
      </div>

      {/* Solutions */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3 className="card-title">Solutions Offered</h3></div>
        <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {log.solutions_scrubbed || log.solutions_offered}
        </p>
        {log.solutions_scrubbed && log.solutions_scrubbed !== log.solutions_offered && (
          <p className="form-hint" style={{ marginTop: 8 }}>
            ℹ️ PII has been automatically redacted from this text.
          </p>
        )}
      </div>

      {/* Images */}
      {log.images?.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3 className="card-title">Evidence Photos</h3>
            <span className="form-hint">{log.images.length} image{log.images.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="image-gallery">
            {log.images.map((img) => (
              <img
                key={img.id}
                className="gallery-img"
                src={getUploadUrl(img.file_path)}
                alt={img.original_filename || 'Evidence photo'}
                onClick={() => setLightbox(img)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card">
        <div className="card-header"><h3 className="card-title">Timeline</h3></div>
        <div className="log-timeline">
          {timeline.map((t, i) => (
            <div key={i} className="log-timeline-item">
              <div className={'log-timeline-dot' + (t.done ? ' done' : '')} />
              <span style={{ fontWeight: t.done ? 600 : 400 }}>{t.label}</span>
              {t.date && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {new Date(t.date).toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="modal-overlay"
          onClick={() => setLightbox(null)}
          style={{ cursor: 'zoom-out' }}
        >
          <img
            src={getUploadUrl(lightbox.file_path)}
            alt={lightbox.original_filename || 'Evidence photo'}
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
