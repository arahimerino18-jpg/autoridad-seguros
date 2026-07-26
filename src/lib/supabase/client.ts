/**
 * Supabase Browser Client — Singleton
 *
 * Module-level singleton prevents multiple GoTrue instances competing
 * with each other and firing duplicate onAuthStateChange events.
 *
 * This is the ONLY place that creates a browser Supabase client.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

let _instance: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (typeof window === 'undefined') {
    // SSR context — create fresh instance (server has no module cache issue)
    return createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // Browser context — reuse singleton
  if (!_instance) {
    _instance = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _instance
}
