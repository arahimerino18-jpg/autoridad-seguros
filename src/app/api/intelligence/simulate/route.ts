import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AggregatorConfig, InferenciaPendienteV2 } from '@/types/database'
import { getComplianceRulesCacheStatus } from '@/lib/compliance/engine'

type AnyClient = SupabaseClient

/**
 * POST /api/intelligence/simulate
 *
 * Runs the Evidence Aggregator in dry-run (sandbox) mode.
 * Uses the config passed in the request body (NOT the saved user config).
 * Does NOT write inferencias_pendientes or evidence_aggregator_runs.
 * Returns what WOULD happen if this config were applied.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json() as { config: AggregatorConfig }
  const config = body.config

  if (!config) return NextResponse.json({ error: 'Config requerida' }, { status: 400 })

  const client = supabase as unknown as AnyClient

  try {
    // Load current agent state (same as aggregator — read only)
    const { data: profileData } = await client
      .from('agent_intelligence_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!profileData) {
      return NextResponse.json({ proposed: 0, skipped: 0, reasons: ['No profile found'], config_source: 'request' })
    }

    const intelProfile = profileData as Record<string, unknown>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void (intelProfile.inference_rejection_log) // unused in sandbox simulation
    const pendingInferences = (intelProfile.inferencias_pendientes as InferenciaPendienteV2[]) ?? []

    // Import aggregator internals for simulation
    // We re-run the same logic but with the sandbox config, and skip the DB write step
    const { runEvidenceAggregator } = await import('@/lib/intelligence/evidence-aggregator')

    // Temporarily override the config in the aggregator context by passing it via
    // a special dry-run wrapper. Since we can't inject into the running function
    // without refactoring the aggregator signature, we use a different approach:
    // store the sandbox config temporarily and run, then report what was proposed.

    // APPROACH: Run aggregator normally with user's actual config, compare to sandbox config result
    // The sandbox just shows what the signal analysis would find with different thresholds.
    // For a true sandbox, we approximate by checking signals against the sandbox thresholds.

    // Count signals available (mirrors the aggregator rules)
    const ninetyDaysAgo = new Date(Date.now() - config.r1_window_days * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(Date.now() - config.r2_window_days * 24 * 60 * 60 * 1000).toISOString()
    const sixtyDaysAgo = new Date(Date.now() - config.r3_window_days * 24 * 60 * 60 * 1000).toISOString()

    const [objectionData, usageData, contenidosData] = await Promise.all([
      client.from('objection_responses')
        .select('objecion_tipo, fue_util, angulo_copiado, producto, contexto_prospecto')
        .eq('user_id', user.id)
        .gte('created_at', ninetyDaysAgo),
      client.from('ai_usage')
        .select('modulo')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo),
      client.from('contenidos')
        .select('producto')
        .eq('user_id', user.id)
        .gte('created_at', sixtyDaysAgo)
        .is('deleted_at', null),
    ])

    const objections = (objectionData.data ?? []) as Array<{ objecion_tipo: string; fue_util: string | null; angulo_copiado: string | null; producto: string | null; contexto_prospecto: string | null }>
    const usage = (usageData.data ?? []) as Array<{ modulo: string }>
    const contenidos = (contenidosData.data ?? []) as Array<{ producto: string }>

    const reasons: string[] = []
    let proposed = 0
    let skipped = 0

    // Rule 1 simulation
    const tipoCounts = objections.reduce<Record<string, number>>((acc, r) => {
      if (r.objecion_tipo) acc[r.objecion_tipo] = (acc[r.objecion_tipo] ?? 0) + 1
      return acc
    }, {})
    const r1Candidates = Object.entries(tipoCounts).filter(([, c]) => c >= config.r1_min_signals)
    if (r1Candidates.length > 0) {
      const alreadyPending = pendingInferences.filter(p => p.campo === 'objeciones_frecuentes').length > 0
      if (alreadyPending) { skipped++; reasons.push('SKIP_PENDING: objeciones_frecuentes') }
      else { proposed += r1Candidates.length; reasons.push(`PROPOSE: ${r1Candidates.length} objecion tipo(s) (R1)`) }
    } else {
      reasons.push(`SKIP_INSUFFICIENT: ${objections.length}/${config.r1_min_signals} señales R1`)
    }

    // Rule 2 simulation
    const csUsage = usage.filter(u => u.modulo === 'content_studio').length
    if (csUsage >= config.r2_min_sessions) {
      const alreadyPending = pendingInferences.filter(p => p.campo === 'canal_preferido').length > 0
      if (alreadyPending) { skipped++; reasons.push('SKIP_PENDING: canal_preferido') }
      else { proposed++; reasons.push(`PROPOSE: canal_preferido (${csUsage} sesiones, R2)`) }
    } else {
      reasons.push(`SKIP_INSUFFICIENT: ${csUsage}/${config.r2_min_sessions} sesiones R2`)
    }

    // Rule 3 simulation
    const productCounts = [...contenidos, ...objections.filter(o => o.producto)].reduce<Record<string, number>>((acc, r) => {
      const p = (r as Record<string, string>).producto
      if (p) acc[p] = (acc[p] ?? 0) + 1
      return acc
    }, {})
    const totalSignals = Object.values(productCounts).reduce((s, v) => s + v, 0)
    if (totalSignals >= config.r3_min_signals) {
      const alreadyPending = pendingInferences.filter(p => p.campo === 'productos_principales').length > 0
      if (alreadyPending) { skipped++; reasons.push('SKIP_PENDING: productos_principales') }
      else { proposed++; reasons.push(`PROPOSE: productos_principales (${totalSignals} señales, R3)`) }
    } else {
      reasons.push(`SKIP_INSUFFICIENT: ${totalSignals}/${config.r3_min_signals} señales R3`)
    }

    // Rule 4 simulation
    const usefulWithAngle = objections.filter(o => o.fue_util === 'si' && o.angulo_copiado)
    const angleCounts = usefulWithAngle.reduce<Record<string, number>>((acc, r) => {
      if (r.angulo_copiado) acc[r.angulo_copiado] = (acc[r.angulo_copiado] ?? 0) + 1
      return acc
    }, {})
    const topAngle = Object.entries(angleCounts).sort((a, b) => b[1] - a[1])[0]
    if (topAngle && topAngle[1] >= config.r4_min_useful_responses) {
      proposed++
      reasons.push(`PROPOSE: tono_comunicacion (${topAngle[1]} respuestas útiles con ángulo "${topAngle[0]}", R4)`)
    } else {
      reasons.push(`SKIP_INSUFFICIENT: ${topAngle?.[1] ?? 0}/${config.r4_min_useful_responses} respuestas R4`)
    }

    // Rule 5 simulation: mercado_objetivo from prospect context
    const objectionsWithContext = objections.filter(o => o.contexto_prospecto && o.contexto_prospecto.trim())
    if (objectionsWithContext.length >= config.r5_min_prospects) {
      const alreadyPending5 = pendingInferences.filter(p => p.campo === 'mercado_objetivo').length > 0
      const isDeclared5 = (intelProfile.mercado_source as string) === 'declarado'
      if (isDeclared5) { reasons.push('SKIP_DECLARED: mercado_objetivo') }
      else if (alreadyPending5) { skipped++; reasons.push('SKIP_PENDING: mercado_objetivo') }
      else { proposed++; reasons.push(`PROPOSE: mercado_objetivo (${objectionsWithContext.length} prospectos descritos, R5)`) }
    } else {
      reasons.push(`SKIP_INSUFFICIENT: ${objectionsWithContext.length}/${config.r5_min_prospects} prospectos R5`)
    }

    // Rule 6 simulation: ctas_efectivos from useful responses
    const usefulResponses = objections.filter(o => o.fue_util === 'si' && o.angulo_copiado)
    if (usefulResponses.length >= config.r6_min_useful_responses) {
      const alreadyPending6 = pendingInferences.filter(p => p.campo === 'ctas_efectivos').length > 0
      if (alreadyPending6) { skipped++; reasons.push('SKIP_PENDING: ctas_efectivos') }
      else { proposed++; reasons.push(`PROPOSE: ctas_efectivos (${usefulResponses.length} respuestas útiles, R6)`) }
    } else {
      reasons.push(`SKIP_INSUFFICIENT: ${usefulResponses.length}/${config.r6_min_useful_responses} respuestas R6`)
    }

    // Rule 7 simulation: frases_propias from interview sessions
    const { data: sessionsData } = await client
      .from('interview_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed')
    const sessionCount = (sessionsData as unknown as { count?: number } | null)?.count ?? 0
    if (sessionCount >= 1) {
      const currentFrases = (intelProfile.frases_propias as string[] | null) ?? []
      if (currentFrases.length >= config.r7_max_existing_frases) {
        reasons.push(`SKIP_RICH_PROFILE: frases_propias ya tiene ${currentFrases.length} frases`)
      } else {
        reasons.push(`POSSIBLE: frases_propias — ${sessionCount} entrevista(s) completada(s), análisis profundo en ejecución real`)
      }
    } else {
      reasons.push('SKIP_NO_INTERVIEWS: frases_propias requiere entrevista completada')
    }

    // Profile field simulation: what would change in the profile
    const profileSimulation: Record<string, { current: unknown; would_change: boolean; reason: string }> = {}

    // Tono de comunicación
    if (intelProfile.tono_comunicacion) {
      profileSimulation['tono_comunicacion'] = {
        current: intelProfile.tono_comunicacion,
        would_change: false,
        reason: 'Valor actual se mantendría (ya existe)',
      }
    }

    // Mercado objetivo (from R5 analysis)
    if (objectionsWithContext.length >= config.r5_min_prospects) {
      profileSimulation['mercado_objetivo'] = {
        current: intelProfile.mercado_objetivo ?? null,
        would_change: !intelProfile.mercado_objetivo || (intelProfile.mercado_source as string) !== 'declarado',
        reason: `Basado en ${objectionsWithContext.length} prospectos descritos`,
      }
    }

    // CTAs (from R6 analysis)
    if (usefulResponses.length >= config.r6_min_useful_responses) {
      profileSimulation['ctas_efectivos'] = {
        current: intelProfile.ctas_efectivos ?? null,
        would_change: true,
        reason: `${usefulResponses.length} respuestas útiles sugieren CTAs conversacionales`,
      }
    }

    void runEvidenceAggregator // imported but not called in sandbox (avoid side effects)
    void getComplianceRulesCacheStatus // imported for reference

    return NextResponse.json({
      proposed,
      skipped,
      reasons,
      config_source: 'sandbox (sin guardar)',
      profile_simulation: profileSimulation,
      signals_summary: {
        objections_analyzed: objections.length,
        contenidos_analyzed: contenidos.length,
        ai_sessions: usage.length,
        prospects_with_context: objectionsWithContext.length,
        useful_responses: usefulResponses.length,
        completed_interviews: sessionCount,
      },
    })

  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error en simulación' }, { status: 500 })
  }
}
