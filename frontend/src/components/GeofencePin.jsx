import { useState, useEffect } from 'react'
import { apiGetMyGeofence, apiPinGeofence } from '../services/api'
import { useToast } from './Toast'

export default function GeofencePin() {
  const { showToast } = useToast()
  const [geo, setGeo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pinning, setPinning] = useState(false)
  const [locating, setLocating] = useState(false)
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radius_meters: 200, reason: '' })
  const [isRepin, setIsRepin] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    apiGetMyGeofence()
      .then(({ data }) => { setGeo(data); setIsRepin(true) })
      .catch(() => { setIsRepin(false) })
      .finally(() => setLoading(false))
  }, [])

  const getLocation = () => {
    if (!navigator.geolocation) { showToast('Geolocation not supported by your browser', 'error'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }))
        setLocating(false)
        showToast('Location captured!', 'success')
      },
      () => { showToast('Could not get location. Please allow location access.', 'error'); setLocating(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handlePin = async () => {
    if (!form.name.trim()) { showToast('Please enter an office name', 'error'); return }
    if (!form.latitude || !form.longitude) { showToast('Please capture your GPS location first', 'error'); return }
    if (isRepin && !form.reason.trim()) { showToast('A reason is required when updating your office location', 'error'); return }

    setPinning(true)
    try {
      const { data } = await apiPinGeofence({
        name: form.name.trim(),
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        radius_meters: parseInt(form.radius_meters) || 2000,
        reason: form.reason.trim() || null,
      })
      setGeo(data)
      setIsRepin(true)
      setShowForm(false)
      setForm(f => ({ ...f, reason: '' }))
      showToast(isRepin ? 'Office location updated!' : 'Office location pinned!', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to pin location', 'error')
    } finally { setPinning(false) }
  }

  if (loading) return <div className="spinner-center"><div className="spinner spinner-md" /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Office Location</h1>
          <p className="page-subtitle">Your interns must be within this geofence to submit logs</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
          <img src="/icon-location.svg" alt="" style={{ width: '1.1em', height: '1.1em', verticalAlign: 'middle', marginRight: 6 }} />
          {geo ? 'Update Location' : 'Pin Office Location'}
        </button>
      </div>

      {/* Current geofence */}
      {geo ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3 className="card-title">✅ Current Office Location</h3>
            <span className="badge badge-active">Active</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div className="form-label" style={{ marginBottom: 4 }}>Office Name</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{geo.name}</div>
            </div>
            <div>
              <div className="form-label" style={{ marginBottom: 4 }}>Geofence Radius</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{geo.radius_meters}m ({(geo.radius_meters / 1000).toFixed(1)}km)</div>
            </div>
            <div>
              <div className="form-label" style={{ marginBottom: 4 }}>Latitude</div>
              <div style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{geo.latitude}</div>
            </div>
            <div>
              <div className="form-label" style={{ marginBottom: 4 }}>Longitude</div>
              <div style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{geo.longitude}</div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Pinned: {new Date(geo.pinned_at).toLocaleString()}
          </div>
        </div>
      ) : (
        <div className="alert alert-warning">
          ⚠️ You have not pinned your office location yet. Your interns cannot submit logs until you do.
        </div>
      )}

      {/* Pin / update form */}
      {showForm && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>
            {isRepin ? 'Update Office Location' : 'Pin Your Office Location'}
          </h3>

          <div className="form-group">
            <label className="form-label">Office Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Safaricom HQ, Nairobi" />
          </div>

          <div className="form-group">
            <label className="form-label">GPS Coordinates *</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <input className="form-input" style={{ flex: 1, minWidth: 120 }} value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="Latitude" />
              <input className="form-input" style={{ flex: 1, minWidth: 120 }} value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="Longitude" />
              <button type="button" className="btn btn-secondary" onClick={getLocation} disabled={locating}>
                {locating ? <span className="spinner spinner-sm" /> : (
                  <><img src="/icon-location.svg" alt="" style={{ width: '1em', height: '1em', verticalAlign: 'middle', marginRight: 5 }} />Use My Location</>
                )}
              </button>
            </div>
            <span className="form-hint">Click "Use My Location" to auto-fill from your device GPS, or enter coordinates manually.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Geofence Radius (meters)</label>
            <input className="form-input" type="number" value={form.radius_meters} onChange={e => setForm(f => ({ ...f, radius_meters: e.target.value }))} min={100} max={10000} />
            <span className="form-hint">Default: 200m. Interns must be within this distance to submit. Increase only if your site is large.</span>
          </div>

          {isRepin && (
            <div className="form-group">
              <label className="form-label">Reason for Update *</label>
              <textarea className="form-textarea" rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Transferred from Mombasa port office to Nairobi town office" />
              <span className="form-hint">Required when updating. The university lecturer will be notified.</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={pinning}>Cancel</button>
            <button className="btn btn-primary" onClick={handlePin} disabled={pinning}>
              {pinning ? <span className="spinner spinner-sm" /> : (isRepin ? 'Update Location' : 'Pin Location')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
