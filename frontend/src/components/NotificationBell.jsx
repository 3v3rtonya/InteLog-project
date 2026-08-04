import { useState, useEffect, useRef, useCallback } from 'react'
import { apiGetNotifications, apiGetUnreadCount, apiMarkRead, apiMarkAllRead } from '../services/api'
import { useNavigate } from 'react-router-dom'

export default function NotificationBell() {
  const [unread, setUnread] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const ref = useRef()
  const navigate = useNavigate()

  const fetchCount = useCallback(async () => {
    try {
      const { data } = await apiGetUnreadCount()
      setUnread(data.unread)
    } catch {}
  }, [])

  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [fetchCount])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openBell = async () => {
    setOpen(o => !o)
    if (!open) {
      setLoading(true)
      try {
        const { data } = await apiGetNotifications({ limit: 10 })
        setNotifications(data)
      } catch {} finally { setLoading(false) }
    }
  }

  const handleClick = async (n) => {
    if (!n.is_read) {
      await apiMarkRead(n.id)
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
      setUnread(u => Math.max(0, u - 1))
    }
    setSelected(n)
  }

  const handleMarkAll = async () => {
    await apiMarkAllRead()
    setNotifications(prev => prev.map(x => ({ ...x, is_read: true })))
    setUnread(0)
  }

  const ICONS = {
    new_signup: '👤', log_submitted: '📋', log_approved: '✅',
    log_rejected: '❌', log_flagged: '⚠️',
    geofence_repin: <img src="/icon-location.svg" alt="location" style={{ width: '1.1em', height: '1.1em', verticalAlign: 'middle' }} />,
    pairing_approved: '🔗', pairing_rejected: '🚫',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        className="theme-toggle"
        onClick={openBell}
        title="Notifications"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        style={{ position: 'relative' }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: '#EF4444', color: '#fff',
            borderRadius: '50%', width: 16, height: 16,
            fontSize: '0.65rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 44, width: 360,
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          zIndex: 200, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Notifications</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {unread > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={handleMarkAll}>
                  Mark all read
                </button>
              )}
              <button
                className="btn btn-outline btn-sm"
                onClick={() => { setOpen(false); navigate('/notifications') }}
              >
                View all
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {loading ? (
              <div className="spinner-center"><div className="spinner spinner-sm" /></div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No notifications yet
              </div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  padding: '12px 16px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border-color)',
                  background: n.is_read ? 'transparent' : 'rgba(46,125,50,0.06)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(46,125,50,0.06)'}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 1 }}>
                    {ICONS[n.type] || '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: n.is_read ? 400 : 600,
                      fontSize: '0.875rem', color: 'var(--text-primary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {n.title}
                    </div>
                    <div style={{
                      fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {n.body}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  {!n.is_read && (
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--brand-green)', flexShrink: 0, marginTop: 6,
                    }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {ICONS[selected.type] || '🔔'} {selected.title}
              </h3>
              <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
              {selected.body}
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {new Date(selected.created_at).toLocaleString()}
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
