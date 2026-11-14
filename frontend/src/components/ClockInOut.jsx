import { useState, useEffect } from 'react'
import { apiClockIn, apiClockOut, apiGetTodayAttendance } from '../services/api'
import { useToast } from './Toast'
import { Clock, LogIn, LogOut, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

const MAX_CLOCKS = 3

export default function ClockInOut() {
  const { showToast } = useToast()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    apiGetTodayAttendance()
      .then(r => setRecord(r.data))
      .catch(() => setRecord(null))
      .finally(() => setLoading(false))
  }, [])

  const getLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation not supported'))
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        err => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })

  const handleClockIn = async () => {
    setActing(true)
    try {
      const coords = await getLocation()
      const { data } = await apiClockIn(coords)
      setRecord(data)
      const count = data.clock_in_count || 1
      const msg = count === 1 ? 'Clocked in successfully' : `Clocked back in (${count}/${MAX_CLOCKS})`
      showToast(msg, 'success')
    } catch (err) {
      if (err.code === 1) showToast('Location access denied. Please enable GPS.', 'error')
      else showToast(err.response?.data?.detail || 'Clock-in failed', 'error')
    } finally { setActing(false) }
  }

  const handleClockOut = async () => {
    setActing(true)
    try {
      const coords = await getLocation()
      const { data } = await apiClockOut(coords)
      setRecord(data)
      showToast('Clocked out successfully', 'success')
    } catch (err) {
      if (err.code === 1) showToast('Location access denied. Please enable GPS.', 'error')
      else showToast(err.response?.data?.detail || 'Clock-out failed', 'error')
    } finally { setActing(false) }
  }

  const fmt = (dt) => dt ? new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'

  if (loading) return null

  const clocked_in  = record?.clock_in_time
  const clocked_out = record?.clock_out_time
  const is_onsite   = record?.is_onsite
  const clock_count = record?.clock_in_count || 0
  const can_reclock = clocked_out && clock_count < MAX_CLOCKS

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Clock size={22} color="var(--brand-green)" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                Today's Attendance
              </span>
              {clock_count > 1 && (
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: 'var(--brand-red)',
                  color: '#fff',
                  borderRadius: 99,
                  padding: '1px 8px'
                }}>
                  {clock_count}/{MAX_CLOCKS} clock-ins
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: 16, marginTop: 2 }}>
              <span>In: <strong>{fmt(clocked_in)}</strong></span>
              <span>Out: <strong>{fmt(clocked_out)}</strong></span>
              {clocked_in && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {is_onsite
                    ? <><CheckCircle size={13} color="#16a34a" /><span style={{ color: '#16a34a' }}>On-Site</span></>
                    : <><XCircle size={13} color="#dc2626" /><span style={{ color: '#dc2626' }}>Off-Site</span></>
                  }
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* No record yet — first clock-in */}
          {!clocked_in && (
            <button className="btn btn-primary" onClick={handleClockIn} disabled={acting}>
              {acting
                ? <span className="spinner spinner-sm" />
                : <><LogIn size={16} style={{ marginRight: 6 }} />Clock In</>
              }
            </button>
          )}

          {/* Currently clocked in — allow clock-out */}
          {clocked_in && !clocked_out && (
            <button className="btn btn-secondary" onClick={handleClockOut} disabled={acting}>
              {acting
                ? <span className="spinner spinner-sm" />
                : <><LogOut size={16} style={{ marginRight: 6 }} />Clock Out</>
              }
            </button>
          )}

          {/* Clocked out and still has re-clock allowance */}
          {can_reclock && (
            <button className="btn btn-primary" onClick={handleClockIn} disabled={acting}>
              {acting
                ? <span className="spinner spinner-sm" />
                : <><RefreshCw size={16} style={{ marginRight: 6 }} />Clock Back In</>
              }
            </button>
          )}

          {/* Clocked out and exhausted all clock-ins */}
          {clocked_out && !can_reclock && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              Day complete
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
