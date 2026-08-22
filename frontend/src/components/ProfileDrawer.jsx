import { useState, useRef } from 'react'
import { useAuth } from '../App'
import { apiUpdateProfile, apiUploadAvatar, apiChangePassword } from '../services/api'
import { useToast } from './Toast'
import { User, Pencil } from 'lucide-react'

export default function ProfileDrawer({ onClose }) {
  const { user, login } = useAuth()
  const { showToast } = useToast()
  const fileRef = useRef()

  const [tab, setTab] = useState('profile') // profile | password
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm: '' })
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const avatarSrc = avatarPreview
    || (user?.avatar_path ? `/api/uploads/avatars/${user.avatar_path.split(/[\\/]/).pop()}` : null)
    || user?.avatar_url
    || null

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Only JPEG, PNG, or WebP images allowed', 'error'); return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be ≤ 5MB', 'error'); return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const saveProfile = async () => {
    setSaving(true)
    setErrors({})
    try {
      // Upload avatar first if changed
      if (avatarFile) {
        const { data: avatarData } = await apiUploadAvatar(avatarFile)
        login({ access_token: null, user: avatarData })
      }
      // Update profile fields
      const { data } = await apiUpdateProfile({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
      })
      // Refresh user in context — keep existing token
      const token = sessionStorage.getItem('access_token')
      login({ access_token: token, user: data })
      showToast('Profile updated successfully', 'success')
      setAvatarFile(null)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') showToast(detail, 'error')
      else showToast('Failed to update profile', 'error')
    } finally { setSaving(false) }
  }

  const savePassword = async () => {
    setErrors({})
    if (passwords.new_password !== passwords.confirm) {
      setErrors({ confirm: 'Passwords do not match' }); return
    }
    setSaving(true)
    try {
      await apiChangePassword({
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      })
      showToast('Password changed successfully', 'success')
      setPasswords({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to change password'
      showToast(detail, 'error')
    } finally { setSaving(false) }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 900, transition: 'opacity 0.2s',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
        background: 'var(--bg-card)', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        zIndex: 901, display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Profile Settings
          </h2>
          <button className="modal-close" onClick={onClose} style={{ fontSize: '1.4rem' }}>×</button>
        </div>

        {/* Avatar section */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
              border: '3px solid var(--accent)', margin: '0 auto',
              background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {avatarSrc ? (
                <img src={avatarSrc} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={40} color="var(--text-muted)" />
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                position: 'absolute', bottom: 0, right: 0,
                background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: '50%', width: 26, height: 26, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem',
              }}
              title="Change photo"
            >
              <Pencil size={14} />
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
          <div style={{ marginTop: 8, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.full_name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span className={`badge badge-${user?.role}`}>{user?.role}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="auth-tabs" style={{ margin: '0 24px' }}>
          <button className={'auth-tab' + (tab === 'profile' ? ' active' : '')} onClick={() => setTab('profile')}>
            Profile Info
          </button>
          <button className={'auth-tab' + (tab === 'password' ? ' active' : '')} onClick={() => setTab('password')}>
            Change Password
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {tab === 'profile' && (
            <>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="form-input" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254712345678" />
              </div>
              {user?.student_id && (
                <div className="form-group">
                  <label className="form-label">Student ID</label>
                  <input className="form-input" value={user.student_id} disabled style={{ opacity: 0.6 }} />
                  <span className="form-hint">Student ID cannot be changed. Contact admin if incorrect.</span>
                </div>
              )}
            </>
          )}

          {tab === 'password' && (
            <>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input className="form-input" type="password" value={passwords.current_password} onChange={e => setPasswords(p => ({ ...p, current_password: e.target.value }))} placeholder="Enter current password" />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" value={passwords.new_password} onChange={e => setPasswords(p => ({ ...p, new_password: e.target.value }))} placeholder="Min 8 chars, uppercase, number, special" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input className="form-input" type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} placeholder="Repeat new password" />
                {errors.confirm && <span className="form-error">{errors.confirm}</span>}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={tab === 'profile' ? saveProfile : savePassword}
            disabled={saving}
          >
            {saving ? <span className="spinner spinner-sm" /> : 'Save Changes'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}
