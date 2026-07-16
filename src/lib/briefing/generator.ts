/**
 * Autoridad Seguros AI™ — Weekly Briefing Generator
 *
 * Generates a personalized Monday briefing for each agent using:
 *   - Agent Intelligence Profile (build_agent_context)
 *   - Performance metrics (contenidos, objeciones, compliance)
 *   - Goals and calendar events
 *   - Seasonal insurance context
 *
 * IDEMPOTENCY: one briefing per user per ISO week.
 * Calling generateBriefing() twice in the same week returns the existing one.
 *
 * COST CONTROL: each briefing costs ~$0.008–$0.015 (claude-sonnet-4-6, ~400 tokens out)
 * Logged in ai_usage AND weekly_briefings.costo_usd.
 */

import Anthropic from '@anthropic-ai/sdk'
import { BRIEFING_LUNES_PROMPT } from '@/lib/growth-engine/prompts'
import { buildCopilotContext } from '@/lib/growth-engine/context-builder'
import type { WeeklyBriefing } from '@/types/database'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── ISO week key ─────────────────────────────────────────────────────────────

export function getISOWeekKey(date = new Date()): { year: number; week: number; key: string } {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  const year = d.getFullYear()
  return { year, week: weekNum, key: `${year}-W${String(weekNum).padStart(2, '0')}` }
}

// ─── Generate briefing ────────────────────────────────────────────────────────

export interface GenerateBriefingResult {
  briefing: WeeklyBriefing | null
  alreadyExists: boolean
  error?: string
}

export async function generateWeeklyBriefing(
  userId: string,
  supabaseClient: { from: (t: string) => unknown; rpc: (fn: string, args: unknown) => unknown },
  triggerType: 'cron' | 'manual' | 'api' = 'manual'
): Promise<GenerateBriefingResult> {
  const client = supabaseClient as unknown as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (t: string) => any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rpc: (fn: string, args: unknown) => any
  }

  const { year, week, key: periodoKey } = getISOWeekKey()

  // ── Idempotency check ──────────────────────────────────────────────────────
  const { data: existing } = await client
    .from('weekly_briefings')
    .select('*')
    .eq('user_id', userId)
    .eq('periodo_key', periodoKey)
    .single()

  if (existing) {
    return { briefing: existing as WeeklyBriefing, alreadyExists: true }
  }

  // ── Load agent context ─────────────────────────────────────────────────────
  const { formatted: agentContext } = await buildCopilotContext(userId, {
    includeHistory: true,
    daysHistory: 30,
  })

  // ── Load performance signals for this week ─────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [contenidosRes, objeccionesRes, aiUsageRes] = await Promise.all([
    client.from('contenidos')
      .select('producto, tipo, created_at, status, compliance_revisado')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo)
      .is('deleted_at', null)
      .limit(50),
    client.from('objection_responses')
      .select('objecion_tipo, producto, fue_util, created_at')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo)
      .limit(30),
    client.from('ai_usage')
      .select('modulo, created_at')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo)
      .limit(100),
  ])

  const contenidos = (contenidosRes.data ?? []) as Array<{ producto: string; tipo: string; status: string }>
  const objeciones = (objeccionesRes.data ?? []) as Array<{ objecion_tipo: string; fue_util: string | null }>
  const aiUsage = (aiUsageRes.data ?? []) as Array<{ modulo: string }>

  // ── Build performance summary for prompt ──────────────────────────────────
  const productosCounts = contenidos.reduce<Record<string, number>>((acc, c) => {
    acc[c.producto] = (acc[c.producto] ?? 0) + 1
    return acc
  }, {})
  const moduleCounts = aiUsage.reduce<Record<string, number>>((acc, u) => {
    acc[u.modulo] = (acc[u.modulo] ?? 0) + 1
    return acc
  }, {})
  const objecionesUtiles = objeciones.filter(o => o.fue_util === 'si').length

  // Load agent goals
  const { data: goalsData } = await client
    .from('agent_goals')
    .select('meta_tipo, meta_valor, progreso_actual, periodo')
    .eq('user_id', userId)
    .limit(5)
  const goals = (goalsData ?? []) as Array<{ meta_tipo: string; meta_valor: number; progreso_actual: number; periodo: string }>

  // ── Seasonal context ──────────────────────────────────────────────────────
  const month = new Date().getMonth() + 1
  const seasonalContexts: Record<number, string> = {
    1:  'Enero: período de inscripción abierta de Medicare (AEP) aún activo en algunas áreas. Muchos prospectos tomando decisiones de salud para el año nuevo.',
    2:  'Febrero: fin de AEP. Buen momento para seguimiento post-inscripción y prospección IUL.',
    3:  'Marzo: período especial de inscripción ACA activo. Temporada de impuestos — oportunidad para conversaciones sobre planificación financiera.',
    4:  'Abril: temporada de impuestos. Conversaciones sobre ahorro y protección familiar. Buena época para IUL y vida.',
    5:  'Mayo: inicio de temporada de huracanes en Florida. Conversaciones sobre protección del hogar y familia.',
    6:  'Junio: temporada de huracanes activa. Sensibilidad alta a temas de protección.',
    7:  'Julio: mitad de año. Buenos momentos para revisión de cobertura y actualización de beneficiarios.',
    8:  'Agosto: pre-temporada de inscripción. Tiempo de construir pipeline antes de AEP.',
    9:  'Septiembre: inicio de AEP el 15. Máxima preparación para Medicare Advantage.',
    10: 'Octubre: AEP en pleno apogeo (15 oct – 7 dic). Temporada más activa del año para Medicare.',
    11: 'Noviembre: AEP activo. Período de inscripción ACA comienza el 1 de noviembre.',
    12: 'Diciembre: fin de AEP (7 dic). Cierre de año — inscripción ACA activa hasta el 15 de ene.',
  }
  const seasonalContext = seasonalContexts[month] ?? ''

  // ── Build enriched prompt ─────────────────────────────────────────────────
  const enrichedPrompt = [
    '=== SEMANA ===',
    `Semana ${week} del año ${year} — ${new Date().toLocaleDateString('es-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
    '',
    '=== CONTEXTO DEL AGENTE ===',
    agentContext,
    '',
    '=== ACTIVIDAD ÚLTIMOS 30 DÍAS ===',
    `Contenido generado: ${contenidos.length} piezas — Productos: ${Object.entries(productosCounts).map(([k, v]) => `${k}(${v})`).join(', ') || 'ninguno'}`,
    `Objeciones analizadas: ${objeciones.length} — Útiles: ${objecionesUtiles}`,
    `Módulos más usados: ${Object.entries(moduleCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}(${v})`).join(', ') || 'ninguno'}`,
    goals.length > 0 ? `Objetivos activos: ${goals.map(g => `${g.meta_tipo}: ${g.progreso_actual}/${g.meta_valor} (${g.periodo})`).join('; ')}` : '',
    '',
    seasonalContext ? `=== CONTEXTO ESTACIONAL ===\n${seasonalContext}` : '',
    '',
    '=== INSTRUCCIÓN ===',
    'Genera el briefing semanal. Distingue claramente:',
    '- Recomendaciones basadas en datos reales del agente (marca como [DATO])',
    '- Recomendaciones basadas en estacionalidad (marca como [TEMPORADA])',
    '- Hipótesis estratégicas (marca como [HIPÓTESIS])',
    'NO inventes métricas ni asegures resultados específicos.',
  ].filter(Boolean).join('\n')

  // ── Generate with Claude ──────────────────────────────────────────────────
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: BRIEFING_LUNES_PROMPT,
      messages: [{ role: 'user', content: enrichedPrompt }],
    })

    const texto = response.content[0]?.type === 'text' ? response.content[0].text : ''
    if (!texto) throw new Error('Empty response from Claude')

    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens
    const costUsd = tokensUsed * 0.000003  // Sonnet approximate

    // ── Save briefing ─────────────────────────────────────────────────────
    const { data: saved, error: saveError } = await client
      .from('weekly_briefings')
      .insert({
        user_id:        userId,
        year,
        week_number:    week,
        periodo_key:    periodoKey,
        briefing_texto: texto,
        trigger_type:   triggerType,
        context_layers: ['agent_data', 'performance', 'seasonality', 'goals'],
        tokens_used:    tokensUsed,
        costo_usd:      costUsd,
      })
      .select()
      .single()

    if (saveError) throw new Error(saveError.message)

    // ── Log ai_usage ──────────────────────────────────────────────────────
    const period = new Date().toISOString().slice(0, 7) + '-01'
    await client.from('ai_usage').insert({
      user_id:      userId,
      modulo:       'briefing_lunes',
      operacion:    'weekly_briefing_generate',
      tokens_total: tokensUsed,
      costo_usd:    costUsd,
      fue_cacheado: false,
      periodo_mes:  period,
    })

    const briefingResult = saved as WeeklyBriefing

    // Email notification is handled by the API route caller (/api/briefing POST)
    // where the authenticated user's email is available via supabase.auth.getUser()

    return { briefing: briefingResult, alreadyExists: false }

  } catch (err) {
    return {
      briefing:     null,
      alreadyExists: false,
      error:        err instanceof Error ? err.message : 'Error al generar briefing',
    }
  }
}
