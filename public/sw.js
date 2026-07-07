// Service Worker for MARIJO Fullwork PWA
const CACHE_NAME = 'fullwork-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  event.waitUntil(clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = {
    title: 'MARIJO Fullwork',
    body: 'Tienes una notificación',
    icon: '/pwa-icon-192.svg',
    badge: '/pwa-icon-192.svg',
    tag: 'fullwork-notification'
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/pwa-icon-192.svg',
    badge: data.badge || '/pwa-icon-192.svg',
    tag: data.tag || 'fullwork-notification',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: data.data || {},
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Background sync for scheduled notifications (when available)
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-reservations') {
    event.waitUntil(checkUpcomingReservations());
  }
});

// Periodic background sync (for browsers that support it)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reservations') {
    event.waitUntil(checkUpcomingReservations());
  }
});

async function checkUpcomingReservations() {
  try {
    const response = await fetch('/api/notifications/check');
    const data = await response.json();
    console.log('[SW] Checked reservations:', data);
  } catch (error) {
    console.error('[SW] Error checking reservations:', error);
  }
}
