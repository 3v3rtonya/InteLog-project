/**
 * usePWAInstall.js
 * 
 * Captures the browser's beforeinstallprompt event so we can:
 * 1. Show a custom "Install App" button instead of relying on the native mini-infobar
 * 2. Call prompt() at a moment that makes sense (user clicks the button)
 * 
 * HOW PWA INSTALL WORKS:
 * - Browser fires beforeinstallprompt on HTTPS when: SW is registered,
 *   manifest is valid, and the user hasn't already installed the app.
 * - On Android Chrome this happens within seconds of the first page load.
 * - On iOS Safari there is NO beforeinstallprompt — users must tap
 *   Share ? "Add to Home Screen" manually. We detect iOS and show
 *   instructions instead of a prompt button.
 * - The event is a one-shot: once you call prompt() it's consumed.
 *   After install appinstalled fires and we clear the state.
 */
import { useState, useEffect } from 'react'

export function usePWAInstall() {
  const [promptEvent, setPromptEvent] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Detect iOS (no beforeinstallprompt support)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
    setIsIOS(ios)

    // Detect if already running as installed PWA
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    setIsInstalled(standalone)

    const handler = (e) => {
      e.preventDefault()           // stop the mini-infobar
      setPromptEvent(e)            // save it so we can fire it on demand
    }

    const installedHandler = () => {
      setIsInstalled(true)
      setPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const triggerInstall = async () => {
    if (!promptEvent) return
    promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setPromptEvent(null)
  }

  return {
    canInstall: !!promptEvent && !isInstalled,
    isInstalled,
    isIOS: isIOS && !window.matchMedia('(display-mode: standalone)').matches,
    triggerInstall,
  }
}
