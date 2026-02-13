import { vi } from 'vitest'
import React from 'react'

// Mock Link component — renders a plain <a> tag
export const MockLink = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>(function MockLink({ href, children, ...props }, ref) {
  return React.createElement('a', { href, ref, ...props }, children)
})

// Mock router
export const mockPush = vi.fn()
export const mockReplace = vi.fn()
export const mockBack = vi.fn()
export const mockRefresh = vi.fn()
export const mockPrefetch = vi.fn()

export const mockRouter = {
  push: mockPush,
  replace: mockReplace,
  back: mockBack,
  refresh: mockRefresh,
  prefetch: mockPrefetch,
  forward: vi.fn(),
}

export const mockUseRouter = vi.fn(() => mockRouter)
export const mockUsePathname = vi.fn(() => '/en/personal-finance')
export const mockRedirect = vi.fn()

// Setup the mock
export function setupI18nNavigationMock() {
  return {
    Link: MockLink,
    useRouter: mockUseRouter,
    usePathname: mockUsePathname,
    redirect: mockRedirect,
  }
}
