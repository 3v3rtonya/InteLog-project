import { useState } from 'react'
import { usePWAInstall } from '../hooks/usePWAInstall'

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
)

export default function PWAInstallButton({ variant = 'default' }) {
  const { canInstall, isInstalled, isIOS, triggerInstall } = usePWAInstall()
  const [iosDismissed, setIosDismissed] = useState(false)

  if (isInstalled) return null

  // iOS: show instruction banner (no programmatic install API on iOS)
  if (isIOS && !iosDismissed && variant === 'banner') {
    return (
      <div className="pwa-ios-banner" role="banner">
        <span className="pwa-ios-icon"><ShareIcon /></span>
        <span className="pwa-ios-text">
          Tap <strong>Share</strong> then <strong>"Add to Home Screen"</strong> to install DeKUT InteLog MIS
        </span>
        <button className="pwa-ios-dismiss" onClick={() => setIosDismissed(true)} aria-label="Dismiss">x</button>
      </div>
    )
  }

  // Android / Desktop: only show when browser has fired beforeinstallprompt
  if (!canInstall) return null

  if (variant === 'navbar') {
    return (
      <button className="btn btn-primary btn-sm pwa-install-btn" onClick={triggerInstall} title="Install DeKUT InteLog MIS">
        <DownloadIcon />
        Get the App
      </button>
    )
  }

  // default: card button at bottom of auth card
  return (
    <button className="pwa-install-card-btn" onClick={triggerInstall}>
      <DownloadIcon />
      Get the App - Install DeKUT InteLog MIS
    </button>
  )
}