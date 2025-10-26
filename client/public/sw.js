const CACHE_NAME = 'invenai-v1';
const STATIC_CACHE = 'invenai-static-v1';
const DYNAMIC_CACHE = 'invenai-dynamic-v1';

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/src/main.tsx',
  '/src/index.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// API routes that should be cached
const CACHEABLE_ROUTES = [
  '/api/products',
  '/api/categories', 
  '/api/locations',
  '/api/dashboard/metrics',
  '/api/sales',
  '/api/ai/predictions'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
  
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    return handleNonGetRequest(event);
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    return handleApiRequest(event);
  }

  // Handle static assets
  if (isStaticAsset(url)) {
    return handleStaticAsset(event);
  }

  // Handle app shell (SPA routing)
  return handleAppShell(event);
});

// Handle non-GET requests (POST, PUT, DELETE)
function handleNonGetRequest(event) {
  const { request } = event;
  
  event.respondWith(
    fetch(request)
      .then((response) => {
        // If the request succeeds, clear related cache entries
        if (response.ok && request.url.includes('/api/')) {
          invalidateRelatedCache(request.url);
        }
        return response;
      })
      .catch(() => {
        // If offline, return a custom offline response
        return new Response(
          JSON.stringify({
            error: 'Offline - operation queued for sync',
            queued: true,
            timestamp: Date.now()
          }),
          {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
  );
}

// Handle API requests with network-first strategy
function handleApiRequest(event) {
  const { request } = event;
  
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok && isCacheableRoute(request.url)) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then((cache) => {
              cache.put(request, responseClone);
            })
            .catch((error) => {
              console.error('[SW] Failed to cache API response:', error);
            });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try to serve from cache
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[SW] Serving API request from cache:', request.url);
              return cachedResponse;
            }
            
            // Return offline response if no cache available
            return new Response(
              JSON.stringify({
                error: 'Offline and no cached data available',
                offline: true,
                timestamp: Date.now()
              }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
      })
  );
}

// Handle static assets with cache-first strategy
function handleStaticAsset(event) {
  const { request } = event;
  
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(STATIC_CACHE)
                .then((cache) => {
                  cache.put(request, responseClone);
                });
            }
            return response;
          });
      })
  );
}

// Handle app shell (SPA routing)
function handleAppShell(event) {
  const { request } = event;
  
  event.respondWith(
    caches.match('/')
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch('/')
          .then((response) => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(STATIC_CACHE)
                .then((cache) => {
                  cache.put('/', responseClone);
                });
            }
            return response;
          });
      })
      .catch(() => {
        // Return a basic offline page
        return new Response(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>InvenAI - Offline</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex; 
                  align-items: center; 
                  justify-content: center; 
                  min-height: 100vh; 
                  margin: 0; 
                  background: #f8fafc;
                }
                .container { 
                  text-align: center; 
                  max-width: 400px; 
                  padding: 2rem;
                  background: white;
                  border-radius: 8px;
                  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }
                .icon { 
                  width: 64px; 
                  height: 64px; 
                  margin: 0 auto 1rem; 
                  background: #3b82f6;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-size: 24px;
                }
                h1 { 
                  color: #1f2937; 
                  margin-bottom: 0.5rem; 
                }
                p { 
                  color: #6b7280; 
                  margin-bottom: 1.5rem; 
                }
                button {
                  background: #3b82f6;
                  color: white;
                  border: none;
                  padding: 0.75rem 1.5rem;
                  border-radius: 6px;
                  cursor: pointer;
                  font-size: 0.875rem;
                  font-weight: 500;
                }
                button:hover {
                  background: #2563eb;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="icon">📦</div>
                <h1>You're Offline</h1>
                <p>InvenAI is not available right now. Please check your connection and try again.</p>
                <button onclick="window.location.reload()">Try Again</button>
              </div>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' }
        });
      })
  );
}

// Utility functions
function isStaticAsset(url) {
  return url.pathname.includes('.') || 
         url.origin.includes('fonts.googleapis.com') ||
         url.origin.includes('fonts.gstatic.com');
}

function isCacheableRoute(url) {
  return CACHEABLE_ROUTES.some(route => url.includes(route));
}

function invalidateRelatedCache(url) {
  const cacheKeysToInvalidate = [];
  
  if (url.includes('/api/products')) {
    cacheKeysToInvalidate.push('/api/products', '/api/dashboard/metrics');
  }
  
  if (url.includes('/api/categories')) {
    cacheKeysToInvalidate.push('/api/categories');
  }
  
  if (url.includes('/api/locations')) {
    cacheKeysToInvalidate.push('/api/locations');
  }

  cacheKeysToInvalidate.forEach(cacheKey => {
    caches.open(DYNAMIC_CACHE)
      .then(cache => {
        cache.keys().then(requests => {
          requests.forEach(request => {
            if (request.url.includes(cacheKey)) {
              cache.delete(request);
            }
          });
        });
      });
  });
}

// Background sync for queued operations
self.addEventListener('sync', (event) => {
  if (event.tag === 'invenai-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(syncQueuedOperations());
  }
});

async function syncQueuedOperations() {
  try {
    // Get queued operations from IndexedDB or localStorage
    // This would integrate with the OfflineService
    console.log('[SW] Syncing queued operations...');
    
    // Notify all clients that sync is complete
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: data.tag || 'invenai-notification',
      data: data.data || {},
      actions: [
        {
          action: 'view',
          title: 'View',
          icon: '/icon-view.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icon-dismiss.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_INVALIDATE') {
    const { pattern } = event.data;
    invalidateCacheByPattern(pattern);
  }
});

function invalidateCacheByPattern(pattern) {
  caches.open(DYNAMIC_CACHE)
    .then(cache => {
      cache.keys().then(requests => {
        requests.forEach(request => {
          if (request.url.includes(pattern)) {
            cache.delete(request);
            console.log('[SW] Invalidated cache for:', request.url);
          }
        });
      });
    });
}

console.log('[SW] Service worker script loaded');
