import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'es'],

  // Used when no locale matches
  defaultLocale: 'en',

  // Disable automatic locale detection from Accept-Language headers / cookies.
  // Without this, iOS PWA (standalone mode) has no session cookies on first launch
  // so the middleware tries to redirect based on the system language, causing
  // a "too many redirects" loop.
  localeDetection: false
});
