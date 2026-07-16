'use server'

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  IntelProfileHistoryEntry,
  IntelProfileChangeSource,
  IntelSource,
  AggregatorConfig
} from '@/types/database'

type AnyClient = SupabaseClient

// ─── Record a change to agent_intelligence_profiles ───────────────────────────

export async function recordIntelProfileChange(params: {
  userId: string
  campo: string
  valorAnterior: unknown
  valorNuevo: unknown
  sourceType: IntelProfileChangeSource
  origen?: string
  motivo?: string
  fuenteEvidencia?: string
  evidenceCount?: number
}): Promise<string | null> {
  const supabase = await createClient()
  const client = supabase as unknown as AnyClient

  try {
    const { data } = await client.rpc('record_intel_profile_change', {
      p_user_id:          params.userId,
      p_campo:            params.campo,
      p_valor_anterior:   params.valorAnterior !== undefined ? JSON.stringify(params.valorAnterior) : null,
      p_valor_nuevo:      JSON.stringify(params.valorNuevo),
      p_source_type:      params.sourceType,
      p_origen:           params.origen ?? null,
      p_motivo:           params.motivo ?? null,
      p_fuente_evidencia: params.fuenteEvidencia ?? null,
      p_evidence_count:   params.evidenceCount ?? null,
    })
    return (data as string | null)
  } catch (err) {
    // History recording is non-critical — never block the main operation
    console.warn('[ProfileHistory] Failed to record change:', err instanceof Error ? err.message : err)
    return null
  }
}

// ─── Get profile history for a user ──────────────────────────────────────────

export async function getIntelProfileHistory(
  limit = 50
): Promise<IntelProfileHistoryEntry[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const client = supabase as unknown as AnyClient
  const { data } = await client
    .from('agent_intel_profile_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as IntelProfileHistoryEntry[]
}

// ─── Get history for a specific field ─────────────────────────────────────────

export async function getFieldHistory(campo: string): Promise<IntelProfileHistoryEntry[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const client = supabase as unknown as AnyClient
  const { data } = await client
    .from('agent_intel_profile_history')
    .select('*')
    .eq('user_id', user.id)
    .eq('campo', campo)
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []) as IntelProfileHistoryEntry[]
}

// ─── Revert a field to a previous version ────────────────────────────────────

export async function revertIntelFieldAction(
  historyEntryId: string,
  motivo?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autorizado' }

  const client = supabase as unknown as AnyClient

  // Load the target history entry
  const { data: entry } = await client
    .from('agent_intel_profile_history')
    .select('*')
    .eq('id', historyEntryId)
    .eq('user_id', user.id)  // RLS: only own history
    .single()

  if (!entry) return { success: false, error: 'Versión no encontrada' }

  const h = entry as IntelProfileHistoryEntry

  // Get current value before reverting (for the history record)
  const { data: currentProfile } = await client
    .from('agent_intelligence_profiles')
    .select(h.campo)
    .eq('user_id', user.id)
    .single()

  const currentValue = currentProfile ? (currentProfile as unknown as Record<string, unknown>)[h.campo] : null
  const revertTo = h.valor_anterior // Revert to BEFORE this change was made

  // Apply the reversion
  const update: Record<string, unknown> = {
    [h.campo]: revertTo,
    [`${h.campo}_source`]: 'declarado' as IntelSource, // Reversion = agent controlled = declarado
    updated_at: new Date().toISOString(),
  }

  const { error } = await client
    .from('agent_intelligence_profiles')
    .update(update)
    .eq('user_id', user.id)

  if (error) return { success: false, error: error.message }

  // Record the reversion in history
  await recordIntelProfileChange({
    userId: user.id,
    campo: h.campo,
    valorAnterior: currentValue,
    valorNuevo: revertTo,
    sourceType: 'reversion',
    origen: 'brand_builder',
    motivo: motivo ?? `Reversión al estado anterior al cambio del ${new Date(h.created_at).toLocaleDateString('es-US')}`,
  })

  return { success: true }
}

// ─── Update approve action to record history ──────────────────────────────────
// This replaces the bare DB update in approveInferenceAction in actions.ts
// by wrapping it with history recording.

export async function approveInferenceWithHistory(
  campo: string,
  valorAnterior: unknown,
  valorNuevo: unknown,
  edited: boolean,
  fuenteEvidencia: string,
  evidenceCount: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autorizado' }

  const client = supabase as unknown as AnyClient
  const now = new Date().toISOString()

  const { error } = await client
    .from('agent_intelligence_profiles')
    .update({
      [campo]: valorNuevo,
      [`${campo}_source`]: 'confirmado',
      updated_at: now,
    })
    .eq('user_id', user.id)

  if (error) return { success: false, error: error.message }

  // Record history
  await recordIntelProfileChange({
    userId: user.id,
    campo,
    valorAnterior,
    valorNuevo,
    sourceType: edited ? 'inferencia_editada' : 'inferencia_ia',
    origen: 'brand_builder',
    fuenteEvidencia,
    evidenceCount,
    motivo: edited ? 'Inferencia de IA aprobada con edición del agente' : 'Inferencia de IA aprobada sin cambios',
  })

  return { success: true }
}

// ─── Load aggregator config for UI ───────────────────────────────────────────

export async function getAggregatorConfigAction(): Promise<AggregatorConfig | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { getAggregatorConfig } = await import('@/lib/intelligence/config')
  const config = await getAggregatorConfig(user.id)
  return config
}
