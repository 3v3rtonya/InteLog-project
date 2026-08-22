import { useState, useEffect } from 'react'
import { apiGetAttendanceStats } from '../services/api'
import { useToast } from './Toast'
import { CheckCircle, Clock, Stethoscope, Sun, AlertTriangle, Clock4, HelpCircle, Timer, Calendar as CalendarIcon, CalendarDays } from 'lucide-react'

/**
 * AttendanceCalendar
 *
 * Props:
 *   internId  — UUID (optional). If omitted, fetches the logged-in intern's own stats.
 *   compact   — boolean. If true shows only the progress bars (no full calendar grid).
 */

const STATUS_META = {
  approved:         { color: '#16a34a', label: 'Approved',         bg: '#dcfce7' },
  pending:          { color: '#ca8a04', label: 'Pending',           bg: '#fef9c3' },
  rejected:         { color: '#dc2626', label: 'Rejected',          bg: '#fee2e2' },
  absent_sick:      { color: '#7c3aed', label: 'Sick',              bg: '#ede9fe' },
  absent_day_off:   { color: '#0284c7', label: 'Day Off',           bg: '#e0f2fe' },
  absent_emergency: { color: '#ea580c', label: 'Emergency',         bg: '#ffedd5' },
  absent_half_day:  { color: '#0891b2', label: 'Half Day',          bg: '#cffafe' },
  unexplained:      { color: '#b91c1c', label: 'Unexplained',       bg: '#fecaca' },
  within_grace:     { color: '#d97706', label: 'Pending submission', bg: '#fde68a' },
  holiday:          { color: '#6366f1', label: 'Public Holiday',    bg: '#e0e7ff' },
  weekend:          { color: '#94a3b8', label: 'Weekend',           bg: '#f1f5f9' },
  future:           { color: '#cbd5e1', label: 'Upcoming',          bg: '#f8fafc' },
  outside_period:   { color: '#e2e8f0', label: 'Outside Period',    bg: '#f8fafc' },
}

function DayCell({ day }) {
  const meta = STATUS_META[day.status] || STATUS_META.future
  const [hovered, setHovered] = useState(false)

  return (
    <div
      title={`${day.date} — ${meta.label}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 28, height: 28, borderRadius: 6,
        background: meta.bg,
        border: `2px solid ${hovered ? meta.color : 'transparent'}`,
        cursor: 'default',
        transition: 'border-color 0.1s',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Day number */}
      <span style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.65rem', fontWeight: 600,
        color: meta.color,
      }}>
        {new Date(day.date + 'T00:00:00').getDate()}
      </span>
    </div>
  )
}

function ProgressBar({ label, value, total, color, bg }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 600, color }}>{value} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 4, transition: 'width 0.6s ease',
          minWidth: value > 0 ? 4 : 0,
        }} />
      </div>
    </div>
  )
}

export default function AttendanceCalendar({ internId = null, compact = false }) {
  const { showToast } = useToast()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewYear, setViewYear] = useState(null)
  const [viewMonth, setViewMonth] = useState(null)

  useEffect(() => {
    const params = internId ? { intern_id: internId } : {}
    apiGetAttendanceStats(params)
      .then(r => {
        setStats(r.data)
        if (r.data.attachment_start) {
          const d = new Date(r.data.attachment_start + 'T00:00:00')
          setViewYear(d.getFullYear())
          setViewMonth(d.getMonth())
        }
      })
      .catch(() => showToast('Failed to load attendance', 'error'))
      .finally(() => setLoading(false))
  }, [internId])

  if (loading) return <div className="spinner-center"><div className="spinner spinner-md" /></div>
  if (!stats || !stats.attachment_start) return (
    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '12px 0' }}>
      No attachment period set.
    </div>
  )

  const total = stats.total_working_days
  const startDate = new Date(stats.attachment_start + 'T00:00:00')
  const endDate = new Date(stats.attachment_end + 'T00:00:00')

  // Group days by year-month for calendar grid
  const byMonth = {}
  for (const day of stats.days_calendar) {
    const d = new Date(day.date + 'T00:00:00')
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(day)
  }
  const monthKeys = Object.keys(byMonth).sort()

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const DAY_LABELS  = ['S','M','T','W','T','F','S']

  const currentKey = viewYear !== null && viewMonth !== null
    ? `${viewYear}-${viewMonth}`
    : monthKeys[0]
  const currentDays = byMonth[currentKey] || []
  const currentIdx  = monthKeys.indexOf(currentKey)

  // Build full calendar grid for the month (including padding before day 1)
  const firstDay = currentDays.length > 0
    ? new Date(currentDays[0].date + 'T00:00:00').getDay()
    : 0
  const calendarCells = [...Array(firstDay).fill(null), ...currentDays]

  function navMonth(delta) {
    const newIdx = currentIdx + delta
    if (newIdx < 0 || newIdx >= monthKeys.length) return
    const [y, m] = monthKeys[newIdx].split('-').map(Number)
    setViewYear(y)
    setViewMonth(m)
  }

  const [y, m] = currentKey.split('-').map(Number)

  return (
    <div>
      {/* ── Attachment period header ──────────────────────────── */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 'var(--radius)',
        padding: '12px 16px', marginBottom: 16,
        display: 'flex', flexWrap: 'wrap', gap: '6px 24px', fontSize: '0.85rem',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CalendarIcon size={16} /> <strong>Attachment:</strong> {stats.attachment_start} → {stats.attachment_end}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CalendarDays size={16} /> <strong>Working days:</strong> {total}</span>
        {stats.unexplained > 0 && (
          <span style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={16} /> <strong>Unexplained:</strong> {stats.unexplained}</span>
        )}
      </div>

      {/* ── Progress bars ─────────────────────────────────────── */}
      <div style={{ marginBottom: compact ? 0 : 20 }}>
        <ProgressBar label="Approved"    value={stats.approved}         total={total} color="#16a34a" />
        <ProgressBar label="Pending"     value={stats.pending}          total={total} color="#ca8a04" />
        <ProgressBar label="Sick"        value={stats.absent_sick}      total={total} color="#7c3aed" />
        <ProgressBar label="Day Off"     value={stats.absent_day_off}   total={total} color="#0284c7" />
        <ProgressBar label="Emergency"   value={stats.absent_emergency} total={total} color="#ea580c" />
        <ProgressBar label="Half Day"    value={stats.absent_half_day}  total={total} color="#0891b2" />
        <ProgressBar label="Unexplained" value={stats.unexplained}      total={total} color="#b91c1c" />
      </div>

      {/* Summary chips */}
      {!compact && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {[
            { key: 'approved',         icon: <CheckCircle size={14} />, label: 'Approved',   val: stats.approved },
            { key: 'pending',          icon: <Clock size={14} />, label: 'Pending',    val: stats.pending },
            { key: 'absent_sick',      icon: <Stethoscope size={14} />, label: 'Sick',       val: stats.absent_sick },
            { key: 'absent_day_off',   icon: <Sun size={14} />, label: 'Day Off',    val: stats.absent_day_off },
            { key: 'absent_emergency', icon: <AlertTriangle size={14} />, label: 'Emergency',  val: stats.absent_emergency },
            { key: 'absent_half_day',  icon: <Clock4 size={14} />, label: 'Half Day',   val: stats.absent_half_day },
            { key: 'unexplained',      icon: <HelpCircle size={14} />, label: 'Unexplained',val: stats.unexplained },
            { key: 'within_grace',     icon: <Timer size={14} />, label: 'In Grace',   val: stats.within_grace },
            { key: 'non_working',      icon: <CalendarIcon size={14} />, label: 'Non-Working',val: stats.non_working },
          ].map(({ key, icon, label, val }) => (
            <div key={key} style={{
              background: STATUS_META[key]?.bg || '#f1f5f9',
              border: `1px solid ${STATUS_META[key]?.color || '#94a3b8'}30`,
              borderRadius: 20, padding: '4px 12px',
              fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span>{icon}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{label}:</span>
              <strong style={{ color: STATUS_META[key]?.color || 'var(--text-primary)' }}>{val}</strong>
            </div>
          ))}
        </div>
      )}

      {/* ── Calendar grid ─────────────────────────────────────── */}
      {!compact && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)', padding: '16px',
        }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => navMonth(-1)}
              disabled={currentIdx <= 0}
            >← Prev</button>
            <strong style={{ fontSize: '0.95rem' }}>
              {MONTH_NAMES[m]} {y}
            </strong>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => navMonth(1)}
              disabled={currentIdx >= monthKeys.length - 1}
            >Next →</button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 28px)', gap: 4, marginBottom: 4, justifyContent: 'center' }}>
            {DAY_LABELS.map((d, i) => (
              <div key={i} style={{
                width: 28, textAlign: 'center', fontSize: '0.65rem',
                fontWeight: 700, color: 'var(--text-muted)',
              }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 28px)', gap: 4, justifyContent: 'center' }}>
            {calendarCells.map((day, i) =>
              day ? <DayCell key={day.date} day={day} /> : <div key={`pad-${i}`} style={{ width: 28, height: 28 }} />
            )}
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '6px 12px',
            marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 12,
          }}>
            {Object.entries(STATUS_META)
              .filter(([k]) => !['future','outside_period'].includes(k))
              .map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: v.bg, border: `1.5px solid ${v.color}` }} />
                  <span style={{ color: 'var(--text-muted)' }}>{v.label}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
