import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateWeeklyBriefing, getISOWeekKey } from '@/lib/briefing/generator'
import type { SupabaseClient } from '@supabase/supabase-js'

type AnyClient = SupabaseClient

/**
 * GET /api/briefing — Returns current week's briefing (or last available)
 * POST /api/briefing — Generates a new briefing manually (respects idempotency)
 */

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { key } = getISOWeekKey()
  const client = supabase as unknown as AnyClient

  // Try current week first, then last available
  const { data: current } = await client
    .from('weekly_briefings')
    .select('*')
    .eq('user_id', user.id)
    .eq('periodo_key', key)
    .single()

  if (current) return NextResponse.json({ briefing: current, is_current_week: true })

  // Fall back to last available
  const { data: last } = await client
    .from('weekly_briefings')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ briefing: last ?? null, is_current_week: false })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { force?: boolean }

  // If force=true, delete existing week's briefing first (allows re-generation for testing)
  if (body.force) {
    const { key } = getISOWeekKey()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('weekly_briefings')
      .delete()
      .eq('user_id', user.id)
      .eq('periodo_key', key)
  }

  const result = await generateWeeklyBriefing(
    user.id,
    supabase as unknown as Parameters<typeof generateWeeklyBriefing>[1],
    'api'
  )

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    briefing: result.briefing,
    already_existed: result.alreadyExists,
  })
}
