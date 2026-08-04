import { useState, useEffect } from 'react'
import {
  apiGetUsers, apiUpdateUser, apiDeleteUser,
  apiCreateLecturer, apiCreateUser,
} from '../services/api'
import { useToast } from './Toast'
import StatusBadge from './StatusBadge'
import ConfirmDialog from './ConfirmDialog'

const STATUSES  = ['pending', 'active', 'suspended', 'waiting']
const ROLES     = ['intern', 'supervisor', 'lecturer', 'admin']

// ── small helper ──────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

// ── Create Lecturer modal ─────────────────────────────────────────────────
function CreateLecturerModal({ onClose, onCreated }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '', school: '', department: '',
  })
  const [loading, setLoading] = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.password || !form.school || !form.department) {
      showToast('All fields except phone are required', 'error'); return
    }
    setLoading(true)
    try {
      await apiCreateLecturer(form)
      showToast(`Lecturer ${form.full_name} created`, 'success')
      onCreated()
      onClose()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Creation failed', 'error')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Create Lecturer Account</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="alert alert-info" style={{ marginBottom: 12, fontSize: '0.82rem' }}>
          The lecturer will log in using these credentials. Share the password securely.
        </div>

        <Field label="Full Name *">
          <input className="form-input" value={form.full_name} onChange={set('full_name')} placeholder="Dr. Jane Mwangi" />
        </Field>
        <Field label="Email *">
          <input className="form-input" type="email" value={form.email} onChange={set('email')} placeholder="j.mwangi@dkut.ac.ke" />
        </Field>
        <Field label="Phone (optional)">
          <input className="form-input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+254712345678" />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="School *">
            <input className="form-input" value={form.school} onChange={set('school')} placeholder="School of Engineering" />
          </Field>
          <Field label="Department *">
            <input className="form-input" value={form.department} onChange={set('department')} placeholder="Software Engineering" />
          </Field>
        </div>

        <Field label="Temporary Password *">
          <input className="form-input" type="password" value={form.password} onChange={set('password')} placeholder="Min 8 chars, uppercase + number + symbol" />
        </Field>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="spinner spinner-sm" /> : '+ Create Lecturer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create Admin modal ────────────────────────────────────────────────────
function CreateAdminModal({ onClose, onCreated }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })
  const [loading, setLoading] = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.password) {
      showToast('Name, email and password are required', 'error'); return
    }
    setLoading(true)
    try {
      await apiCreateUser({ ...form, role: 'admin' })
      showToast(`Admin ${form.full_name} created`, 'success')
      onCreated()
      onClose()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Creation failed', 'error')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Create Admin Account</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <Field label="Full Name *">
          <input className="form-input" value={form.full_name} onChange={set('full_name')} placeholder="Admin Name" />
        </Field>
        <Field label="Email *">
          <input className="form-input" type="email" value={form.email} onChange={set('email')} placeholder="admin@dkut.ac.ke" />
        </Field>
        <Field label="Phone (optional)">
          <input className="form-input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+254712345678" />
        </Field>
        <Field label="Temporary Password *">
          <input className="form-input" type="password" value={form.password} onChange={set('password')} placeholder="Min 8 chars, uppercase + number + symbol" />
        </Field>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="spinner spinner-sm" /> : '+ Create Admin'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function UserManagement() {
  const { showToast } = useToast()
  const [users, setUsers]           = useState([])
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [filters, setFilters]       = useState({ role: '', status: '', search: '' })

  const [editModal, setEditModal]         = useState(null)  // { user }
  const [createLecturer, setCreateLecturer] = useState(false)
  const [createAdmin, setCreateAdmin]     = useState(false)
  const [deleteId, setDeleteId]           = useState(null)

  const [editForm, setEditForm] = useState({
    full_name: '', phone: '', status: 'active', school: '', department: '',
  })

  const load = (p = 1) => {
    setLoading(true)
    const params = {
      page: p, page_size: 20,
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    }
    apiGetUsers(params)
      .then(({ data }) => {
        setUsers(data.items || [])
        setTotal(data.total || 0)
        setTotalPages(data.total_pages || 1)
        setPage(p)
      })
      .catch(() => showToast('Failed to load users', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [filters])

  const openEdit = (user) => {
    setEditForm({
      full_name:  user.full_name,
      phone:      user.phone || '',
      status:     user.status,
      school:     user.school || '',
      department: user.department || '',
    })
    setEditModal({ user })
  }

  const handleSave = async () => {
    try {
      await apiUpdateUser(editModal.user.id, {
        full_name:  editForm.full_name,
        phone:      editForm.phone || null,
        status:     editForm.status,
        school:     editForm.school || null,
        department: editForm.department || null,
      })
      showToast('User updated', 'success')
      setEditModal(null)
      load(page)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Save failed', 'error')
    }
  }

  const handleDelete = async () => {
    try {
      await apiDeleteUser(deleteId)
      showToast('User deleted', 'success')
      setDeleteId(null)
      load(page)
    } catch {
      showToast('Delete failed', 'error')
    }
  }

  const setFilter = k => e => setFilters(f => ({ ...f, [k]: e.target.value }))

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{total} total users</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setCreateLecturer(true)}>
            + New Lecturer
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setCreateAdmin(true)}>
            + New Admin
          </button>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 16, fontSize: '0.85rem' }}>
        ℹ️ Interns and supervisors self-register via the <strong>Sign Up</strong> page using
        their DeKUT Student ID. They appear here after registration and join the unassigned queue.
        Lecturers and admins are created directly by you above.
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input
          className="form-input" placeholder="Search name or email…"
          value={filters.search} onChange={setFilter('search')}
          style={{ flex: 1 }}
        />
        <select className="form-input" style={{ width: 'auto' }} value={filters.role} onChange={setFilter('role')}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filters.status} onChange={setFilter('status')}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-outline btn-sm" onClick={() => setFilters({ role: '', status: '', search: '' })}>
          Clear
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="spinner-center"><div className="spinner spinner-md" /></div>
      ) : users.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--text-muted)' }}>No users found.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>School / Dept</th>
                <th>Student ID</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.full_name}</strong></td>
                  <td style={{ fontSize: '0.85rem' }}>{u.email}</td>
                  <td><StatusBadge status={u.role} /></td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {u.school
                      ? <><div>{u.school}</div><div style={{ color: 'var(--text-muted)' }}>{u.department}</div></>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    }
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.student_id || '—'}</td>
                  <td><StatusBadge status={u.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(u.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => load(page - 1)}>← Prev</button>
              <span style={{ lineHeight: '2rem', fontSize: '0.875rem' }}>Page {page} / {totalPages}</span>
              <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────── */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit — {editModal.user.full_name}</h3>
              <button className="modal-close" onClick={() => setEditModal(null)}>×</button>
            </div>

            <Field label="Full Name">
              <input className="form-input" value={editForm.full_name}
                onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
            </Field>
            <Field label="Phone">
              <input className="form-input" value={editForm.phone}
                onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="School">
                <input className="form-input" value={editForm.school}
                  onChange={e => setEditForm(f => ({ ...f, school: e.target.value }))}
                  placeholder="e.g. School of Engineering" />
              </Field>
              <Field label="Department">
                <input className="form-input" value={editForm.department}
                  onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}
                  placeholder="e.g. Software Engineering" />
              </Field>
            </div>

            <Field label="Status">
              <select className="form-input" value={editForm.status}
                onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create modals ────────────────────────────────────────────────── */}
      {createLecturer && (
        <CreateLecturerModal
          onClose={() => setCreateLecturer(false)}
          onCreated={() => load(1)}
        />
      )}

      {createAdmin && (
        <CreateAdminModal
          onClose={() => setCreateAdmin(false)}
          onCreated={() => load(1)}
        />
      )}

      {/* ── Delete confirm ───────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete User"
        message="This will permanently delete the user. Their logbook entries will be retained."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
