import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import {
  apiGetUsers, apiUpdateUser, apiDeleteUser, apiApproveUser,
  apiCreateUser, apiPromoteCoordinator, apiDemoteCoordinator,
} from '../services/api'
import { useToast } from './Toast'
import StatusBadge from './StatusBadge'
import ConfirmDialog from './ConfirmDialog'

const STATUSES  = ['pending', 'active', 'suspended', 'waiting']
const ROLES     = ['intern', 'supervisor', 'lecturer', 'admin']
const SYSTEM_ADMIN = 'admin@mis.local'

//  small helper 
function Field({ label, children }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

//  Create Lecturer modal 

//  Promote Coordinator modal 
function PromoteCoordinatorModal({ onClose, onCreated }) {
  const { showToast } = useToast()
  const [lecturers, setLecturers] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    apiGetUsers({ role: 'lecturer', status: 'active', page_size: 100 })
      .then(r => setLecturers(r.data.items || []))
      .catch(() => showToast('Failed to load lecturers', 'error'))
      .finally(() => setFetching(false))
  }, [])

  const selected = lecturers.find(l => l.id === selectedId)

  const handlePromote = async () => {
    if (!selectedId) { showToast('Select a lecturer first', 'error'); return }
    setLoading(true)
    try {
      await apiPromoteCoordinator(selectedId)
      showToast(`${selected?.full_name} promoted to Coordinator`, 'success')
      onCreated()
      onClose()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Promotion failed', 'error')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Promote Lecturer to Coordinator</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"></button>
        </div>
        <div className="alert alert-info" style={{marginBottom: 12, fontSize: '0.82rem'}}>
          Coordinators deputize the admin — they can approve accounts, manage users in their school, and allocate interns. Role stays &quot;Lecturer&quot;.
        </div>
        {fetching ? (
          <div className="spinner" style={{margin: '24px auto'}} />
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Select Active Lecturer</label>
              <select
                className="form-select"
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
              >
                <option value="">-- choose a lecturer --</option>
                {lecturers.filter(l => !l.is_coordinator).map(l => (
                  <option key={l.id} value={l.id}>{l.full_name} — {l.school || 'No school'}</option>
                ))}
              </select>
            </div>
            {selected && (
              <div className="card" style={{padding: '12px 16px', marginBottom: 12, fontSize: '0.85rem'}}>
                <div><strong>Name:</strong> {selected.full_name}</div>
                <div><strong>Email:</strong> {selected.email}</div>
                <div><strong>School:</strong> {selected.school || '—'}</div>
                <div><strong>Department:</strong> {selected.department || '—'}</div>
              </div>
            )}
          </>
        )}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handlePromote} disabled={loading || !selectedId}>
            {loading ? 'Promoting…' : 'Promote to Coordinator'}
          </button>
        </div>
      </div>
    </div>
  )
}

//  Main component 
export default function UserManagement() {
  const { showToast } = useToast()
  const { user: currentUser } = useAuth()
  const [users, setUsers]           = useState([])
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [filters, setFilters]       = useState({ role: '', status: '', search: '' })

  const [editModal, setEditModal]         = useState(null)  // { user }
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
      .catch(() => {})
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

  const handleApprove = async (userId, userName) => {
    try {
      await apiApproveUser(userId)
      showToast(userName + ' approved and activated', 'success')
      load(page)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Approval failed', 'error')
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

  const handlePromoteCoordinator = async (id, name) => {
    if (!window.confirm(`Promote ${name} to Coordinator?`)) return
    try {
      await apiPromoteCoordinator(id)
      showToast(`${name} promoted to Coordinator`, 'success')
      load(page)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Promotion failed', 'error')
    }
  }

  const handleDemoteCoordinator = async (id, name) => {
    if (!window.confirm(`Remove Coordinator privileges from ${name}?`)) return
    try {
      await apiDemoteCoordinator(id)
      showToast(`${name} is no longer a Coordinator`, 'success')
      load(page)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Demotion failed', 'error')
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
          <button className="btn btn-secondary btn-sm" onClick={() => setCreateAdmin(true)}>
            + New Coordinator
          </button>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 16, fontSize: '0.85rem' }}>
        Manage all user accounts. Promote active lecturers to Coordinators — they gain elevated privileges scoped to their school: approving accounts, managing users, and allocating interns. Role stays &quot;Lecturer&quot;.
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input
          className="form-input" placeholder="Search name or email..."
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
                  <td>
                    <StatusBadge status={u.role} />
                    {u.role === 'lecturer' && u.is_coordinator && (
                      <span className="badge" style={{background: '#B7791F', color: '#fff', marginLeft: 4}}>Coordinator</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {u.school
                      ? <><div>{u.school}</div><div style={{ color: 'var(--text-muted)' }}>{u.department}</div></>
                      : <span style={{ color: 'var(--text-muted)' }}>"</span>
                    }
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.student_id || '"'}</td>
                  <td><StatusBadge status={u.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(u.status === 'pending' || u.status === 'waiting') && (
                        <button className="btn btn-sm" style={{ background: '#16a34a', color: '#fff' }}
                          onClick={() => handleApprove(u.id, u.full_name)}>
                          Approve
                        </button>
                      )}
                      {u.role === 'lecturer' && u.status === 'active' && !u.is_coordinator && (
                        <button
                          className="btn btn-xs btn-outline"
                          title="Promote to Coordinator"
                          onClick={() => handlePromoteCoordinator(u.id, u.full_name)}
                        >Promote</button>
                      )}
                      {u.role === 'lecturer' && u.is_coordinator && (
                        <button
                          className="btn btn-xs btn-danger"
                          title="Remove Coordinator"
                          onClick={() => handleDemoteCoordinator(u.id, u.full_name)}
                        >Remove Coord.</button>
                      )}
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>Edit</button>
                      {u.email !== SYSTEM_ADMIN && u.id !== currentUser?.id && (
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(u.id)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => load(page - 1)}>  Prev</button>
              <span style={{ lineHeight: '2rem', fontSize: '0.875rem' }}>Page {page} / {totalPages}</span>
              <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next  </button>
            </div>
          )}
        </div>
      )}

      {/*  Edit modal  */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit " {editModal.user.full_name}</h3>
              <button className="modal-close" onClick={() => setEditModal(null)}></button>
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

      {/*  Create modals  */}

      {createAdmin && (
        <PromoteCoordinatorModal
          onClose={() => setCreateAdmin(false)}
          onCreated={() => load(1)}
        />
      )}

      {/* -- Delete confirm --------------------------------------------------- */}
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
