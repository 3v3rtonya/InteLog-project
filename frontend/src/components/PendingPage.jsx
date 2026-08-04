import { useAuth } from '../App'
import { useNavigate } from 'react-router-dom'
import { apiLogout } from '../services/api'

export default function PendingPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await apiLogout() } catch {}
    logout()
    navigate('/login')
  }

  // Supervisor waiting for intern to register
  const isWaiting = user?.status === 'waiting'

  return (
    <div className="pending-page">
      <div className="card pending-card">
        <div className="pending-icon">{isWaiting ? '🔗' : '⏳'}</div>

        {isWaiting ? (
          <>
            <h2 style={{ marginBottom: 8 }}>Waiting for Intern to Register</h2>
            {user?.full_name && (
              <p style={{ color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
                Hi, {user.full_name}
              </p>
            )}
            <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
              Your supervisor account has been created. The system is waiting for the intern with
              Student ID <strong>{user?.student_id || '—'}</strong> to register.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 24 }}>
              Once the intern registers, both accounts will be automatically linked and sent to the
              university lecturer for approval. You will receive a notification when your account is activated.
            </p>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: 8 }}>Your account is pending approval</h2>
            {user?.full_name && (
              <p style={{ color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
                Hi, {user.full_name}
              </p>
            )}
            <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
              Your account has been created and is awaiting approval from the university lecturer.
              {user?.student_id && (
                <> Your Student ID <strong>{user.student_id}</strong> has been registered.</>
              )}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 24 }}>
              You will receive a notification once your account is activated.
              If you have been waiting for a while, please contact your supervisor or the university.
            </p>
          </>
        )}

        <button className="btn btn-secondary" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
