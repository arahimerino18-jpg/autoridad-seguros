/**
 * Core utility functions for Autoridad Seguros AI™
 * These are the building blocks used throughout the entire application.
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ─── CLASSNAME UTILITY ────────────────────────────────────────────────────────

/**
 * Merges Tailwind CSS classes safely, resolving conflicts intelligently.
 * Example: cn('text-red-500', isActive && 'text-blue-500') → 'text-blue-500'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ─── DATE & TIME ──────────────────────────────────────────────────────────────

/**
 * Formats a date string to a localized Spanish display format.
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  })
}

/**
 * Formats a relative time (e.g., "hace 2 días") in Spanish.
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'hace un momento'
  if (diffMins < 60) return `hace ${diffMins} min`
  if (diffHours < 24) return `hace ${diffHours}h`
  if (diffDays < 7) return `hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`
  return formatDate(d)
}

/**
 * Returns the first day of the current billing period (YYYY-MM-01).
 */
export function getCurrentBillingPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

// ─── STRING UTILITIES ─────────────────────────────────────────────────────────

/**
 * Truncates a string to a max length with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return `${str.slice(0, maxLength)}…`
}

/**
 * Returns initials from a full name (e.g., "Arahi Merino" → "AM").
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Converts a string to a URL-friendly slug.
 */
export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/**
 * Counts words in a string.
 */
export function countWords(str: string): number {
  return str.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Counts characters (for SMS limit checks).
 */
export function countChars(str: string): number {
  return str.length
}

/**
 * Calculates SMS segments needed (1 segment = 160 chars).
 */
export function getSmsSegments(str: string): number {
  return Math.ceil(str.length / 160)
}

// ─── NUMBER UTILITIES ─────────────────────────────────────────────────────────

/**
 * Formats a USD price (e.g., 27 → "$27.00").
 */
export function formatPrice(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Returns a percentage of usage (capped at 100).
 */
export function getUsagePercentage(used: number, max: number): number {
  if (max === -1) return 0 // Unlimited plan
  return Math.min(100, Math.round((used / max) * 100))
}

/**
 * Returns the color class for a usage percentage.
 */
export function getUsageColorClass(percentage: number): string {
  if (percentage < 60) return 'text-emerald-600'
  if (percentage < 80) return 'text-amber-600'
  return 'text-red-600'
}

// ─── COLOR UTILITIES ──────────────────────────────────────────────────────────

/**
 * Validates a hex color string.
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)
}

/**
 * Returns white or black text color for best contrast on a background.
 */
export function getContrastColor(hexBackground: string): '#ffffff' | '#000000' {
  const hex = hexBackground.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  // Perceived luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

// ─── ARRAY UTILITIES ──────────────────────────────────────────────────────────

/**
 * Groups an array by a key function.
 */
export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce(
    (groups, item) => {
      const key = keyFn(item)
      return { ...groups, [key]: [...(groups[key] || []), item] }
    },
    {} as Record<string, T[]>
  )
}

/**
 * Returns unique values from an array.
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)]
}

// ─── ERROR UTILITIES ──────────────────────────────────────────────────────────

/**
 * Extracts a human-readable message from any error type.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Ha ocurrido un error inesperado. Por favor intenta de nuevo.'
}

/**
 * Checks if an error is a rate limit error.
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('429') || error.message.toLowerCase().includes('rate limit')
  }
  return false
}

// ─── PLAN UTILITIES ───────────────────────────────────────────────────────────

/**
 * Checks if a plan has access to a feature.
 * Plan hierarchy: starter < pro < elite
 */
export function planHasAccess(userPlan: string, requiredPlan: string): boolean {
  const hierarchy: Record<string, number> = { starter: 0, pro: 1, elite: 2 }
  return (hierarchy[userPlan] ?? 0) >= (hierarchy[requiredPlan] ?? 0)
}

/**
 * Returns the display name for a plan tier in Spanish.
 */
export function getPlanDisplayName(plan: string): string {
  const names: Record<string, string> = {
    starter: 'Starter',
    pro: 'Pro',
    elite: 'Elite',
  }
  return names[plan] ?? plan
}
