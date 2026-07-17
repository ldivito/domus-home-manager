// Current user resolution for the Personal Finance module.
//
// The session lives server-side (/api/auth/me); this module caches the
// authenticated userId in localStorage so the offline-first module keeps
// working without a network round-trip on every read/write. Devices that
// never logged in keep using the legacy local id, so their data stays
// visible; on first login the legacy records are adopted by the real user.

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

const STORAGE_KEY = 'domus-current-user-id'

/** Local id used before auth wiring existed; kept as offline fallback. */
export const LEGACY_PERSONAL_FINANCE_USER_ID = 'usr_5ad61fe0-39eb-4097-8a92-94922d0b828a'

/**
 * Returns the userId to use for personal-finance records: the cached
 * authenticated user when available, the legacy local id otherwise.
 */
export function getCurrentUserId(): string {
  if (typeof window === 'undefined') return LEGACY_PERSONAL_FINANCE_USER_ID
  try {
    return localStorage.getItem(STORAGE_KEY) || LEGACY_PERSONAL_FINANCE_USER_ID
  } catch {
    return LEGACY_PERSONAL_FINANCE_USER_ID
  }
}

/**
 * Re-key personal-finance records created under the legacy local id to the
 * authenticated user, so pre-login data doesn't vanish after login.
 * Idempotent: once adopted there are no legacy rows left to match.
 */
async function adoptLegacyPersonalFinanceData(realUserId: string): Promise<void> {
  if (realUserId === LEGACY_PERSONAL_FINANCE_USER_ID) return

  const adopted = [
    await db.personalWallets
      .filter(record => record.userId === LEGACY_PERSONAL_FINANCE_USER_ID)
      .modify({ userId: realUserId }),
    await db.personalCategories
      .filter(record => record.userId === LEGACY_PERSONAL_FINANCE_USER_ID)
      .modify({ userId: realUserId }),
    await db.personalTransactions
      .filter(record => record.userId === LEGACY_PERSONAL_FINANCE_USER_ID)
      .modify({ userId: realUserId })
  ]
  const total = adopted.reduce((sum, n) => sum + n, 0)
  if (total > 0) {
    logger.debug(`Adopted ${total} legacy personal-finance records for user ${realUserId}`)
  }
}

let syncInFlight: Promise<boolean> | null = null

/**
 * Refresh the cached personal-finance user from the server session and adopt
 * legacy-local data on first login. Returns whether a session is active.
 * On 401 the cached id is kept: logging out must not hide local data.
 */
export function syncCurrentUserFromSession(): Promise<boolean> {
  if (syncInFlight) return syncInFlight

  syncInFlight = (async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' })
      if (!response.ok) return false

      const data = await response.json() as { user?: { userId?: string } }
      const userId = data.user?.userId
      if (!userId) return false

      try {
        localStorage.setItem(STORAGE_KEY, userId)
      } catch {
        // Storage unavailable (private mode): session is still valid
      }
      await adoptLegacyPersonalFinanceData(userId)
      return true
    } catch {
      return false
    } finally {
      syncInFlight = null
    }
  })()

  return syncInFlight
}
