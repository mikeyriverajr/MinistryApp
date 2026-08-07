/// <reference lib="webworker" />
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Recordatorio de Ministerio';
  const options = {
    body: data.body || 'Tienes una revisita o estudio programado.',
    icon: '/vite.svg',
    badge: '/vite.svg',
  };

  event.waitUntil(sw.registration.showNotification(title, options));
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(sw.clients.openWindow('/calendar'));
});
