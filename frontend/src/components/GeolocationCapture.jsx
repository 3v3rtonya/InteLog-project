import { useState } from 'react'
import { apiCheckGeofence } from '../services/api'

/*
 * GPS sampling strategy for indoor / thick-wall accuracy:
 *
 * Problem: a single cold-start reading can be 15-60 m off indoors because
 * the browser serves a cached or AGPS-assisted fix before the receiver
 * settles.  Taking multiple readings and keeping the one with the smallest
 * reported accuracy circle gives a significantly better true fix.
 *
 * Strategy:
 *   1. Open a watchPosition stream.
 *   2. Collect readings for up to MAX_WAIT_MS (8 s) OR until we receive
 *      SAMPLE_TARGET (5) readings, whichever comes first.
 *   3. Pick the sample with the lowest coords.accuracy value (tightest circle).
 *   4. Send that position + its accuracy to the backend so it can add the
 *      appropriate indoor-drift buffer to the geofence radius.
 */

const SAMPLE_TARGET = 5       // stop early once we have this many samples
const MAX_WAIT_MS   = 8_000   // hard stop (ms)
const GEO_OPTIONS   = {
  enableHighAccuracy: true,   // request GPS chip, not WiFi/cell tower
  timeout:            10_000, // max time for each individual fix
  maximumAge:         0,      // never use a cached position
}

export default function GeolocationCapture({ onResult }) {
  const [status,   setStatus  ] = useState('idle')
  const [message,  setMessage ] = useState('')
  const [progress, setProgress] = useState(0) // 0-100 for the progress bar

  const getLocation = () => {
    if (!navigator.geolocation) {
      setStatus('error')
      setMessage('Geolocation is not supported by your browser.')
      return
    }

    setStatus('locating')
    setMessage('Sampling GPS — please hold still…')
    setProgress(0)

    const samples   = []
    let   watchId   = null
    let   timeoutId = null

    const finish = async () => {
      // Clean up the watch stream
      if (watchId   !== null) navigator.geolocation.clearWatch(watchId)
      if (timeoutId !== null) clearTimeout(timeoutId)

      if (samples.length === 0) {
        setStatus('error')
        setMessage('Could not get a GPS fix. Please allow location access and try again.')
        onResult?.({ latitude: null, longitude: null, isOnsite: false })
        return
      }

      // Pick the sample with the smallest accuracy circle (best fix)
      const best = samples.reduce((a, b) => a.accuracy < b.accuracy ? a : b)

      setMessage(`Best fix: ±${best.accuracy.toFixed(0)} m accuracy — checking geofence…`)

      try {
        const { data } = await apiCheckGeofence(best.latitude, best.longitude, best.accuracy)

        if (data.is_onsite) {
          setStatus('onsite')
          setMessage(data.message)
          onResult?.({ latitude: best.latitude, longitude: best.longitude, isOnsite: true, accuracy: best.accuracy })
        } else {
          setStatus('offsite')
          setMessage(data.message)
          onResult?.({ latitude: best.latitude, longitude: best.longitude, isOnsite: false, accuracy: best.accuracy })
        }
      } catch (err) {
        const detail = err?.response?.data?.detail || 'Could not verify location. Please try again.'
        setStatus('error')
        setMessage(detail)
        onResult?.({ latitude: best.latitude, longitude: best.longitude, isOnsite: false, accuracy: best.accuracy })
      }
    }

    // Hard stop after MAX_WAIT_MS regardless of sample count
    timeoutId = setTimeout(() => {
      setProgress(100)
      finish()
    }, MAX_WAIT_MS)

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const sample = {
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:  pos.coords.accuracy ?? 50, // fallback if browser omits it
        }
        samples.push(sample)

        const pct = Math.min(100, Math.round((samples.length / SAMPLE_TARGET) * 100))
        setProgress(pct)
        setMessage(
          `Sampling GPS (${samples.length}/${SAMPLE_TARGET})` +
          ` — ±${sample.accuracy.toFixed(0)} m…`
        )

        if (samples.length >= SAMPLE_TARGET) {
          setProgress(100)
          finish()
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          clearTimeout(timeoutId)
          setStatus('denied')
          setMessage('Location access denied. Please enable location permissions to submit a log.')
          onResult?.({ latitude: null, longitude: null, isOnsite: false })
        }
        // Other errors (POSITION_UNAVAILABLE, TIMEOUT) are non-fatal —
        // we just wait for the next watchPosition callback or the hard stop.
      },
      GEO_OPTIONS,
    )
  }

  return (
    <div className="geo-capture">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={getLocation}
        disabled={status === 'locating'}
      >
        {status === 'locating'
          ? <><span className="spinner spinner-sm" /> Sampling GPS…</>
          : <><img src="/icon-location.svg" alt="" style={{ width: '1em', height: '1em', verticalAlign: 'middle', marginRight: 5 }} />Get Location</>
        }
      </button>

      {/* Progress bar — visible only while sampling */}
      {status === 'locating' && (
        <div style={{
          height: 4, borderRadius: 2, background: 'var(--border-color)',
          marginTop: 6, overflow: 'hidden', width: '100%',
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: 'var(--brand-green)',
            width: `${progress}%`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      <div className="geo-status">
        {status === 'idle'    && <span style={{ color: 'var(--text-muted)' }}>Click to verify your location</span>}
        {status === 'locating'&& <span style={{ color: 'var(--text-muted)' }}>{message}</span>}
        {status === 'onsite'  && <span className="geo-onsite">✅ On-site — {message}</span>}
        {status === 'offsite' && <span className="geo-offsite">❌ Off-site — {message}</span>}
        {status === 'denied'  && <span className="geo-denied">⚠️ {message}</span>}
        {status === 'error'   && <span className="geo-denied">⚠️ {message}</span>}
      </div>
    </div>
  )
}
