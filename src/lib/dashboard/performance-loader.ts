'use server'

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PerformanceMetrics, WeeklyComparison } from '@/types/database'

type AnyClient = SupabaseClient

export async function loadPerformanceData(): Promise<PerformanceMetrics | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const client = supabase as unknown as AnyClient
  const now = new Date()
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  // thirtyDaysAgo: used in specific sub-queries below via ninetyDaysAgo window
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [
    contenidosAll,
    contenidosMes,
    aiUsageAll,
    aiUsageMes,
    complianceLogs,
    objectionData,
    aggregatorRuns,
    profileData,
  ] = await Promise.all([
    // All content (for product + canal breakdown)
    client.from('contenidos')
      .select('producto, plataforma, status, created_at')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(500),

    // This month's content
    client.from('contenidos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .gte('created_at', currentPeriod),

    // All AI usage for total calls
    client.from('ai_usage')
      .select('modulo, costo_usd')
      .eq('user_id', user.id),

    // This month's AI usage
    client.from('ai_usage')
      .select('modulo, costo_usd')
      .eq('user_id', user.id)
      .eq('periodo_mes', currentPeriod),

    // Compliance reviews (last 90 days)
    client.from('compliance_logs')
      .select('risk_level, created_at')
      .eq('user_id', user.id)
      .gte('created_at', ninetyDaysAgo),

    // Objection responses (last 90 days)
    client.from('objection_responses')
      .select('objecion_tipo, fue_util, producto, created_at')
      .eq('user_id', user.id)
      .gte('created_at', ninetyDaysAgo),

    // Aggregator runs summary
    client.from('evidence_aggregator_runs')
      .select('inferences_proposed, inferences_skipped, ran_at')
      .eq('user_id', user.id)
      .order('ran_at', { ascending: false })
      .limit(30),

    // Profile score + activation dates
    client.from('profiles')
      .select('first_value_generated_at, onboarding_completed, created_at')
      .eq('id', user.id)
      .single(),
  ])

  const contenidosData = (contenidosAll.data ?? []) as Array<Record<string, unknown>>

  // Content breakdown
  const contenidosPorProducto: Record<string, number> = {}
  const contenidosPorCanal: Record<string, number> = {}

  for (const c of contenidosData) {
    const prod = (c.produto as string | null) ?? (c.producto as string | null) ?? 'otro'
    const canal = (c.plataforma as string | null) ?? 'otro'
    contenidosPorProducto[prod] = (contenidosPorProducto[prod] ?? 0) + 1
    contenidosPorCanal[canal] = (contenidosPorCanal[canal] ?? 0) + 1
  }

  // AI usage breakdown
  const aiAllData = (aiUsageAll.data ?? []) as Array<{ modulo: string; costo_usd: number }>
  const aiMesData = (aiUsageMes.data ?? []) as Array<{ modulo: string; costo_usd: number }>

  const aiPorModulo: Record<string, number> = {}
  for (const u of aiAllData) {
    aiPorModulo[u.modulo] = (aiPorModulo[u.modulo] ?? 0) + 1
  }

  const costoMes = aiMesData.reduce((sum, u) => sum + (u.costo_usd ?? 0), 0)

  // Compliance breakdown
  const compData = (complianceLogs.data ?? []) as Array<{ risk_level: string | null }>
  const riskCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 }
  for (const c of compData) {
    const r = (c.risk_level ?? 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH'
    if (r in riskCounts) riskCounts[r]++
  }

  // Objection breakdown
  const objData = (objectionData.data ?? []) as Array<{ objecion_tipo: string | null; fue_util: string | null }>
  const objPorTipo: Record<string, number> = {}
  let objUtil = 0

  for (const o of objData) {
    if (o.objecion_tipo) {
      objPorTipo[o.objecion_tipo] = (objPorTipo[o.objecion_tipo] ?? 0) + 1
    }
    if (o.fue_util === 'si') objUtil++
  }

  const objUtilRate = objData.length > 0 ? Math.round((objUtil / objData.length) * 100) : 0

  // Aggregator stats
  const runsData = (aggregatorRuns.data ?? []) as Array<{ inferences_proposed: number; inferences_skipped: number }>
  const totalProposed = runsData.reduce((s, r) => s + (r.inferences_proposed ?? 0), 0)
  const totalSkipped = runsData.reduce((s, r) => s + (r.inferences_skipped ?? 0), 0)

  // Profile
  const profileRow = (profileData.data as Record<string, unknown> | null) ?? {}

  // Intel profile score
  const { data: intelData } = await client
    .from('agent_intelligence_profiles')
    .select('score_perfil_completitud, inferencias_pendientes, inference_rejection_log')
    .eq('user_id', user.id)
    .single()

  const intel = (intelData as Record<string, unknown> | null) ?? {}
  const rejectionLog = (intel.inference_rejection_log as unknown[]) ?? []
  const inferenciasRechazadas = rejectionLog.length

  return {
    contenidos_total:           contenidosData.length,
    contenidos_mes:             contenidosMes.count ?? 0,
    contenidos_por_producto:    contenidosPorProducto,
    contenidos_por_canal:       contenidosPorCanal,
    ai_calls_total:             aiAllData.length,
    ai_calls_mes:               aiMesData.length,
    ai_calls_por_modulo:        aiPorModulo,
    costo_usd_mes:              costoMes,
    compliance_checks:          compData.length,
    compliance_risk_low:        riskCounts.LOW,
    compliance_risk_medium:     riskCounts.MEDIUM,
    compliance_risk_high:       riskCounts.HIGH,
    objections_total:           objData.length,
    objections_por_tipo:        objPorTipo,
    objections_util_rate:       objUtilRate,
    inferencias_propuestas:     totalProposed,
    inferencias_aprobadas:      totalProposed - totalSkipped,
    inferencias_rechazadas:     inferenciasRechazadas,
    perfil_score:               (intel.score_perfil_completitud as number) ?? 0,
    first_value_generated_at:   (profileRow.first_value_generated_at as string | null) ?? null,
    onboarding_completed_at:    null,
    weekly_comparison:          null,
  }
}

// ─── Phase 17: Weekly comparison ─────────────────────────────────────────────

const MINIMUM_EVENTS_FOR_TREND = 5  // Minimum events in a period to show a trend

export async function loadWeeklyComparison(userId: string): Promise<WeeklyComparison> {
  const supabase = await createClient()
  const client = supabase as unknown as AnyClient

  const now = new Date()
  // Current week: last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  // Previous week: 8-14 days ago
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // ISO week keys
  const getWeekKey = (d: Date) => {
    const date = new Date(d)
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
    const week1 = new Date(date.getFullYear(), 0, 4)
    const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
    return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
  }

  const currentPeriod = getWeekKey(now)
  const previousPeriod = getWeekKey(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))

  // Count events in current and previous week
  const [wCurrentC, wPrevC, wCurrentAI, wPrevAI, wCurrentO, wPrevO] = await Promise.all([
    client.from('contenidos').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', sevenDaysAgo).is('deleted_at', null),
    client.from('contenidos').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', fourteenDaysAgo).lt('created_at', sevenDaysAgo).is('deleted_at', null),
    client.from('ai_usage').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', sevenDaysAgo),
    client.from('ai_usage').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', fourteenDaysAgo).lt('created_at', sevenDaysAgo),
    client.from('objection_responses').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', sevenDaysAgo),
    client.from('objection_responses').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', fourteenDaysAgo).lt('created_at', sevenDaysAgo),
  ])

  const currC = (wCurrentC as { count?: number }).count ?? 0
  const prevC = (wPrevC as { count?: number }).count ?? 0
  const currAI = (wCurrentAI as { count?: number }).count ?? 0
  const prevAI = (wPrevAI as { count?: number }).count ?? 0
  const currO = (wCurrentO as { count?: number }).count ?? 0
  const prevO = (wPrevO as { count?: number }).count ?? 0

  const totalCurrentEvents = currC + currAI + currO

  // Minimum data check — Decisión D: no fabricated trends
  if (totalCurrentEvents < MINIMUM_EVENTS_FOR_TREND || (prevC + prevAI + prevO) < MINIMUM_EVENTS_FOR_TREND) {
    return {
      has_sufficient_data: false,
      minimum_events_required: MINIMUM_EVENTS_FOR_TREND,
      current_period: currentPeriod,
      previous_period: previousPeriod,
      reason_if_insufficient: totalCurrentEvents < MINIMUM_EVENTS_FOR_TREND
        ? `Esta semana solo tienes ${totalCurrentEvents} evento(s). Se necesitan al menos ${MINIMUM_EVENTS_FOR_TREND} para calcular una tendencia.`
        : `La semana anterior tiene pocos eventos para comparar. Sigue usando la plataforma para ver tendencias.`,
    }
  }

  return {
    has_sufficient_data: true,
    minimum_events_required: MINIMUM_EVENTS_FOR_TREND,
    current_period: currentPeriod,
    previous_period: previousPeriod,
    contenidos_delta: currC - prevC,
    ai_calls_delta: currAI - prevAI,
    objections_delta: currO - prevO,
  }
}
