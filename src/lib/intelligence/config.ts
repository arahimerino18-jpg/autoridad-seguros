/**
 * Autoridad Seguros AI™ — Aggregator Config Loader
 *
 * Loads configurable thresholds from DB with in-memory cache (5 min TTL).
 * Falls back to hardcoded defaults if DB is unavailable.
 * Same cache pattern as compliance engine (Phase 11).
 */

import type { AggregatorConfig } from '@/types/database'

// ─── Inline defaults (fallback) ───────────────────────────────────────────────
// These match the seeds in migration 012.
// NEVER read from code — always go through getAggregatorConfig().

export const DEFAULT_AGGREGATOR_CONFIG: Omit<AggregatorConfig, 'user_id'> = {
  r1_min_signals:                        3,
  r1_window_days:                        90,
  r2_min_sessions:                       5,
  r2_window_days:                        30,
  r3_min_signals:                        5,
  r3_min_per_product:                    3,
  r3_window_days:                        60,
  r4_min_useful_responses:               3,
  r5_min_prospects:                      4,
  r5_min_pattern_count:                  3,
  r5_window_days:                        60,
  r6_min_useful_responses:               3,
  r6_min_phrase_repetitions:             2,
  r6_window_days:                        60,
  r7_min_phrase_repetitions:             2,
  r7_max_existing_frases:                5,
  r7_max_interview_sessions:             3,
  conf_high_min_signals:                 5,
  conf_high_min_sources:                 2,
  conf_high_min_days:                    14,
  conf_medium_min_signals:               3,
  rejection_reproposal_evidence_factor:  1.5,
  rejection_reproposal_min_days:         14,
  cleanup_max_evidence_for_removal:      3,
  cleanup_min_age_days:                  180,
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface ConfigCacheEntry {
  config: AggregatorConfig
  loaded_at: number
  source: 'db_user' | 'db_global' | 'fallback'
}

const _configCache = new Map<string, ConfigCacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes — same as compliance engine

function getCacheKey(userId: string): string {
  return `config:${userId}`
}

function isCacheValid(entry: ConfigCacheEntry): boolean {
  return (Date.now() - entry.loaded_at) < CACHE_TTL_MS
}

export function invalidateAggregatorConfigCache(userId?: string): void {
  if (userId) {
    _configCache.delete(getCacheKey(userId))
  } else {
    _configCache.clear()
  }
}

export function getAggregatorConfigCacheStatus(userId: string): {
  cached: boolean
  source: string
  age_seconds: number | null
} {
  const entry = _configCache.get(getCacheKey(userId))
  if (!entry) return { cached: false, source: 'none', age_seconds: null }
  return {
    cached: isCacheValid(entry),
    source: entry.source,
    age_seconds: Math.round((Date.now() - entry.loaded_at) / 1000),
  }
}

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Returns the aggregator config for the given user.
 * Priority: user-specific config → global config → inline defaults.
 * Always returns a complete config (never throws).
 */
export async function getAggregatorConfig(userId: string): Promise<AggregatorConfig & { _source: string }> {
  const cacheKey = getCacheKey(userId)
  const cached = _configCache.get(cacheKey)
  if (cached && isCacheValid(cached)) {
    return { ...cached.config, _source: cached.source }
  }

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // Try user-specific config first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userConfig } = await (supabase as any)
      .from('aggregator_config')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (userConfig) {
      const config = { ...(userConfig as AggregatorConfig), user_id: userId }
      _configCache.set(cacheKey, { config, loaded_at: Date.now(), source: 'db_user' })
      return { ...config, _source: 'db_user' }
    }

    // Fall back to global defaults from DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: globalConfig } = await (supabase as any)
      .from('aggregator_config')
      .select('*')
      .is('user_id', null)
      .single()

    if (globalConfig) {
      const config = { ...(globalConfig as AggregatorConfig), user_id: userId }
      _configCache.set(cacheKey, { config, loaded_at: Date.now(), source: 'db_global' })
      return { ...config, _source: 'db_global' }
    }

    throw new Error('No config found in DB')

  } catch (err) {
    console.warn('[AggregatorConfig] DB unavailable, using inline defaults:', err instanceof Error ? err.message : err)
    const config = { ...DEFAULT_AGGREGATOR_CONFIG, user_id: userId }
    _configCache.set(cacheKey, { config, loaded_at: Date.now(), source: 'fallback' })
    return { ...config, _source: 'fallback' }
  }
}
