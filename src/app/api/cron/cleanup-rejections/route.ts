import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/cron/cleanup-rejections
 *
 * Weekly cron job to clean up archived rejection log entries.
 * Called by Vercel Cron (configured in vercel.json).
 * Also callable manually via API for testing.
 *
 * Authorization:
 *   - Vercel Cron: CRON_SECRET header (set in environment)
 *   - Manual: same CRON_SECRET header required
 *
 * Idempotent: safe to run multiple times.
 * Non-interfering: only touches inference_rejection_log JSONB, not other columns.
 *
 * vercel.json cron config:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-rejections",
 *     "schedule": "0 9 * * 1"   // Every Monday at 9am UTC
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const triggerType = request.headers.get('x-vercel-cron') === '1' ? 'scheduled' : 'manual'
  const startedAt = new Date().toISOString()
  const supabase = createAdminClient()
  let runId: string | null = null

  // Log the job start
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: runData } = await (supabase as any)
      .from('cron_job_runs')
      .insert({
        job_name: 'cleanup_rejection_log',
        trigger_type: triggerType,
        status: 'running',
        started_at: startedAt,
      })
      .select('id')
      .single()
    runId = (runData as { id: string } | null)?.id ?? null
  } catch { /* non-critical */ }

  try {
    // Get all users who have rejection logs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: users } = await (supabase as any)
      .from('agent_intelligence_profiles')
      .select('user_id, inference_rejection_log')
      .not('inference_rejection_log', 'eq', '[]')

    const usersWithRejections = (users ?? []) as Array<{
      user_id: string
      inference_rejection_log: Array<{ estado?: string; evidence_count_at_rejection?: number; rechazado_en?: string }>
    }>

    let totalRemoved = 0
    let usersProcessed = 0

    for (const userRow of usersWithRejections) {
      try {
        // Call the PostgreSQL cleanup function per user
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: removed } = await (supabase as any).rpc('cleanup_archived_rejections', {
          p_user_id: userRow.user_id,
        })
        if ((removed as number) > 0) {
          totalRemoved += removed as number
        }
        usersProcessed++
      } catch { /* continue with next user */ }
    }

    const completedAt = new Date().toISOString()

    // Update the run log
    if (runId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('cron_job_runs')
        .update({
          status: 'completed',
          completed_at: completedAt,
          users_processed: usersProcessed,
          records_affected: totalRemoved,
          metadata: {
            total_users_with_rejections: usersWithRejections.length,
            users_processed: usersProcessed,
            total_removed: totalRemoved,
          },
        })
        .eq('id', runId)
    }

    return NextResponse.json({
      success: true,
      users_processed: usersProcessed,
      records_removed: totalRemoved,
      trigger: triggerType,
      completed_at: completedAt,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[Cron] cleanup-rejections failed:', msg)

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
