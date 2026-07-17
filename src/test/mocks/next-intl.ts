import { vi } from 'vitest'

// Mock useTranslations: returns a function that returns the key prefixed with namespace
// This decouples tests from translation JSON files
export function createMockTranslations(namespace: string) {
  const t = (key: string) => `${namespace}.${key}`
  // Support t.rich() for rich text translations
  t.rich = (key: string) => `${namespace}.${key}`
  t.raw = (key: string) => `${namespace}.${key}`
  t.has = () => true
  return t
}

export const mockUseTranslations = vi.fn((namespace: string) => createMockTranslations(namespace))
export const mockUseLocale = vi.fn(() => 'en')
export const mockUseMessages = vi.fn(() => ({}))
export const mockUseNow = vi.fn(() => new Date())
export const mockUseTimeZone = vi.fn(() => 'America/New_York')
export const mockNextIntlClientProvider = vi.fn(({ children }: { children: React.ReactNode }) => children)

// Setup the mock - call this in vi.mock('next-intl', ...)
export function setupNextIntlMock() {
  return {
    useTranslations: mockUseTranslations,
    useLocale: mockUseLocale,
    useMessages: mockUseMessages,
    useNow: mockUseNow,
    useTimeZone: mockUseTimeZone,
    NextIntlClientProvider: mockNextIntlClientProvider,
  }
}
