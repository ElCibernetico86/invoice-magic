// ============================================================
// Service Worker — Invoice Magic PWA
// ============================================================
// Enables offline-first caching of the app shell so the
// application loads instantly even without a network connection.
// ============================================================

const CACHE_NAME = 'invoice-magic-v15';

const ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/firebase-config.js',
    '/js/cloudSync.js',
    '/js/db.js',
    '/js/toast.js',
    '/js/utils.js',
    '/js/app.js',
    '/js/views/dashboard.js',
    '/js/views/documentList.js',
    '/js/views/documentEditor.js',
    '/js/views/documentPreview.js',
    '/js/views/clients.js',
    '/js/views/tools.js',
    '/js/views/settings.js',
    '/manifest.json',
    '/icons/icon-192.svg',
    '/icons/icon-512.svg'
];

// Install — cache all shell assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — keep navigations fresh, serve shell assets offline
self.addEventListener('fetch', (event) => {
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
});
