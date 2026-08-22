import { useState } from 'react'
import { useAuth, useTheme } from '../App'
import { useNavigate } from 'react-router-dom'
import { apiLogout } from '../services/api'
import { useToast } from './Toast'
import NotificationBell from './NotificationBell'
import ProfileDrawer from './ProfileDrawer'
import { Moon, Sun, User } from 'lucide-react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [showProfile, setShowProfile] = useState(false)

  const handleLogout = async () => {
    try { await apiLogout() } catch {}
    logout()
    navigate('/login')
    showToast('Logged out successfully', 'info')
  }

  const avatarSrc = user?.avatar_path
    ? `/api/uploads/avatars/${user.avatar_path.split(/[\\/]/).pop()}`
    : user?.avatar_url || null

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
          <img
            src="/dekut-logo.png"
            alt="DeKUT Logo"
            style={{ width: 36, height: 36, objectFit: 'contain' }}
          />
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--brand-gold)' }}>
            InteLog <span style={{ color: 'var(--text-primary)', fontWeight: 400 }}>| DeKUT MIS</span>
          </span>
        </div>

        <div className="navbar-right">
          {/* Notification bell */}
          {user && <NotificationBell />}

          {/* Theme toggle */}
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* Profile avatar / name */}
          {user && (
            <button
              onClick={() => setShowProfile(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius)', padding: '4px 10px',
                cursor: 'pointer', color: 'var(--text-primary)',
              }}
              title="Profile settings"
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%', overflow: 'hidden',
                background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--text-muted)'
              }}>
                {avatarSrc
                  ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <User size={16} />
                }
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.full_name?.split(' ')[0]}
              </span>
              <span className={`badge badge-${user.role}`} style={{ fontSize: '0.7rem' }}>{user.role}</span>
            </button>
          )}

          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      {showProfile && <ProfileDrawer onClose={() => setShowProfile(false)} />}
    </>
  )
}
