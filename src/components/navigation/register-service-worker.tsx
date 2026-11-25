'use client';

import * as React from 'react';

export function RegisterServiceWorker() {
  React.useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/sw.js');
      return;
    }

    // A service worker left by a production build can serve stale Next.js
    // chunks while the same origin is running the development server.
    void navigator.serviceWorker.getRegistrations().then(async registrations => {
      const hasController = Boolean(navigator.serviceWorker.controller);
      const reloadKey = 'sebakul-dev-sw-cleanup';
      if (!hasController) {
        // A previous cleanup marker must not suppress recovery if a service
        // worker later takes control of this tab again.
        sessionStorage.removeItem(reloadKey);
        if (!registrations.length) return;
      }

      await Promise.all(registrations.map(registration => registration.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('sebakul-static-')).map(key => caches.delete(key)));
      }

      const controllerScript = navigator.serviceWorker.controller?.scriptURL ?? 'controlled';
      if (hasController && sessionStorage.getItem(reloadKey) !== controllerScript) {
        sessionStorage.setItem(reloadKey, controllerScript);
        window.location.reload();
      }
    }).catch(() => {
      // Service worker cleanup is best effort; it must not block the app.
    });
  }, []);
  return null;
}
