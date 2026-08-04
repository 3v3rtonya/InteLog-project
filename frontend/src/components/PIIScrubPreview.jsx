// Fix: escape HTML before injecting to prevent XSS from user-typed content
const escapeHtml = (t) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;')

export default function PIIScrubPreview({ text }) {
  const scrub = (t) => {
    if (!t) return t
    let s = t
    s = s.replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, '[EMAIL-REDACTED]')
    s = s.replace(/\b(INT|EMP|STF|ID)[-]?\d{3,8}\b/gi, '[ID-REDACTED]')
    s = s.replace(/\b\d{10,13}\b/g, '[PHONE-REDACTED]')
    return s
  }

  const highlight = (t) => {
    // Escape first, then re-inject only the safe redaction placeholder as a mark tag
    return escapeHtml(t).replace(
      /\[(EMAIL-REDACTED|ID-REDACTED|PHONE-REDACTED)\]/g,
      (m) => `<mark class="pii-redacted">${m}</mark>`
    )
  }

  const scrubbed = scrub(text)

  return (
    <div className="pii-preview">
      <div className="pii-panel">
        <div className="pii-panel-label">Original Text</div>
        <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
      </div>
      <div className="pii-panel">
        <div className="pii-panel-label">After PII Scrubbing</div>
        {/* Safe: user content is HTML-escaped before injection; only redaction marks are injected */}
        <div style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: highlight(scrubbed) }} />
      </div>
    </div>
  )
}