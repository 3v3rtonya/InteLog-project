/* ============================================================
   InteLog MIS — Service Worker
   Cache strategy:
   - App shell (HTML, CSS, JS, icons) → Cache First
   - API calls (/api/*) → Network First, fallback to cache
   - Uploads (/api/uploads/*) → Cache First
   ============================================================ */

const CACHE_VERSION = 'intelog-v1'
const STATIC_CACHE  = `${CACHE_VERSION}-static`
const API_CACHE     = `${CACHE_VERSION}-api`

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/dekut-logo.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
]

// ── Install: pre-cache app shell ───────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Non-fatal — some assets may not exist yet during first install
      })
    }).then(() => self.skipWaiting())
  )
})

// ── Activate: clean up old caches ──────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('intelog-') && k !== STATIC_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: routing logic ────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // API calls → Network First, brief cache fallback
  if (url.pathname.startsWith('/api/')) {
    // Uploads can be cached aggressively
    if (url.pathname.startsWith('/api/uploads/')) {
      event.respondWith(cacheFirst(event.request, STATIC_CACHE))
      return
    }
    // All other API calls: network first, don't cache auth endpoints
    if (url.pathname.startsWith('/api/auth/')) return
    event.respondWith(networkFirst(event.request, API_CACHE))
    return
  }

  // App shell and static assets → Cache First
  event.respondWith(cacheFirst(event.request, STATIC_CACHE))
})

// ── Cache First strategy ────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html')
      if (fallback) return fallback
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  }
}

// ── Network First strategy ──────────────────────────────────
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(
      JSON.stringify({ detail: 'You are offline. Please check your connection.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}