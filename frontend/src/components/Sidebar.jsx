import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../App'
import { 
  Home, BookOpen, PenSquare, BarChart, ClipboardList, 
  Users, MapPin, Calendar, GraduationCap, Clock, 
  Inbox, User, AlertTriangle, ChevronLeft, ChevronRight 
} from 'lucide-react'

const INTERN_LINKS = [
  { to: '/intern/dashboard', label: 'Dashboard',   icon: <Home size={20} /> },
  { to: '/intern/logs',      label: 'My Logbook',  icon: <BookOpen size={20} /> },
  { to: '/intern/logs/new',  label: 'New Entry',   icon: <PenSquare size={20} />  },
  { to: '/intern/attendance',label: 'Attendance',  icon: <BarChart size={20} /> },
]

const SUPERVISOR_LINKS = [
  { to: '/supervisor/dashboard', label: 'Dashboard',          icon: <Home size={20} /> },
  { to: '/supervisor/logs',      label: 'Pending Logs',       icon: <ClipboardList size={20} /> },
  { to: '/supervisor/interns',   label: 'My Interns',         icon: <Users size={20} /> },
  { to: '/supervisor/location',  label: 'Office Location',    icon: <MapPin size={20} /> },
  { to: '/supervisor/calendar',  label: 'Non-Working Days',   icon: <Calendar size={20} /> },
]

const LECTURER_LINKS = [
  { to: '/lecturer/dashboard',     label: 'Dashboard',         icon: <Home size={20} /> },
  { to: '/lecturer/interns',       label: 'My Cohort',         icon: <GraduationCap size={20} /> },
  { to: '/lecturer/pending-links', label: 'Pending Approvals', icon: <Clock size={20} /> },
  { to: '/lecturer/logs',          label: 'Cohort Logs',       icon: <ClipboardList size={20} /> },
]

const ADMIN_LINKS = [
  { to: '/admin/dashboard',    label: 'Dashboard',             icon: <Home size={20} /> },
  { to: '/admin/preregister',  label: 'Pre-Register Students', icon: <Inbox size={20} /> },
  { to: '/admin/pending',      label: 'Unassigned Queue',      icon: <Clock size={20} /> },
  { to: '/admin/users',        label: 'All Users',             icon: <User size={20} /> },
  { to: '/admin/logs',         label: 'All Logs',              icon: <ClipboardList size={20} /> },
  { to: '/admin/flagged',      label: 'Flagged Logs',          icon: <AlertTriangle size={20} /> },
]

const ROLE_LABEL = {
  admin:      'Administrator',
  lecturer:   'Lecturer',
  supervisor: 'Supervisor',
  intern:     'Intern',
}

export default function Sidebar() {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true')

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', collapsed)
  }, [collapsed])

  if (!user) return null

  const links =
    user.role === 'admin'      ? ADMIN_LINKS :
    user.role === 'lecturer'   ? LECTURER_LINKS :
    user.role === 'supervisor' ? SUPERVISOR_LINKS :
    INTERN_LINKS

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} style={{ position: 'relative' }}>
      <button 
        className="sidebar-toggle" 
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'absolute',
          right: -12,
          top: 24,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '50%',
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10
        }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="sidebar-logo">
        <img
          src="/dekut-logo.png"
          alt="DeKUT"
          style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }}
        />
        {!collapsed && <span className="sidebar-logo-text">InteLog MIS</span>}
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {!collapsed && (
          <>
            <div className="sidebar-section-label">{ROLE_LABEL[user.role] ?? user.role}</div>
            {user.school && (
              <div className="sidebar-section-label" style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: -4 }}>
                {user.school}
              </div>
            )}
          </>
        )}
        
        {links.map(l => (
          <NavLink
            key={l.to} to={l.to}
            className={({ isActive }) => isActive ? 'active' : ''}
            end={l.to.endsWith('dashboard')}
            title={collapsed ? l.label : undefined}
          >
            <span style={{ width: 24, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
              {l.icon}
            </span>
            {!collapsed && <span style={{ marginLeft: 12 }}>{l.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
