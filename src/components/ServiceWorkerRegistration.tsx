'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          logger.debug('SW registered:', registration.scope);
        })
        .catch((error) => {
          logger.error('SW registration failed:', error);
        });
    }
  }, []);

  return null;
}
