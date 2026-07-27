/**
 * Dashboard Data Loader — Autoridad Seguros AI™
 *
 * BASE: commit 4f6c572
 * FIX: removed redirect('/login') when user is null.
 *   Reason: middleware already blocks unauthenticated access.
 *   When data-loader also redirected to /login, it contradicted the middleware
 *   (which had already redirected /login → /dashboard), creating the loop.
 *   If middleware passed the request through, the user IS authenticated.
 *   A null user here means a cookie propagation edge case in Vercel —
 *   throwing an error is safer than creating an infinite redirect.
 */

import { createClient } from '@/lib/supabase/server'

export interface UsageCounts {
  contenidos_mes: number
  copilot_mes: number
  compliance_mes: number
  periodo: string
}

export async function loadDashboardData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // FIX: do NOT redirect to /login here.
  // Middleware is the single authority on authentication.
  // Redirecting to /login from here caused: middleware→/dashboard, loader→/login, loop.
  // If user is null despite middleware passing through, throw (shows error page, not loop).
  if (!user) {
    throw new Error('Session unavailable — please refresh the page.')
  }

  const period = getCurrentPeriod()

  const { data: profileData } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  // FIX: also do NOT redirect to /login if profile is missing — it is a data error, not auth.
  if (!profileData) {
    throw new Error('Profile not found — please contact support.')
  }

  const [bkRes, intelRes, usageRes, planRes] = await Promise.all([
    supabase.from('brand_kits').select('*').eq('user_id', user.id).single(),
    supabase.from('agent_intelligence_profiles').select('*').eq('user_id', user.id).single(),
    supabase.from('ai_usage').select('modulo').eq('user_id', user.id).eq('periodo_mes', period),
    supabase.from('plan_limits').select('*').eq('plan', (profileData as { plan_tier: string }).plan_tier).single(),
  ])

  const records = (usageRes.data ?? []) as Array<{ modulo: string }>

  return {
    profile: profileData as unknown as Record<string, unknown>,
    brandKit: (bkRes.data as unknown as Record<string, unknown>) ?? null,
    intelligenceProfile: (intelRes.data as unknown as Record<string, unknown>) ?? null,
    planLimit: (planRes.data as unknown as Record<string, unknown>) ?? getDefaultPlanLimit((profileData as { plan_tier: string }).plan_tier),
    usage: {
      contenidos_mes: records.filter(r => r.modulo === 'content_studio').length,
      copilot_mes:    records.filter(r => r.modulo === 'marketing_copilot').length,
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
    starter: { plan: 'starter', max_contenidos_mes: 30,  max_copilot_mes: 10, max_compliance_mes: 15,  max_imagenes_mes: 0,   tiene_video_studio: false, tiene_publicacion_directa: false, precio_mensual_usd: 27, precio_anual_usd: 270 },
    pro:     { plan: 'pro',     max_contenidos_mes: 100, max_copilot_mes: 50, max_compliance_mes: 50,  max_imagenes_mes: 20,  tiene_video_studio: true,  tiene_publicacion_directa: false, precio_mensual_usd: 57, precio_anual_usd: 570 },
    elite:   { plan: 'elite',   max_contenidos_mes: -1,  max_copilot_mes: -1, max_compliance_mes: -1,  max_imagenes_mes: 100, tiene_video_studio: true,  tiene_publicacion_directa: true,  precio_mensual_usd: 97, precio_anual_usd: 970 },
  }
  return defaults[plan] ?? defaults.starter
}
