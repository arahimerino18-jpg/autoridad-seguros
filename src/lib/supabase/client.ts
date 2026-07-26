/**
 * Supabase Browser Client
 *
 * Used in Client Components ('use client') and hooks.
 * Uses the ANON key — all queries are subject to Row Level Security (RLS).
 *
 * Singleton pattern: one instance per browser tab to prevent multiple
 * GoTrue auth state listeners competing with each other.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

// Module-level singleton — safe in browser context (one tab = one instance)
let _client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (!_client) {
    _client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}
