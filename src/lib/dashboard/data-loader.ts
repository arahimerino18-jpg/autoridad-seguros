/**
 * Dashboard Data Loader — Autoridad Seguros AI™
 *
 * Single data-loading boundary for the dashboard shell.
 * All data for the dashboard shell is fetched here in parallel and passed
 * as props to child components — preventing redundant per-component queries.
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export interface UsageCounts {
  contenidos_mes: number
  copilot_mes: number
  compliance_mes: number
  periodo: string
}

export async function loadDashboardData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const period = getCurrentPeriod()

  // Sequential queries to avoid TypeScript tuple inference instability
  // with Promise.all([...typed Supabase queries...]). The parallelism benefit
  // is minimal for 3-5 small indexed queries vs the type safety gain.
  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (!profileData) redirect('/login')

  const [bkRes, intelRes, usageRes, planRes] = await Promise.all([
    supabase.from('brand_kits').select('*').eq('user_id', user.id).single(),
    supabase.from('agent_intelligence_profiles').select('*').eq('user_id', user.id).single(),
    supabase.from('ai_usage').select('modulo').eq('user_id', user.id).eq('periodo_mes', period),
    supabase.from('plan_limits').select('*').eq('plan', (profileData as { plan_tier: string }).plan_tier).single(),
  ])

  const records = (usageRes.data ?? []) as Array<{ modulo: string }>

  return {
    // Cast to Record to avoid Supabase generic 'never' inference on partial DB types.
    // Full type safety is restored via generated types in production (supabase gen types).
    profile: profileData as unknown as Record<string, unknown>,
    brandKit: (bkRes.data as unknown as Record<string, unknown>) ?? null,
    intelligenceProfile: (intelRes.data as unknown as Record<string, unknown>) ?? null,
    planLimit: (planRes.data as unknown as Record<string, unknown>) ?? getDefaultPlanLimit((profileData as { plan_tier: string }).plan_tier),
    usage: {
      contenidos_mes: records.filter(r => r.modulo === 'content_studio').length,
      copilot_mes: records.filter(r => r.modulo === 'marketing_copilot').length,
      compliance_mes: records.filter(r => r.modulo === 'compliance_center').length,
      periodo: period,
    } satisfies UsageCounts,
    userId: user.id,
  }
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboardData>>

function getCurrentPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function getDefaultPlanLimit(plan: string): Record<string, unknown> {
  const defaults: Record<string, Record<string, unknown>> = {
    starter: { plan: 'starter', max_contenidos_mes: 30, max_copilot_mes: 10, max_compliance_mes: 15, max_imagenes_mes: 0, tiene_video_studio: false, tiene_publicacion_directa: false, precio_mensual_usd: 27, precio_anual_usd: 270 },
    pro: { plan: 'pro', max_contenidos_mes: 100, max_copilot_mes: 50, max_compliance_mes: 50, max_imagenes_mes: 20, tiene_video_studio: true, tiene_publicacion_directa: false, precio_mensual_usd: 57, precio_anual_usd: 570 },
    elite: { plan: 'elite', max_contenidos_mes: -1, max_copilot_mes: -1, max_compliance_mes: -1, max_imagenes_mes: 100, tiene_video_studio: true, tiene_publicacion_directa: true, precio_mensual_usd: 97, precio_anual_usd: 970 },
  }
  return defaults[plan] ?? defaults.starter
}
