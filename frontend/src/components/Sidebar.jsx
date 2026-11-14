import { useState, useEffect, useContext } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import { SidebarContext } from '../context/SidebarContext'
import {
  Home, BookOpen, PenSquare, BarChart, ClipboardList,
  Users, MapPin, Calendar, GraduationCap, Clock,
  Inbox, User, AlertTriangle, ChevronLeft, ChevronRight
, FileText } from 'lucide-react'

const INTERN_LINKS = [
  { to: '/intern/dashboard', label: 'Dashboard',  icon: <Home size={20} /> },
  { to: '/intern/logs',      label: 'My Logbook', icon: <BookOpen size={20} /> },
  { to: '/intern/logs/new',  label: 'New Entry',  icon: <PenSquare size={20} /> },
  { to: '/intern/attendance',label: 'Attendance', icon: <BarChart size={20} /> },
  { to: '/intern/weekly-summary',       label: 'Weekly Summary', icon: <FileText size={20} /> },
]
const SUPERVISOR_LINKS = [
  { to: '/supervisor/dashboard', label: 'Dashboard',        icon: <Home size={20} /> },
  { to: '/supervisor/logs',      label: 'Pending Logs',     icon: <ClipboardList size={20} /> },
  { to: '/supervisor/interns',   label: 'My Interns',       icon: <Users size={20} /> },
  { to: '/supervisor/location',  label: 'Office Location',  icon: <MapPin size={20} /> },
  { to: '/supervisor/calendar',  label: 'Non-Working Days', icon: <Calendar size={20} /> },
  { to: '/supervisor/weekly-summaries',  label: 'Weekly Summaries', icon: <FileText size={20} /> },
]
const LECTURER_LINKS = [
  { to: '/lecturer/dashboard',     label: 'Dashboard',         icon: <Home size={20} /> },
  { to: '/lecturer/interns',       label: 'My Cohort',         icon: <GraduationCap size={20} /> },
  { to: '/lecturer/pending-links', label: 'Pending Approvals', icon: <Clock size={20} /> },
  { to: '/lecturer/logs',          label: 'Cohort Logs',       icon: <ClipboardList size={20} /> },
  { to: '/lecturer/weekly-summaries',    label: 'Weekly Summaries', icon: <FileText size={20} /> },
]
const ADMIN_LINKS = [
  { to: '/admin/dashboard',   label: 'Dashboard',             icon: <Home size={20} /> },
  { to: '/admin/preregister', label: 'Pre-Register Students', icon: <Inbox size={20} /> },
  { to: '/admin/pending',     label: 'Unassigned Queue',      icon: <Clock size={20} /> },
  { to: '/admin/users',       label: 'All Users',             icon: <User size={20} /> },
  { to: '/admin/logs',        label: 'All Logs',              icon: <ClipboardList size={20} /> },
  { to: '/admin/flagged',     label: 'Flagged Logs',          icon: <AlertTriangle size={20} /> },
  { to: '/admin/weekly-summaries',       label: 'Weekly Summaries', icon: <FileText size={20} /> },
]
const ROLE_LABEL = { admin:'Administrator', lecturer:'Lecturer', supervisor:'Supervisor', intern:'Intern' }

export default function Sidebar() {
  const { user } = useAuth()
  const location = useLocation()
  const { mobileOpen, close } = useContext(SidebarContext)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true')

  useEffect(() => { localStorage.setItem('sidebar_collapsed', collapsed) }, [collapsed])
  useEffect(() => { close() }, [location.pathname])
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  if (!user) return null

  let links
  if (user.role === 'admin') {
    links = ADMIN_LINKS
  } else if (user.role === 'lecturer') {
    links = [...LECTURER_LINKS]
    if (user.is_coordinator) {
      links = [
        ...links,
        { to: '/coordinator/dashboard', label: 'School Overview',    icon: <Home size={20} /> },
        { to: '/coordinator/pending',   label: 'Pending Approvals',  icon: <Clock size={20} /> },
        { to: '/coordinator/allocate',  label: 'Allocate Interns',   icon: <Inbox size={20} /> },
        { to: '/coordinator/logs',      label: 'School Logs',        icon: <ClipboardList size={20} /> },
      ]
    }
  } else if (user.role === 'supervisor') {
    links = SUPERVISOR_LINKS
  } else {
    links = INTERN_LINKS
  }
  const roleLabel = user.role === 'lecturer' && user.is_coordinator ? 'Coordinator' : (ROLE_LABEL[user.role] ?? user.role)
  const showLabels = mobileOpen || !collapsed

  const sidebarClass = ['sidebar', collapsed && !mobileOpen ? 'collapsed' : '', mobileOpen ? 'mobile-open' : ''].filter(Boolean).join(' ')

  return (
    <>
      <div className={`sidebar-backdrop${mobileOpen ? ' visible' : ''}`} onClick={close} aria-hidden="true" />
      <aside className={sidebarClass} style={{ position: 'relative' }}>
        <button className='sidebar-toggle' onClick={() => setCollapsed(c => !c)}
          style={{ position:'absolute', right:-12, top:24, background:'#006400', border:'2px solid #FFD700',
            borderRadius:'50%', width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', zIndex:10, color:'#ffffff', boxShadow:'0 0 0 3px rgba(204,0,0,0.2)', flexShrink:0 }}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <div className='sidebar-logo'>
          <img src='/dekut-logo.png' alt='DeKUT' style={{ width:32, height:32, objectFit:'contain', flexShrink:0 }} />
          {showLabels && <span className='sidebar-logo-text'>InteLog MIS</span>}
        </div>
        <nav className='sidebar-nav' aria-label='Main navigation'>
          {showLabels && (
            <>
              <div className='sidebar-section-label'>{roleLabel}</div>
              {user.school && <div className='sidebar-section-label' style={{ fontSize:'0.7rem', opacity:0.7, marginTop:-4 }}>{user.school}</div>}
            </>
          )}
          {links.map(l => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => isActive ? 'active' : ''}
              end={l.to.endsWith('dashboard') || l.to === '/intern/logs'} title={!showLabels ? l.label : undefined}>
              <span style={{ width:24, textAlign:'center', display:'inline-flex', alignItems:'center', justifyContent:'center' }} aria-hidden='true'>{l.icon}</span>
              {showLabels && <span style={{ marginLeft:12 }}>{l.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
