import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { apiLogout, apiGetMe } from '../services/api'
import { Link2, Hourglass, BookOpen, ShieldCheck } from 'lucide-react'

export default function PendingPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await apiLogout() } catch {}
    logout()
    navigate('/login')
  }

  // Poll every 5 s — redirect as soon as account goes active
  useEffect(() => {
    if (!user) return
    const interval = setInterval(async () => {
      try {
        const { data } = await apiGetMe()
        if (data.status === 'active') window.location.reload()
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [user])

  // If somehow an active user lands here, push them to their dashboard
  useEffect(() => {
    if (user && user.status === 'active') navigate('/')
  }, [user, navigate])

  const role     = user?.role || 'intern'
  const name     = user?.full_name
  const sid      = user?.student_id
  const isWaiting = user?.status === 'waiting'

  // ── content per role / status ─────────────────────────────────────────────
  let icon, heading, body, note

  if (isWaiting) {
    // Supervisor registered but intern hasn't linked yet
    icon    = <Link2 size={56} color="var(--brand-green)" />
    heading = 'Waiting for intern to register'
    body    = <>Your supervisor account is created. The system is waiting for the intern with Student ID <strong>{sid || '—'}</strong> to register using the same Student ID. Once they register, your accounts will be linked automatically.</>
    note    = 'You will receive a notification when your account is activated.'
  } else if (role === 'lecturer') {
    // Lecturer self-registered — needs admin activation
    icon    = <BookOpen size={56} color="var(--brand-green)" />
    heading = 'Account pending admin activation'
    body    = <>Your lecturer account has been created and the university administrator has been notified. Once they verify and activate your account, you will be able to log in and access your dashboard.</>
    note    = 'This usually takes 1–2 business days. Contact the university admin office if it takes longer.'
  } else if (role === 'supervisor') {
    // Supervisor linked but pair not yet approved by lecturer
    icon    = <ShieldCheck size={56} color="var(--brand-green)" />
    heading = 'Awaiting lecturer approval'
    body    = <>Your supervisor account has been created and linked to the intern. The university lecturer has been notified and will approve the pairing shortly.</>
    note    = 'You will be notified by email and in-app once your account is activated.'
  } else {
    // Intern default
    icon    = <Hourglass size={56} color="var(--brand-green)" />
    heading = 'Account pending approval'
    body    = <>Your intern account has been created and is awaiting approval from the university lecturer.{sid && <> Your Student ID <strong>{sid}</strong> has been registered.</>}</>
    note    = 'You will receive a notification once your account is activated. If you have been waiting a while, please contact your supervisor or the university.'
  }

  return (
    <div className="pending-page">
      <div className="card pending-card">

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          {icon}
        </div>

        <h2 style={{ marginBottom: 10, color: 'var(--text-primary)' }}>{heading}</h2>

        {name && (
          <p style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 10 }}>
            Hi, {name} 👋
          </p>
        )}

        <p style={{ color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
          {body}
        </p>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 28 }}>
          {note}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
          <span className="spinner spinner-sm" style={{ borderTopColor: 'var(--brand-green)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Checking status automatically…</span>
        </div>

        <button className="btn btn-secondary" onClick={handleLogout}>
          Sign Out
        </button>

      </div>
    </div>
  )
}