// Current user resolution for the Personal Finance module
//
// TODO: Wire this to the real auth context once personal-finance is connected
// to authentication. Until then, every read/write in the module MUST use this
// single constant so all records live in the same "user universe".
// (Previously the module mixed 'current-user-id' and a hardcoded usr_ id,
// which split wallets/categories and transactions into two disjoint datasets.)

export const PERSONAL_FINANCE_USER_ID = 'usr_5ad61fe0-39eb-4097-8a92-94922d0b828a'

/**
 * Returns the userId to use for personal-finance records.
 * Centralized so that swapping in the real auth context is a one-line change.
 */
export function getCurrentUserId(): string {
  return PERSONAL_FINANCE_USER_ID
}
