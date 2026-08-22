import { useState, useRef } from 'react'
import { apiDownloadTemplate, apiPreRegisterUpload } from '../services/api'
import { useToast } from './Toast'
import { Download, Upload, FileText, FolderOpen, GraduationCap, ClipboardEdit } from 'lucide-react'

const ACTION_LABELS = {
  created_intern:        { label: 'Created',        color: '#16a34a', bg: '#dcfce7' },
  merged_intern:         { label: 'Merged',         color: '#0369a1', bg: '#e0f2fe' },
  existing_active_intern:{ label: 'Already Active', color: '#92400e', bg: '#fef3c7' },
  error:                 { label: 'Error',           color: '#b91c1c', bg: '#fee2e2' },
}
const LEC_LABELS = {
  created_lecturer:  { label: '+ New Lecturer', color: '#7c3aed', bg: '#ede9fe' },
  existing_lecturer: { label: 'Existing',       color: '#6b7280', bg: '#f3f4f6' },
  error:             { label: 'Error',           color: '#b91c1c', bg: '#fee2e2' },
}

function Chip({ meta }) {
  if (!meta) return null
  return (
    <span style={{
      background: meta.bg, color: meta.color,
      padding: '2px 8px', borderRadius: 20,
      fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap',
    }}>{meta.label}</span>
  )
}

export default function PreRegisterPage() {
  const { showToast } = useToast()
  const fileRef       = useRef(null)
  const [file, setFile]         = useState(null)
  const [uploading, setUploading] = useState(false)
  const [report, setReport]     = useState(null)
  const [filter, setFilter]     = useState('all')  // all | errors | created | merged

  // ── Template download ─────────────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    try {
      const res = await apiDownloadTemplate()
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'intelog_student_template.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast('Failed to download template', 'error')
    }
  }

  // ── File selection ────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.csv')) {
      showToast('Only CSV files are accepted', 'error')
      return
    }
    setFile(f)
    setReport(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) { setFile(f); setReport(null) }
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) { showToast('Please select a CSV file first', 'error'); return }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiPreRegisterUpload(formData)
      setReport(res.data)
      const { interns_created, interns_merged, interns_skipped, lecturers_created } = res.data
      showToast(
        `Import complete — ${interns_created} created, ${interns_merged} merged, ` +
        `${lecturers_created} lecturers created, ${interns_skipped} skipped`,
        interns_skipped > 0 ? 'warning' : 'success'
      )
    } catch (err) {
      const detail = err.response?.data?.detail
      showToast(typeof detail === 'string' ? detail : 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  // ── Filter rows ───────────────────────────────────────────────────────────
  const filteredRows = report?.rows?.filter(r => {
    if (filter === 'all')     return true
    if (filter === 'errors')  return r.action === 'error'
    if (filter === 'created') return r.action === 'created_intern'
    if (filter === 'merged')  return r.action === 'merged_intern'
    return true
  }) ?? []

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Pre-Register Students</h1>
          <p className="page-subtitle">
            Upload the university student list to pre-assign interns to lecturers
            before they self-register on the system.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleDownloadTemplate}>
          <Download size={16} style={{ marginRight: 6 }} /> Download CSV Template
        </button>
      </div>

      {/* How it works */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 8 }}>
          <h2 className="card-title">How it works</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { n: '1', icon: <Download size={24} />, title: 'Download template', desc: 'Get the CSV template with the correct column headers' },
            { n: '2', icon: <ClipboardEdit size={24} />, title: 'Fill in student list', desc: 'Add student names, IDs, emails, phones, school, dept and their lecturer details' },
            { n: '3', icon: <Upload size={24} />, title: 'Upload CSV', desc: 'System creates shell accounts and assigns each student to their lecturer' },
            { n: '4', icon: <GraduationCap size={24} />, title: 'Students register', desc: 'Student opens the app, signs up with their student ID — their pre-assignment activates automatically' },
          ].map(s => (
            <div key={s.n} style={{
              background: 'var(--bg-secondary)', borderRadius: 8,
              padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: '1.4rem' }}>{s.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{s.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CSV columns info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 8 }}>
          <h2 className="card-title">Required CSV Columns</h2>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['full_name','student_id','email','phone','school','department',
            'lecturer_name','lecturer_email','lecturer_phone'].map(col => (
            <code key={col} style={{
              background: 'var(--bg-secondary)', padding: '3px 10px',
              borderRadius: 6, fontSize: '0.8rem', color: 'var(--text-primary)',
            }}>{col}</code>
          ))}
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 10 }}>
          Multiple students can share the same lecturer columns — the system groups them automatically.
          If a lecturer email doesn't exist yet, an account is created and credentials are emailed to them.
        </p>
      </div>

      {/* Upload zone */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title" style={{ marginBottom: 12 }}>Upload Student List</h2>

        {/* Drop zone */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${file ? 'var(--accent, #16a34a)' : 'var(--border-color)'}`,
            borderRadius: 10, padding: '32px 24px', textAlign: 'center',
            cursor: 'pointer', transition: 'border-color 0.2s',
            background: file ? 'var(--bg-secondary)' : 'transparent',
            marginBottom: 16,
          }}
        >
          <input
            ref={fileRef} type="file" accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {file ? (
            <>
              <div style={{ fontSize: '2rem', marginBottom: 6 }}><FileText size={40} color="var(--accent)" /></div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {(file.size / 1024).toFixed(1)} KB — click to change
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}><FolderOpen size={48} color="var(--text-secondary)" /></div>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                Drag &amp; drop your CSV here
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                or click to browse — max 500 rows per file
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{ minWidth: 140 }}
          >
            {uploading
              ? <><span className="spinner spinner-sm" style={{ marginRight: 8 }} />Importing…</>
              : <><Upload size={16} style={{ marginRight: 6 }} /> Import Students</>
            }
          </button>
          {file && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setFile(null); setReport(null); fileRef.current.value = '' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Import report */}
      {report && (
        <div className="card">
          {/* Summary chips */}
          <div className="card-header" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h2 className="card-title">Import Report</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: `${report.total_rows} rows`,              bg: '#f1f5f9', color: '#475569' },
                { label: `${report.interns_created} created`,      bg: '#dcfce7', color: '#16a34a' },
                { label: `${report.interns_merged} merged`,        bg: '#e0f2fe', color: '#0369a1' },
                { label: `${report.lecturers_created} new lecturers`, bg: '#ede9fe', color: '#7c3aed' },
                { label: `${report.assignments_created} assigned`, bg: '#fef9c3', color: '#92400e' },
                ...(report.interns_skipped > 0
                  ? [{ label: `${report.interns_skipped} skipped/errors`, bg: '#fee2e2', color: '#b91c1c' }]
                  : []),
              ].map((c, i) => (
                <span key={i} style={{
                  background: c.bg, color: c.color,
                  padding: '4px 12px', borderRadius: 20,
                  fontSize: '0.8rem', fontWeight: 600,
                }}>{c.label}</span>
              ))}
            </div>
          </div>

          {/* Row filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[
              { key: 'all',     label: 'All Rows' },
              { key: 'created', label: 'Created' },
              { key: 'merged',  label: 'Merged' },
              { key: 'errors',  label: 'Errors' },
            ].map(f => (
              <button
                key={f.key}
                className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFilter(f.key)}
              >{f.label}</button>
            ))}
          </div>

          {/* Rows table */}
          <div style={{ maxHeight: 400, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <table className="table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 48 }}>Row</th>
                  <th>Student</th>
                  <th>Student ID</th>
                  <th>Lecturer</th>
                  <th>Intern</th>
                  <th>Lecturer</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                    No rows match this filter.
                  </td></tr>
                ) : filteredRows.map(r => (
                  <tr key={r.row} style={{ background: r.action === 'error' ? '#fff5f5' : undefined }}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {r.row}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}><strong>{r.intern_name}</strong></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.student_id}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.lecturer_email}</td>
                    <td><Chip meta={ACTION_LABELS[r.action]} /></td>
                    <td><Chip meta={LEC_LABELS[r.lecturer_action]} /></td>
                    <td style={{ fontSize: '0.78rem', color: r.action === 'error' ? '#b91c1c' : 'var(--text-muted)' }}>
                      {r.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
