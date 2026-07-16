import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runEvidenceAggregator } from '@/lib/intelligence/evidence-aggregator'

/**
 * GET /api/cron/run-aggregator
 *
 * Weekly cron job to run the Evidence Aggregator for all active users.
 * Called by Vercel Cron (configured in vercel.json).
 * Also callable manually for testing.
 *
 * Authorization: Bearer $CRON_SECRET header
 *
 * vercel.json schedule: "0 10 * * 1"  // Monday 10am UTC (after cleanup at 9am)
 *
 * Idempotent: running twice in the same period produces the same result
 * (duplicates are blocked by isAlreadyPending check in the aggregator).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const triggerType = request.headers.get('x-vercel-cron') === '1' ? 'scheduled' : 'manual'
  const startedAt = new Date().toISOString()
  const supabase = createAdminClient()
  let runId: string | null = null

  try {
    // Log start
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: runData } = await (supabase as any)
      .from('cron_job_runs')
      .insert({
        job_name:     'run_evidence_aggregator',
        trigger_type: triggerType,
        status:       'running',
        started_at:   startedAt,
      })
      .select('id')
      .single()
    runId = (runData as { id: string } | null)?.id ?? null

    // Get users who have completed onboarding (only run for active users)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: users } = await (supabase as any)
      .from('profiles')
      .select('id')
      .or('onboarding_completed.eq.true,onboarding_done.eq.true')

    const activeUsers = (users ?? []) as Array<{ id: string }>

    let totalProposed = 0
    let totalSkipped = 0
    let usersProcessed = 0
    const errors: string[] = []

    for (const userRow of activeUsers) {
      try {
        const result = await runEvidenceAggregator(userRow.id, 'scheduled')
        totalProposed += result.proposed
        totalSkipped  += result.skipped
        usersProcessed++
      } catch (err) {
        errors.push(`user:${userRow.id} — ${err instanceof Error ? err.message : 'unknown'}`)
      }
    }

    const completedAt = new Date().toISOString()

    if (runId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('cron_job_runs')
        .update({
          status:           errors.length === 0 ? 'completed' : 'completed',
          completed_at:     completedAt,
          users_processed:  usersProcessed,
          records_affected: totalProposed,
          metadata: {
            total_active_users: activeUsers.length,
            total_proposed: totalProposed,
            total_skipped:  totalSkipped,
            errors:         errors.slice(0, 10), // cap error list
          },
        })
        .eq('id', runId)
    }

    return NextResponse.json({
      success:          true,
      users_processed:  usersProcessed,
      inferences_proposed: totalProposed,
      inferences_skipped:  totalSkipped,
      errors_count:     errors.length,
      trigger:          triggerType,
      completed_at:     completedAt,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[Cron] run-aggregator failed:', msg)

    if (runId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('cron_job_runs')
        .update({ status: 'failed', completed_at: new Date().toISOString(), error_message: msg })
        .eq('id', runId)
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
