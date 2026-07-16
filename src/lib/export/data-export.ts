'use server'

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentDataExport, PerformanceMetrics } from '@/types/database'

type AnyClient = SupabaseClient

// ─── Fields NEVER exported ────────────────────────────────────────────────────
// This list is the authoritative exclusion registry.
// Adding a sensitive field here prevents it from ever appearing in exports.

const EXCLUDED_PROFILE_FIELDS = new Set([
  'stripe_customer_id',
  'stripe_subscription_id',
  'stripe_event_id_last',
])

const EXCLUDED_INTEL_FIELDS = new Set([
  // No exclusions currently — all intel fields are agent-owned data
])

// ─── Sanitize object ──────────────────────────────────────────────────────────

function sanitize<T extends Record<string, unknown>>(
  obj: T,
  excluded: Set<string>
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => !excluded.has(k))
  ) as Partial<T>
}

// ─── Main export builder ──────────────────────────────────────────────────────

export async function buildAgentDataExport(
  userId: string
): Promise<{ data: AgentDataExport; recordCount: number; error?: string }> {
  const supabase = await createClient()

  // Authorization: verify the requesting user is the owner
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== userId) {
    return { data: null as unknown as AgentDataExport, recordCount: 0, error: 'No autorizado' }
  }

  const client = supabase as unknown as AnyClient

  try {
    // Parallel load of all sections
    const [
      profileRes,
      intelRes,
      historyRes,
      contenidosRes,
      objecionesRes,
      complianceRes,
      briefingsRes,
      subRes,
    ] = await Promise.all([
      client.from('profiles').select(
        'id, nombre_completo, estado_usa, especialidades, plan_tier, onboarding_completed, first_value_generated_at, created_at'
      ).eq('id', userId).single(),

      client.from('agent_intelligence_profiles').select('*').eq('user_id', userId).single(),

      client.from('agent_intel_profile_history').select(
        'campo, valor_anterior, valor_nuevo, source_type, origen, motivo, fuente_evidencia, evidence_count, created_at'
      ).eq('user_id', userId).order('created_at', { ascending: false }).limit(200),

      client.from('contenidos').select(
        'id, tipo, producto, plataforma, titulo, status, compliance_revisado, fue_publicado, created_at'
      ).eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: false }).limit(500),

      client.from('objection_responses').select(
        'objecion_texto, objecion_tipo, producto, canal, fue_util, angulo_copiado, accion, created_at'
      ).eq('user_id', userId).order('created_at', { ascending: false }).limit(300),

      client.from('compliance_logs').select(
        'producto, canal, risk_level, aprobado, overall_summary, requires_human_review, content_source, created_at'
      ).eq('user_id', userId).order('created_at', { ascending: false }).limit(200),

      client.from('weekly_briefings').select(
        'periodo_key, briefing_texto, trigger_type, created_at'
      ).eq('user_id', userId).order('created_at', { ascending: false }).limit(52),

      client.from('subscriptions').select(
        'plan, status, periodo_fin, ciclo, cancel_at_period_end'
      ).eq('user_id', userId).single(),
    ])

    const profile = profileRes.data as Record<string, unknown> | null
    const intel = intelRes.data as Record<string, unknown> | null
    const history = (historyRes.data ?? []) as unknown[]
    const contenidos = (contenidosRes.data ?? []) as unknown[]
    const objeciones = (objecionesRes.data ?? []) as unknown[]
    const compliance = (complianceRes.data ?? []) as unknown[]
    const briefings = (briefingsRes.data ?? []) as unknown[]
    const sub = subRes.data as Record<string, unknown> | null

    // Build performance metrics summary (lightweight version)
    const contenidosTyped = contenidos as Array<{ producto?: string; plataforma?: string; status?: string }>
    const objecionesTyped = objeciones as Array<{ fue_util?: string; objecion_tipo?: string }>
    const complianceTyped = compliance as Array<{ risk_level?: string }>

    const metricas: Partial<PerformanceMetrics> = {
      contenidos_total: contenidos.length,
      contenidos_por_producto: contenidosTyped.reduce<Record<string, number>>((acc, c) => {
        if (c.producto) acc[c.producto] = (acc[c.producto] ?? 0) + 1
        return acc
      }, {}),
      objections_total: objeciones.length,
      objections_util_rate: objecionesTyped.length > 0
        ? objecionesTyped.filter(o => o.fue_util === 'si').length / objecionesTyped.length
        : 0,
      compliance_risk_low: complianceTyped.filter(c => c.risk_level === 'LOW').length,
      compliance_risk_medium: complianceTyped.filter(c => c.risk_level === 'MEDIUM').length,
      compliance_risk_high: complianceTyped.filter(c => c.risk_level === 'HIGH').length,
    }

    // Sanitize intel profile — remove any internal fields
    const sanitizedIntel = intel ? sanitize(intel, EXCLUDED_INTEL_FIELDS) : null
    const sanitizedProfile = profile ? sanitize(profile, EXCLUDED_PROFILE_FIELDS) : null

    // Add subscription info (sanitized — no Stripe IDs)
    if (sanitizedProfile && sub) {
      (sanitizedProfile as Record<string, unknown>).suscripcion = {
        plan: sub.plan,
        status: sub.status,
        periodo_fin: sub.periodo_fin,
        ciclo: sub.ciclo,
      }
    }

    const totalRecords =
      history.length + contenidos.length + objeciones.length +
      compliance.length + briefings.length

    const exportData: AgentDataExport = {
      meta: {
        export_version: '1.0',
        exported_at: new Date().toISOString(),
        user_id: userId,
        platform: 'Autoridad Seguros AI™',
      },
      perfil: sanitizedProfile ?? null,
      intelligence_profile: sanitizedIntel ?? null,
      inferencias_pendientes: (intel?.inferencias_pendientes as unknown[]) ?? [],
      historial_cambios: history,
      contenidos,
      objeciones,
      compliance_logs: compliance,
      briefings,
      metricas: metricas as PerformanceMetrics,
    }

    return { data: exportData, recordCount: totalRecords }

  } catch (err) {
    return {
      data: null as unknown as AgentDataExport,
      recordCount: 0,
      error: err instanceof Error ? err.message : 'Error al exportar datos',
    }
  }
}

// ─── Log export event ─────────────────────────────────────────────────────────

export async function logExportEvent(
  userId: string,
  format: 'json' | 'pdf',
  dataScope: string[],
  recordCount: number
): Promise<void> {
  const supabase = await createClient()
  const client = supabase as unknown as AnyClient

  try {
    await client.from('export_events').insert({
      user_id:      userId,
      export_format: format,
      data_scope:   dataScope,
      record_count: recordCount,
    })
  } catch { /* non-critical */ }
}

