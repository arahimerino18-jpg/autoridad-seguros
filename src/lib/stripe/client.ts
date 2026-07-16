import Stripe from 'stripe'
import type { PlanTier } from '@/types/database'

// ─── Stripe Client (server-only) ──────────────────────────────────────────────
// Never import this in client components.

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set. Check your environment variables.')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // apiVersion is set by the installed stripe package version
  // Stripe 22.x uses the latest available API version by default
})

// ─── Plan → Price ID mapping ──────────────────────────────────────────────────
// Source of truth: environment variables.
// These must match the Price IDs in your Stripe dashboard.
// NEVER hardcode Price IDs — they differ between test and production.

export interface PriceConfig {
  monthly: string
  annual: string
}

export const PLAN_PRICES: Record<PlanTier, PriceConfig> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '',
    annual:  process.env.STRIPE_PRICE_STARTER_ANNUAL  ?? '',
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
    annual:  process.env.STRIPE_PRICE_PRO_ANNUAL  ?? '',
  },
  elite: {
    monthly: process.env.STRIPE_PRICE_ELITE_MONTHLY ?? '',
    annual:  process.env.STRIPE_PRICE_ELITE_ANNUAL  ?? '',
  },
}

// Reverse lookup: Price ID → PlanTier + cycle
export function getPlanFromPriceId(priceId: string): { plan: PlanTier; ciclo: 'monthly' | 'annual' } | null {
  for (const [plan, prices] of Object.entries(PLAN_PRICES)) {
    if (prices.monthly === priceId) return { plan: plan as PlanTier, ciclo: 'monthly' }
    if (prices.annual === priceId)  return { plan: plan as PlanTier, ciclo: 'annual' }
  }
  return null
}

// ─── Grace period config ──────────────────────────────────────────────────────
export const GRACE_PERIOD_DAYS = 3

// ─── Subscription status → access allowed ─────────────────────────────────────
// Determines if a subscription status grants platform access.
export function isSubscriptionActive(
  status: string,
  gracePeriodFin: string | null
): boolean {
  if (status === 'active' || status === 'trialing') return true
  if (status === 'past_due' && gracePeriodFin) {
    return new Date(gracePeriodFin) > new Date()
  }
  return false
}
