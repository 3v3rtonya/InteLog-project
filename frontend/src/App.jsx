import { createContext, useContext, useState, useEffect, useCallback, Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { setToken, setLogoutHandler, apiGetMe } from './services/api'

// ── Theme Context ──────────────────────────────────────────────────────────
const ThemeContext = createContext(null)
export const useTheme = () => useContext(ThemeContext)

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])
  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

// ── Auth Context ───────────────────────────────────────────────────────────
const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => { setToken(null); setUser(null) }, [])

  useEffect(() => {
    setLogoutHandler(logout)
    const token = sessionStorage.getItem('access_token')
    if (token) {
      setToken(token)
      apiGetMe()
        .then(r => setUser(r.data))
        .catch(() => { setToken(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [logout])

  const login = useCallback((data) => {
    // data.access_token may be null when only refreshing user object
    if (data.access_token) setToken(data.access_token)
    if (data.user) setUser(data.user)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Protected Route ────────────────────────────────────────────────────────
function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="spinner-center"><div className="spinner spinner-lg" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (user.status === 'suspended') return <Navigate to="/login" replace />
  if (user.status === 'shell') return <Navigate to="/login" replace />
  // pending/waiting users always go to holding page
  if (user.status === 'pending' || user.status === 'waiting') return <Navigate to="/pending" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

// ── Root redirect ──────────────────────────────────────────────────────────
function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <div className="spinner-center"><div className="spinner spinner-lg" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (user.status === 'pending' || user.status === 'waiting') return <Navigate to="/pending" replace />
  if (user.status === 'suspended') return <Navigate to="/login" replace />
  if (user.status === 'shell') return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (user.role === 'supervisor') return <Navigate to="/supervisor/dashboard" replace />
  if (user.role === 'lecturer') return <Navigate to="/lecturer/dashboard" replace />
  return <Navigate to="/intern/dashboard" replace />
}

// ── Error Boundary ─────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <h2 style={{ color: '#EF4444', marginBottom: 8 }}>Something went wrong</h2>
          <pre style={{ fontSize: '0.8rem', color: '#718096', whiteSpace: 'pre-wrap', marginBottom: 16 }}>
            {this.state.error?.message}
          </pre>
          <button className="btn btn-primary" onClick={() => { this.setState({ error: null }); window.location.href = '/' }}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Imports ────────────────────────────────────────────────────────────────
import AuthPage from './components/AuthPage'
import PendingPage from './components/PendingPage'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import { ToastProvider } from './components/Toast'
import ResetPasswordPage from './components/ResetPasswordPage'
import NotificationHistory from './components/NotificationHistory'

import InternDashboard from './components/InternDashboard'
import LogbookList from './components/LogbookList'
import LogbookEntryForm from './components/LogbookEntryForm'
import LogbookDetail from './components/LogbookDetail'
import InternAttendancePage from './components/InternAttendancePage'

import SupervisorDashboard from './components/SupervisorDashboard'
import PendingLogsList from './components/PendingLogsList'
import InternManagement from './components/InternManagement'
import GeofencePin from './components/GeofencePin'

import AdminDashboard from './components/AdminDashboard'
import PendingRequestsList from './components/PendingRequestsList'
import UserManagement from './components/UserManagement'
import FlaggedLogsList from './components/FlaggedLogsList'
import AdminLogsView from './components/AdminLogsView'
import HolidayManager from './components/HolidayManager'
import PreRegisterPage from './components/PreRegisterPage'

import LecturerDashboard from './components/LecturerDashboard'
import LecturerInternList from './components/LecturerInternList'
import LecturerPendingLinks from './components/LecturerPendingLinks'
import LecturerLogsView from './components/LecturerLogsView'

// ── Authenticated layout ───────────────────────────────────────────────────
function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <main className="page-content">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<AuthPage />} />
              {/* All roles use the single /login route */}
              <Route path="/supervisor/login" element={<Navigate to="/login" replace />} />
              <Route path="/admin/login" element={<Navigate to="/login" replace />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/pending" element={<ProtectedRoute><PendingPage /></ProtectedRoute>} />

              {/* Shared — all authenticated roles */}
              <Route path="/notifications" element={<ProtectedRoute><AppLayout><NotificationHistory /></AppLayout></ProtectedRoute>} />

              {/* Intern */}
              <Route path="/intern/dashboard" element={<ProtectedRoute roles={['intern']}><AppLayout><InternDashboard /></AppLayout></ProtectedRoute>} />
              <Route path="/intern/logs" element={<ProtectedRoute roles={['intern']}><AppLayout><LogbookList /></AppLayout></ProtectedRoute>} />
              <Route path="/intern/logs/new" element={<ProtectedRoute roles={['intern']}><AppLayout><LogbookEntryForm /></AppLayout></ProtectedRoute>} />
              <Route path="/intern/logs/:id" element={<ProtectedRoute roles={['intern']}><AppLayout><LogbookDetail /></AppLayout></ProtectedRoute>} />
              <Route path="/intern/attendance" element={<ProtectedRoute roles={['intern']}><AppLayout><InternAttendancePage /></AppLayout></ProtectedRoute>} />

              {/* Supervisor */}
              <Route path="/supervisor/dashboard" element={<ProtectedRoute roles={['supervisor']}><AppLayout><SupervisorDashboard /></AppLayout></ProtectedRoute>} />
              <Route path="/supervisor/logs" element={<ProtectedRoute roles={['supervisor']}><AppLayout><PendingLogsList /></AppLayout></ProtectedRoute>} />
              <Route path="/supervisor/interns" element={<ProtectedRoute roles={['supervisor']}><AppLayout><InternManagement /></AppLayout></ProtectedRoute>} />
              <Route path="/supervisor/location" element={<ProtectedRoute roles={['supervisor']}><AppLayout><GeofencePin /></AppLayout></ProtectedRoute>} />
              <Route path="/supervisor/calendar" element={<ProtectedRoute roles={['supervisor']}><AppLayout><HolidayManager /></AppLayout></ProtectedRoute>} />

              {/* Admin */}
              <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin']}><AppLayout><AdminDashboard /></AppLayout></ProtectedRoute>} />
              <Route path="/admin/pending" element={<ProtectedRoute roles={['admin']}><AppLayout><PendingRequestsList /></AppLayout></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AppLayout><UserManagement /></AppLayout></ProtectedRoute>} />
              <Route path="/admin/flagged" element={<ProtectedRoute roles={['admin']}><AppLayout><FlaggedLogsList /></AppLayout></ProtectedRoute>} />
              <Route path="/admin/logs" element={<ProtectedRoute roles={['admin']}><AppLayout><AdminLogsView /></AppLayout></ProtectedRoute>} />
              <Route path="/admin/preregister" element={<ProtectedRoute roles={['admin']}><AppLayout><PreRegisterPage /></AppLayout></ProtectedRoute>} />

              {/* Lecturer */}
              <Route path="/lecturer/dashboard" element={<ProtectedRoute roles={['lecturer']}><AppLayout><LecturerDashboard /></AppLayout></ProtectedRoute>} />
              <Route path="/lecturer/interns" element={<ProtectedRoute roles={['lecturer']}><AppLayout><LecturerInternList /></AppLayout></ProtectedRoute>} />
              <Route path="/lecturer/pending-links" element={<ProtectedRoute roles={['lecturer']}><AppLayout><LecturerPendingLinks /></AppLayout></ProtectedRoute>} />
              <Route path="/lecturer/logs" element={<ProtectedRoute roles={['lecturer']}><AppLayout><LecturerLogsView /></AppLayout></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
