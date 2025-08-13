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