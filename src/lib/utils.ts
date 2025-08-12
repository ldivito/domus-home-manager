import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate a stable string id for cloud-synced tables
export function generateId(prefix: string): string {
  const randomUUID = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID
  const uuid = randomUUID
    ? randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}_${uuid}`
}