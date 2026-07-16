import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invalidateAggregatorConfigCache } from '@/lib/intelligence/config'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json() as Record<string, unknown>

  // Remove read-only fields
  const { id: _id, created_at: _ca, updated_at: _ua, _source: _src, ...configData } = body

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('aggregator_config')
      .upsert({ ...configData, user_id: user.id, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Invalidate cache for this user
    invalidateAggregatorConfigCache(user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error inesperado' }, { status: 500 })
  }
}
