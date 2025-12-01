import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate a stable string id for cloud-synced tables
export function generateId(prefix: string): string {
  const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return `${prefix}_${cryptoObj.randomUUID()}`
  }
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const buf = new Uint32Array(4)
    cryptoObj.getRandomValues(buf)
    const uuid = Array.from(buf).map((n) => n.toString(16).padStart(8, '0')).join('')
    return `${prefix}_${uuid}`
  }
  const fallback = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}_${fallback}`
}

/**
 * Safely convert a date value to a Date object.
 * Handles Date objects, ISO strings (from IndexedDB), and timestamps.
 * Returns the current date if input is invalid.
 */
export function toDate(value: Date | string | number | undefined | null): Date {
  if (!value) return new Date()
  if (value instanceof Date) return value
  const parsed = new Date(value)
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

/**
 * Format a number as Argentinian Peso (ARS)
 * Uses periods for thousands separator and comma for decimal separator
 * Example: 1234567.89 => "1.234.567,89"
 */
export function formatARS(amount: number): string {
  // Round to 2 decimal places
  const rounded = Math.round(amount * 100) / 100

  // Split into integer and decimal parts
  const [intPart, decPart = '00'] = rounded.toFixed(2).split('.')

  // Add thousand separators (periods)
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  // Return with comma as decimal separator
  return `${formattedInt},${decPart}`
}

// Generate a short, shareable invite code (8 characters, uppercase alphanumeric)
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed ambiguous chars: I, O, 0, 1
  const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const randomValues = new Uint8Array(8)
    cryptoObj.getRandomValues(randomValues)
    return Array.from(randomValues)
      .map(val => chars[val % chars.length])
      .join('')
  }

  // Fallback for environments without crypto
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}