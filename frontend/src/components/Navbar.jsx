import { useState, useContext } from 'react'
import { useAuth, useTheme } from '../App'
import { useNavigate } from 'react-router-dom'
import { apiLogout } from '../services/api'
import { useToast } from './Toast'
import NotificationBell from './NotificationBell'
import ProfileDrawer from './ProfileDrawer'
import { Moon, Sun, User, Menu } from 'lucide-react'
import { SidebarContext } from '../context/SidebarContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [showProfile, setShowProfile] = useState(false)
  const { toggle: toggleSidebar } = useContext(SidebarContext)

  const handleLogout = async () => {
    try { await apiLogout() } catch {}
    logout()
    navigate('/login')
    showToast('Logged out successfully', 'success')
  }

  const avatarSrc = user?.avatar_path
    ? `/api/uploads/avatars/${user.avatar_path.split(/[\\/]/).pop()}`
    : user?.avatar_url || null

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
          {user && (
            <button
              className="navbar-hamburger"
              onClick={toggleSidebar}
              aria-label="Toggle navigation"
            >
              <Menu size={22} />
            </button>
          )}
          <img src="/dekut-logo.png" alt="DeKUT Logo"
            style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }} />
          <span className="navbar-brand-text" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--brand-gold)' }}>
            InteLog{' '}
            <span className="navbar-brand-sub" style={{ color: 'var(--text-primary)', fontWeight: 400 }}>
              | DeKUT MIS
            </span>
          </span>
        </div>

        <div className="navbar-right">
          {user && <NotificationBell />}
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
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
                background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)',
              }}>
                {avatarSrc
                  ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <User size={16} />}
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
