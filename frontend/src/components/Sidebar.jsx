import { NavLink } from 'react-router-dom'
import { useAuth } from '../App'

const INTERN_LINKS = [
  { to: '/intern/dashboard', label: 'Dashboard',   icon: '🏠' },
  { to: '/intern/logs',      label: 'My Logbook',  icon: '📖' },
  { to: '/intern/logs/new',  label: 'New Entry',   icon: '✏️'  },
  { to: '/intern/attendance',label: 'Attendance',  icon: '📊' },
]

const SUPERVISOR_LINKS = [
  { to: '/supervisor/dashboard', label: 'Dashboard',          icon: '🏠' },
  { to: '/supervisor/logs',      label: 'Pending Logs',       icon: '📋' },
  { to: '/supervisor/interns',   label: 'My Interns',         icon: '👥' },
  { to: '/supervisor/location',  label: 'Office Location',    icon: { svg: '/icon-location.svg' } },
  { to: '/supervisor/calendar',  label: 'Non-Working Days',   icon: '📅' },
]

const LECTURER_LINKS = [
  { to: '/lecturer/dashboard',     label: 'Dashboard',         icon: '🏠' },
  { to: '/lecturer/interns',       label: 'My Cohort',         icon: '🎓' },
  { to: '/lecturer/pending-links', label: 'Pending Approvals', icon: '⏳' },
  { to: '/lecturer/logs',          label: 'Cohort Logs',       icon: '📋' },
]

const ADMIN_LINKS = [
  { to: '/admin/dashboard',    label: 'Dashboard',             icon: '🏠' },
  { to: '/admin/preregister',  label: 'Pre-Register Students', icon: '📥' },
  { to: '/admin/pending',      label: 'Unassigned Queue',      icon: '⏳' },
  { to: '/admin/users',        label: 'All Users',             icon: '👤' },
  { to: '/admin/logs',         label: 'All Logs',              icon: '📋' },
  { to: '/admin/flagged',      label: 'Flagged Logs',          icon: '⚠️' },
]

const ROLE_LABEL = {
  admin:      'Administrator',
  lecturer:   'Lecturer',
  supervisor: 'Supervisor',
  intern:     'Intern',
}

export default function Sidebar() {
  const { user } = useAuth()
  if (!user) return null

  const links =
    user.role === 'admin'      ? ADMIN_LINKS :
    user.role === 'lecturer'   ? LECTURER_LINKS :
    user.role === 'supervisor' ? SUPERVISOR_LINKS :
    INTERN_LINKS

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img
          src="/dekut-logo.png"
          alt="DeKUT"
          style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }}
        />
        <span className="sidebar-logo-text">InteLog MIS</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <div className="sidebar-section-label">{ROLE_LABEL[user.role] ?? user.role}</div>
        {user.school && (
          <div className="sidebar-section-label" style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: -4 }}>
            {user.school}
          </div>
        )}
        {links.map(l => (
          <NavLink
            key={l.to} to={l.to}
            className={({ isActive }) => isActive ? 'active' : ''}
            end={l.to.endsWith('dashboard')}
          >
            <span style={{ width: 22, textAlign: 'center', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
              {l.icon?.svg
                ? <img src={l.icon.svg} alt="" style={{ width: 18, height: 18 }} />
                : l.icon}
            </span>
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
