import { notFound } from 'next/navigation'

// Personal Finance module is disabled — not exposed in the sidebar.
// The code is kept for future use. To re-enable, restore the full layout
// with PersonalFinanceNav and remove the notFound() call.
//
// Note: we use notFound() instead of redirect() here because the PWA service
// worker cannot serve redirect responses to clients (causes iOS error:
// "response served by service worker has redirections").

export default function PersonalFinanceLayout({
  children: _children,
}: {
  children: React.ReactNode
}) {
  // Module disabled: return 404 (no redirect = no service worker conflict)
  notFound()
}
