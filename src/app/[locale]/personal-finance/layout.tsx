import { redirect } from 'next/navigation'

// Personal Finance module is disabled — not exposed in the sidebar.
// The code is kept for future use. To re-enable, restore the full layout
// with PersonalFinanceNav and remove this redirect.

export default function PersonalFinanceLayout({
  children: _children,
}: {
  children: React.ReactNode
}) {
  // Module disabled: redirect to home
  redirect('/')
}
