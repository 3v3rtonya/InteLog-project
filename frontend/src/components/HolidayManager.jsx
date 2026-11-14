import { useState, useEffect, useCallback } from 'react'
import { apiGetHolidays } from '../services/api'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2]

export default function HolidayManager() {
  const [year, setYear]         = useState(CURRENT_YEAR)
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    apiGetHolidays(year)
      .then(r => setHolidays((r.data || []).filter(h => h.type === 'public_holiday')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [year])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Public Holidays</h1>
          <p className="page-subtitle">
            National public holidays recognised by the system. Interns are not expected
            to submit logbook entries on these days.
          </p>
        </div>
      </div>

      {/* Year selector */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Year:</span>
        {YEARS.map(y => (
          <button
            key={y}
            className={'btn btn-sm ' + (y === year ? 'btn-primary' : 'btn-outline')}
            onClick={() => setYear(y)}
          >{y}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {holidays.length} public holidays
        </span>
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner spinner-md" /></div>
      ) : (
        <div className="card">
          <div className="card-header" style={{ marginBottom: 12 }}>
            <h2 className="card-title">National Public Holidays — {year}</h2>
            <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
              Auto-managed
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            These dates are automatically recognised. The attendance calendar will not expect logbook entries on these days.
          </p>
          {holidays.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No public holidays found for {year}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {holidays.map(h => {
                const d = new Date(h.date + 'T00:00:00')
                const dayName = d.toLocaleDateString('en-KE', { weekday: 'short' })
                const isWeekend = d.getDay() === 0 || d.getDay() === 6
                return (
                  <div key={h.id} style={{
                    background: isWeekend ? '#f1f5f9' : '#e0f2fe',
                    border: '1px solid ' + (isWeekend ? '#cbd5e1' : '#bae6fd'),
                    borderRadius: 8, padding: '8px 14px',
                    fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 2,
                    minWidth: 140,
                  }}>
                    <strong style={{ color: isWeekend ? '#475569' : '#0369a1' }}>{h.name}</strong>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {h.date}  {dayName}
                      {isWeekend && <span style={{ marginLeft: 4, color: '#94a3b8' }}>(weekend)</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}