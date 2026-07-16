import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runEvidenceAggregator } from '@/lib/intelligence/evidence-aggregator'

/**
 * POST /api/intelligence/aggregate
 * Triggers the Evidence Aggregator for the current authenticated user.
 * Used by Brand Builder tab and future cron jobs.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { trigger_type?: string }
  const triggerType = (['manual', 'scheduled', 'post_onboarding'].includes(body.trigger_type ?? ''))
    ? body.trigger_type as 'manual' | 'scheduled' | 'post_onboarding'
    : 'manual'

  try {
    const result = await runEvidenceAggregator(user.id, triggerType)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado'
    console.error('[Evidence Aggregator] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
