/**
 * Supabase Browser Client
 *
 * Used in Client Components ('use client') and hooks.
 * Uses the ANON key — all queries are subject to Row Level Security (RLS).
 * This is safe to expose to the browser.
 *
 * Pattern: Singleton to prevent multiple GoTrue instances.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (client) return client

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return client
}
