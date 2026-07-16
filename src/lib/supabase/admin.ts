/**
 * Supabase Admin Client — service role, bypasses RLS.
 * ONLY use in API routes, webhook handlers, and cron jobs.
 * NEVER import in client components or Server Components.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Lazy singleton — created on first use, not at module import time
// This prevents build-time failures when env vars are not available
let _adminClient: ReturnType<typeof createSupabaseClient<Database>> | null = null

export function createAdminClient() {
  if (_adminClient) return _adminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      '[Supabase Admin] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. ' +
      'These are required for webhook and admin operations.'
    )
  }

  _adminClient = createSupabaseClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return _adminClient
}

// Named export for backward compatibility
export const supabaseAdmin = {
  get value() { return createAdminClient() }
}
