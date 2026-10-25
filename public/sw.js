// Service worker mínimo: hace falta para que el navegador instale la app y la ofrezca en "Compartir".
// No guarda nada en caché (la app siempre carga la versión más reciente).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
