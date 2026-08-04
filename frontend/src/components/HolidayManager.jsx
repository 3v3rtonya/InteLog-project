import { useState, useEffect, useCallback } from 'react'
import { apiGetHolidays, apiAddHoliday, apiAddHolidayRange, apiDeleteHoliday } from '../services/api'
import { useToast } from './Toast'
import ConfirmDialog from './ConfirmDialog'
import { useAuth } from '../App'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2]

export default function HolidayManager() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const isAdmin = user?.role === 'admin'
  const [year, setYear]         = useState(CURRENT_YEAR)
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading]   = useState(true)
  const [deleteId, setDeleteId] = useState(null)
  const [showAdd, setShowAdd]   = useState(false)
  const [addMode, setAddMode]   = useState('single')
  const [addForm, setAddForm]   = useState({ date: '', start_date: '', end_date: '', name: '' })
  const [adding, setAdding]     = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    apiGetHolidays(year)
      .then(r => setHolidays(r.data || []))
      .catch(() => showToast('Failed to load calendar', 'error'))
      .finally(() => setLoading(false))
  }, [year])

  useEffect(() => { load() }, [load])

  const publicHolidays = holidays.filter(h => h.type === 'public_holiday')
  const customEntries  = holidays.filter(h => h.type === 'custom')

  const handleDelete = async () => {
    try {
      await apiDeleteHoliday(deleteId)
      showToast('Custom entry removed', 'success')
      setDeleteId(null)
      load()
    } catch (err) {
      const detail = err.response?.data?.detail
      showToast(typeof detail === 'string' ? detail : 'Delete failed', 'error')
    }
  }

  const handleAdd = async () => {
    setAdding(true)
    try {
      if (addMode === 'single') {
        if (!addForm.date || !addForm.name.trim()) {
          showToast('Date and name are required', 'error'); return
        }
        await apiAddHoliday({ date: addForm.date, name: addForm.name.trim(), type: 'custom' })
        showToast('Custom non-working day added', 'success')
      } else {
        if (!addForm.start_date || !addForm.end_date || !addForm.name.trim()) {
          showToast('All fields are required', 'error'); return
        }
        const r = await apiAddHolidayRange({
          start_date: addForm.start_date,
          end_date:   addForm.end_date,
          name:       addForm.name.trim(),
          type:       'custom',
        })
        const added   = r.data.added?.length   || 0
        const skipped = r.data.skipped?.length || 0
        showToast(`Added ${added} days${skipped ? `, ${skipped} already existed` : ''}`, 'success')
      }
      setShowAdd(false)
      setAddForm({ date: '', start_date: '', end_date: '', name: '' })
      load()
    } catch (err) {
      const detail = err.response?.data?.detail
      showToast(typeof detail === 'string' ? detail : 'Failed to add entry', 'error')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAdmin ? 'Academic Calendar' : 'Non-Working Days'}</h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'National public holidays are managed automatically. Add custom non-working days (school breaks, institutional closures) below.'
              : 'Public holidays and custom non-working days. These days are not counted against intern attendance.'}
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            + Add Custom Day
          </button>
        )}
      </div>

      {/* Year selector */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Year:</span>
        {YEARS.map(y => (
          <button
            key={y}
            className={`btn btn-sm ${y === year ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setYear(y)}
          >{y}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {publicHolidays.length} public holidays · {customEntries.length} custom entries
        </span>
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner spinner-md" /></div>
      ) : (
        <>
          {/* ── National Public Holidays (auto-managed, read-only) ──────── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <h2 className="card-title">🇰🇪 National Public Holidays</h2>
              <span style={{
                background: '#e0f2fe', color: '#0369a1',
                padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
              }}>Auto-managed</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              These dates are automatically recognised by the system.
              The attendance calendar will not expect logbook entries on these days.
            </p>
            {publicHolidays.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No public holidays found for {year}.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {publicHolidays.map(h => {
                  const d = new Date(h.date + 'T00:00:00')
                  const dayName = d.toLocaleDateString('en-KE', { weekday: 'short' })
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <div key={h.id} style={{
                      background: isWeekend ? '#f1f5f9' : '#e0f2fe',
                      border: `1px solid ${isWeekend ? '#cbd5e1' : '#bae6fd'}`,
                      borderRadius: 8, padding: '6px 12px',
                      fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 2,
                      minWidth: 130,
                    }}>
                      <strong style={{ color: isWeekend ? '#475569' : '#0369a1' }}>{h.name}</strong>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {h.date} · {dayName}
                        {isWeekend && <span style={{ marginLeft: 4, color: '#94a3b8' }}>(weekend)</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Custom non-working days (admin-managed) ─────────────────── */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <h2 className="card-title">📌 Custom Non-Working Days</h2>
              {isAdmin && (
                <button className="btn btn-outline btn-sm" onClick={() => setShowAdd(true)}>+ Add</button>
              )}
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              {isAdmin
                ? 'School breaks, institutional closures, or any other custom non-working days. These can be removed anytime.'
                : 'Custom non-working days added by the university administrator.'
              }
            </p>
            {customEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No custom entries for {year}.
                </p>
                {isAdmin && (
                  <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => setShowAdd(true)}>
                    + Add Custom Day
                  </button>
                )}
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Name</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {customEntries.map(h => {
                    const d = new Date(h.date + 'T00:00:00')
                    const dayName = d.toLocaleDateString('en-KE', { weekday: 'long' })
                    return (
                      <tr key={h.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{h.date}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{dayName}</td>
                        <td><strong>{h.name}</strong></td>
                        <td>
                          {isAdmin && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => setDeleteId(h.id)}
                            >Remove</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Add custom modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 className="modal-title">Add Custom Non-Working Day</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}>×</button>
            </div>

            <div style={{
              background: '#FFF3CD', border: '1px solid #FFD700',
              borderRadius: 6, padding: '10px 14px', marginBottom: 16,
              fontSize: '0.82rem', color: '#856404',
            }}>
              ℹ️ National public holidays are added automatically. Only add entries here for
              school-specific closures or institutional breaks.
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                className={`btn btn-sm ${addMode === 'single' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAddMode('single')}
              >Single Date</button>
              <button
                className={`btn btn-sm ${addMode === 'range' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAddMode('range')}
              >Date Range</button>
            </div>

            {addMode === 'single' ? (
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date" className="form-input"
                  value={addForm.date}
                  onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Start Date *</label>
                  <input
                    type="date" className="form-input"
                    value={addForm.start_date}
                    onChange={e => setAddForm(f => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date *</label>
                  <input
                    type="date" className="form-input"
                    value={addForm.end_date}
                    min={addForm.start_date || undefined}
                    onChange={e => setAddForm(f => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                className="form-input"
                placeholder="e.g. Easter Break, University Founders Day"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)} disabled={adding}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={adding}>
                {adding ? <span className="spinner spinner-sm" /> : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Remove Custom Entry"
        message="Remove this custom non-working day? The attendance calendar will treat it as a working day again."
        confirmLabel="Remove"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
