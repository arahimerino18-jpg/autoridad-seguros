/**
 * AI Growth Engine — Context Builder
 * Autoridad Seguros AI™
 *
 * This is the most critical function in Phase 5.
 * It assembles all available context layers into a structured string
 * that Claude uses to generate intelligent, personalized recommendations.
 *
 * Phase 5: 4 layers available (AGENT_DATA, SEASONALITY, HISTORY, GOALS)
 * Phase 13: 3 more layers (PERFORMANCE, ENGAGEMENT, PATTERNS)
 */

import { createClient } from '@/lib/supabase/server'
import type { CopilotContext, AgentGoals, CalendarEvent } from '@/types/growth-engine'

// ─── Main context builder ─────────────────────────────────────────────────────

export async function buildCopilotContext(
  userId: string,
  options: { includeHistory?: boolean; daysHistory?: number } = {}
): Promise<{ context: CopilotContext; formatted: string }> {
  const { includeHistory = true, daysHistory = 30 } = options
  const supabase = await createClient()

  // Call the PostgreSQL function that assembles all layers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: contextData, error } = await (supabase as any).rpc('build_copilot_context', {
    p_user_id: userId,
    p_include_history: includeHistory,
    p_days_history: daysHistory,
  })

  if (error || !contextData) {
    // Fallback: minimal context
    return {
      context: buildFallbackContext(),
      formatted: 'Contexto del agente no disponible. Proporciona recomendaciones generales.',
    }
  }

  const context = contextData as CopilotContext
  const formatted = formatContextForClaude(context)

  return { context, formatted }
}

// ─── Format context as structured text for Claude ────────────────────────────

function formatContextForClaude(ctx: CopilotContext): string {
  const lines: string[] = []

  // Header
  lines.push('═══════════════════════════════════════════')
  lines.push('CONTEXTO DEL DIRECTOR DE MARKETING')
  lines.push(`Fecha: ${ctx.fecha_actual} (${ctx.dia_semana.trim()})`)
  lines.push(`Versión del motor: ${ctx.engine_version}`)
  lines.push('═══════════════════════════════════════════')
  lines.push('')

  // Layer 1: Agent identity
  lines.push('── IDENTIDAD DEL AGENTE ──────────────────')
  lines.push(ctx.agent_context)
  lines.push('')

  // Layer 3: Upcoming events (most important for timing)
  if (ctx.upcoming_events && ctx.upcoming_events.length > 0) {
    lines.push('── CALENDARIO DE OPORTUNIDADES ───────────')
    const events = ctx.upcoming_events as CalendarEvent[]

    const active = events.filter((e) => e.esta_activo)
    const upcoming = events.filter((e) => !e.esta_activo && (e.dias_hasta_inicio ?? 99) <= 45)

    if (active.length > 0) {
      lines.push('ACTIVOS AHORA:')
      for (const evt of active) {
        lines.push(`  🔴 ${evt.nombre} (termina en ${evt.dias_restantes} días)`)
        if (evt.consejo_marketing) lines.push(`     → ${evt.consejo_marketing}`)
      }
    }

    if (upcoming.length > 0) {
      lines.push('PRÓXIMOS (45 días):')
      for (const evt of upcoming) {
        const urgencia = (evt.dias_hasta_inicio ?? 99) <= 14 ? '⚠️' : (evt.dias_hasta_inicio ?? 99) <= 30 ? '📅' : '🗓'
        lines.push(`  ${urgencia} ${evt.nombre} — en ${evt.dias_hasta_inicio} días (importancia: ${evt.importancia}/5)`)
        if (evt.consejo_marketing) lines.push(`     → ${evt.consejo_marketing}`)
        if (evt.productos_relevantes.length > 0) {
          lines.push(`     Productos: ${evt.productos_relevantes.join(', ')}`)
        }
      }
    }
    lines.push('')
  }

  // Layer 4: Activity history
  if (ctx.activity_summary && ctx.activity_summary.total_generados > 0) {
    lines.push('── HISTORIAL DE ACTIVIDAD (últimos 30 días) ─')
    lines.push(`Total generado: ${ctx.activity_summary.total_generados} piezas`)
    lines.push(`Días activos: ${ctx.activity_summary.dias_activos}`)

    if (ctx.activity_summary.por_modulo) {
      const modulos = Object.entries(ctx.activity_summary.por_modulo)
      if (modulos.length > 0) {
        lines.push('Por módulo:')
        for (const [mod, count] of modulos) {
          lines.push(`  • ${mod}: ${count}`)
        }
      }
    }

    if (ctx.activity_summary.ultimo_uso) {
      const diasSinUsar = Math.floor(
        (Date.now() - new Date(ctx.activity_summary.ultimo_uso).getTime()) / 86400000
      )
      if (diasSinUsar > 3) {
        lines.push(`⚠️ Último uso: hace ${diasSinUsar} días`)
      }
    }
    lines.push('')
  } else {
    lines.push('── HISTORIAL ─────────────────────────────')
    lines.push('Sin historial de generación registrado aún.')
    lines.push('')
  }

  // Layer 6: Goals
  if (ctx.goals) {
    const goals = ctx.goals as AgentGoals
    lines.push('── OBJETIVOS DEL MES ─────────────────────')
    if (goals.meta_leads) lines.push(`Meta de leads: ${goals.meta_leads} (obtenidos: ${goals.leads_obtenidos ?? 0})`)
    if (goals.producto_prioritario) lines.push(`Producto prioritario: ${goals.producto_prioritario}`)
    lines.push(`Objetivo principal: ${goals.objetivo_principal}`)
    lines.push(`Tiempo disponible: ${goals.tiempo_disponible_min} min/día`)
    if (goals.notas) lines.push(`Notas: ${goals.notas}`)
    lines.push('')
  }

  // Available evidence declaration
  lines.push('── CAPAS DE EVIDENCIA DISPONIBLES ────────')
  lines.push(`Datos disponibles: ${ctx.available_layers.filter(Boolean).join(', ')}`)
  lines.push('NOTA: No hay datos de rendimiento/engagement real (disponible en Fase 13).')
  lines.push('')
  lines.push('Cuando no existan datos reales para una conclusión, distingue explícitamente:')
  lines.push('  [DATO DEL AGENTE] — basado en su perfil o historial')
  lines.push('  [ESTACIONALIDAD] — basado en el calendario de seguros')
  lines.push('  [HIPÓTESIS] — recomendación estratégica a validar')
  lines.push('═══════════════════════════════════════════')

  return lines.join('\n')
}

// ─── Fallback context ─────────────────────────────────────────────────────────

function buildFallbackContext(): CopilotContext {
  return {
    agent_context: 'Agente de seguros hispano en USA',
    fecha_actual: new Date().toISOString().split('T')[0],
    mes_actual: new Date().toISOString().slice(0, 7),
    dia_semana: new Date().toLocaleDateString('es', { weekday: 'long' }),
    upcoming_events: [],
    activity_summary: null,
    goals: null,
    engine_version: '1.0',
    available_layers: ['SEASONALITY'],
  }
}

// ─── Activity summary helper (used by UI) ────────────────────────────────────

export async function getActivitySummary(userId: string, days = 30) {
  const supabase = await createClient()
  const since = new Date(Date.now() - days * 86400000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('ai_usage')
    .select('modulo, created_at')
    .eq('user_id', userId)
    .gte('created_at', since)

  if (!data || data.length === 0) return null

  const records = data as Array<{ modulo: string; created_at: string }>
  const byModule: Record<string, number> = {}
  const days_set = new Set<string>()

  for (const r of records) {
    byModule[r.modulo] = (byModule[r.modulo] ?? 0) + 1
    days_set.add(r.created_at.slice(0, 10))
  }

  return {
    total: records.length,
    by_module: byModule,
    active_days: days_set.size,
    last_used: records[records.length - 1]?.created_at ?? null,
  }
}

// ─── Goals helper ─────────────────────────────────────────────────────────────

export async function getCurrentGoals(userId: string): Promise<AgentGoals | null> {
  const supabase = await createClient()
  const mes = new Date().toISOString().slice(0, 7)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('agent_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('mes', mes)
    .single()

  return data as AgentGoals | null
}

// ─── Save recommendation to DB ────────────────────────────────────────────────

export async function saveGrowthRecommendation(
  userId: string,
  rec: {
    tipo: string
    modo_origen?: string
    titulo: string
    que_recomienda: string
    por_que: string
    objetivo_estrategico: string
    accion_concreta: string
    evidence_type: string
    evidence_summary?: string
    context_snapshot?: Record<string, unknown>
  }
) {
  const supabase = await createClient()
  const periodo = new Date().toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('growth_engine_outputs')
    .insert({ ...rec, user_id: userId, periodo })
    .select('id')
    .single()

  return (data as Record<string, unknown> | null)?.id as string | null
}
