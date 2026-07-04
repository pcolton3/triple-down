'use client';

import { useEffect } from 'react';

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (process.env.NODE_ENV !== 'production' && !isLocalhost) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // The app should still work normally if install support is unavailable.
      });
    });
  }, []);

  return null;
}
