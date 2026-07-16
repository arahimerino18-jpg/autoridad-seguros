import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateWeeklyBriefing } from '@/lib/briefing/generator'

/**
 * GET /api/cron/briefing-lunes
 *
 * Weekly cron: generates Monday briefing for all active users.
 * Schedule: Monday 7am UTC (before cleanup at 9am, aggregator at 10am)
 *
 * vercel.json: "0 7 * * 1"
 *
 * Idempotent: re-running the same week skips users who already have a briefing.
 * Error isolation: one user failure does not stop processing of others.
 * Cost control: ~$0.010/user/week — logged in ai_usage AND cron_job_runs.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const triggerType = request.headers.get('x-vercel-cron') === '1' ? 'cron' : 'manual'
  const startedAt = new Date().toISOString()
  const supabase = createAdminClient()
  let runId: string | null = null

  // Log start
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: runData } = await (supabase as any)
      .from('cron_job_runs')
      .insert({ job_name: 'briefing_lunes', trigger_type: triggerType, status: 'running', started_at: startedAt })
      .select('id').single()
    runId = (runData as { id: string } | null)?.id ?? null
  } catch { /* non-critical */ }

  try {
    // Get active users (onboarding completed, not canceled)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: users } = await (supabase as any)
      .from('profiles')
      .select('id, nombre_completo, plan_tier')
      .eq('onboarding_completed', true)
      .limit(500)

    const activeUsers = (users ?? []) as Array<{ id: string; nombre_completo: string; plan_tier: string }>

    let generated = 0
    let skipped = 0
    let errors = 0

    for (const user of activeUsers) {
      try {
        const result = await generateWeeklyBriefing(
          user.id,
          supabase as unknown as Parameters<typeof generateWeeklyBriefing>[1],
          triggerType as 'cron' | 'manual'
        )
        if (result.alreadyExists) skipped++
        else if (result.briefing) generated++
        else errors++
      } catch {
        errors++
      }
    }

    const completedAt = new Date().toISOString()

    if (runId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('cron_job_runs').update({
        status: 'completed',
        completed_at: completedAt,
        users_processed: activeUsers.length,
        records_affected: generated,
        metadata: { generated, skipped, errors },
      }).eq('id', runId)
    }

    return NextResponse.json({ success: true, generated, skipped, errors, trigger: triggerType })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    if (runId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('cron_job_runs').update({
        status: 'failed', completed_at: new Date().toISOString(), error_message: msg
      }).eq('id', runId)
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
