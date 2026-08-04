import { useState, useEffect } from 'react'
import { apiGetNotificationHistory, apiMarkRead } from '../services/api'

const ICONS = {
  new_signup: '👤', log_submitted: '📋', log_approved: '✅',
  log_rejected: '❌', log_flagged: '⚠️',
  geofence_repin: <img src="/icon-location.svg" alt="location" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle' }} />,
  pairing_approved: '🔗', pairing_rejected: '🚫',
}

export default function NotificationHistory() {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = (p = 1) => {
    setLoading(true)
    apiGetNotificationHistory(p).then(({ data }) => {
      setItems(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.total_pages || 1)
      setPage(p)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const handleRead = async (n) => {
    if (!n.is_read) {
      await apiMarkRead(n.id)
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notification History</h1>
          <p className="page-subtitle">{total} total notifications</p>
        </div>
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner spinner-md" /></div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔔</div>
          <div className="empty-state-title">No notifications yet</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {items.map((n, i) => (
              <div
                key={n.id}
                onClick={() => handleRead(n)}
                style={{
                  padding: '14px 20px', cursor: 'pointer',
                  borderBottom: i < items.length - 1 ? '1px solid var(--border-color)' : 'none',
                  background: n.is_read ? 'transparent' : 'rgba(46,125,50,0.05)',
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{ICONS[n.type] || '🔔'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: n.is_read ? 400 : 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
                      {n.body}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  {!n.is_read && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-green)', marginTop: 6, flexShrink: 0 }} />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pagination">
            <button className="page-btn" disabled={page <= 1} onClick={() => load(page - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i + 1} className={'page-btn' + (page === i + 1 ? ' active' : '')} onClick={() => load(i + 1)}>{i + 1}</button>
            ))}
            <button className="page-btn" disabled={page >= totalPages} onClick={() => load(page + 1)}>›</button>
          </div>
        </>
      )}
    </div>
  )
}
