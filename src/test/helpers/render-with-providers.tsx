import React from 'react'
import { render, RenderOptions } from '@testing-library/react'

/**
 * Custom render that wraps components with necessary providers for testing.
 *
 * Since we mock next-intl and i18n/navigation at the module level,
 * the main purpose here is to provide a consistent wrapper for all tests.
 */
function AllProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options })
}

// Re-export everything from testing library
export * from '@testing-library/react'
export { customRender as render }
