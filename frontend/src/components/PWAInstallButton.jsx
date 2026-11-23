/**
 * PWAInstallButton.jsx
 *
 * Renders in three modes:
 *   variant="default"  — card button at bottom of auth card (Android/Desktop)
 *   variant="navbar"   — compact button in top navbar (Android/Desktop)
 *   variant="banner"   — iOS "Add to Home Screen" instruction banner (fixed bottom)
 *
 * HOW PWA INSTALL WORKS:
 *   Android Chrome: fires beforeinstallprompt automatically on HTTPS when the
 *   SW is registered + manifest is valid. We capture it, prevent the native
 *   mini-infobar, and show our own button. User clicks ? prompt() fires.
 *
 *   iOS Safari: NO beforeinstallprompt API exists. Only option is to tell the
 *   user to tap Share ? "Add to Home Screen". We detect iOS and show a banner.
 *
 *   Already installed: matchMedia standalone detects this and hides everything.
 */
import { useState } from 'react'
import { usePWAInstall } from '../hooks/usePWAInstall'

export default function PWAInstallButton({ variant = 'default' }) {
  const { canInstall, isInstalled, isIOS, triggerInstall } = usePWAInstall()
  const [iosDismissed, setIosDismissed] = useState(false)

  if (isInstalled) return null

  // iOS banner — shown regardless of variant prop when on iOS
  if (isIOS && !iosDismissed && variant === 'banner') {
    return (
      <div className="pwa-ios-banner" role="banner">
        <span className="pwa-ios-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </span>
        <span className="pwa-ios-text">
          Tap <strong>Share</strong> then <strong>"Add to Home Screen"</strong> to install InteLog
        </span>
        <button
          className="pwa-ios-dismiss"
          onClick={() => setIosDismissed(true)}
          aria-label="Dismiss"
        >?</button>
      </div>
    )
  }

  // Android / Desktop — only show when prompt is available
  if (!canInstall) return null

  if (variant === 'navbar') {
    return (
      <button
        className="btn btn-primary btn-sm pwa-install-btn"
        onClick={triggerInstall}
        title="Install InteLog as an app"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Install App
      </button>
    )
  }

  // default — card button on auth page
  return (
    <button
      className="pwa-install-card-btn"
      onClick={triggerInstall}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Install InteLog App
    </button>
  )
}
