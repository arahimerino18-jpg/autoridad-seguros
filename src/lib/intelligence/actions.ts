'use server'

import { createClient } from '@/lib/supabase/server'
import { updateAgentProfileFromInference } from './profile-service'
import { recordInferenceApplied, recordInferenceRejected } from './lifecycle'
import { runEvidenceAggregator, rejectInferenceWithReason } from './evidence-aggregator'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { InferenciaPendienteV2 } from '@/types/database'

type AnyClient = SupabaseClient

/**
 * Trigger the Evidence Aggregator for the current user.
 * Called from: Brand Builder (manual), API routes, future cron jobs.
 */
export async function runAggregatorAction(
  triggerType: 'manual' | 'post_onboarding' = 'manual'
): Promise<{ proposed: number; skipped: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { proposed: 0, skipped: 0, error: 'No autorizado' }

  try {
    const result = await runEvidenceAggregator(user.id, triggerType)
    return result
  } catch (err) {
    return { proposed: 0, skipped: 0, error: err instanceof Error ? err.message : 'Error inesperado' }
  }
}

/**
 * Approve an inference: apply it to agent_intelligence_profiles.
 * This is the ONLY path that updates the profile from an inference.
 */
export async function approveInferenceAction(
  campo: string,
  valorHash: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autorizado' }

  const client = supabase as unknown as AnyClient

  // Load current profile
  const { data: profileData } = await client
    .from('agent_intelligence_profiles')
    .select('inferencias_pendientes')
    .eq('user_id', user.id)
    .single()

  if (!profileData) return { success: false, error: 'Perfil no encontrado' }

  const p = profileData as Record<string, unknown>
  const pending = (p.inferencias_pendientes as InferenciaPendienteV2[]) ?? []

  // Find the target inference
  const target = pending.find(i => i.campo === campo && i.valor_hash === valorHash)
  if (!target) return { success: false, error: 'Inferencia no encontrada' }

  const now = new Date().toISOString()

  // Remove from pending (directly — service doesn't manage JSONB arrays)
  const { error: pendingError } = await client
    .from('agent_intelligence_profiles')
    .update({
      inferencias_pendientes: pending.filter(i => !(i.campo === campo && i.valor_hash === valorHash)),
      perfil_ia_revisado_en: now,
    })
    .eq('user_id', user.id)

  if (pendingError) return { success: false, error: pendingError.message }

  // Apply the field value via centralized service (Phase 14)
  // This handles: DB write + _source update + history recording
  const result = await updateAgentProfileFromInference(
    { [campo]: target.valor_inferido },
    false,  // not edited — raw inference
    target.fuente ?? 'evidence_aggregator',
    target.evidence_count,
    'Inferencia de IA aprobada por el agente'
  )

  if (!result.success) return { success: false, error: result.error }

  // Record lifecycle: aprobada + aplicada (Phase 15)
  await recordInferenceApplied(
    user.id,
    target,
    target.valor_inferido,
    false  // not edited when going through standard approve
  ).catch(() => {}) // non-critical

  // Log the approval in analytics_events
  await client.from('analytics_events').insert({
    user_id: user.id,
    tipo_evento: 'inference_approved',
    modulo: 'brand_builder',
    metadata: { campo, valor_hash: valorHash, evidence_count: target.evidence_count },
  })

  return { success: true }
}

/**
 * Reject an inference: records in rejection_log, removes from pending.
 */
export async function rejectInferenceAction(
  campo: string,
  valorHash: string,
  razon?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autorizado' }

  const result = await rejectInferenceWithReason(user.id, campo, valorHash, razon)

  if (result.success) {
    const client = supabase as unknown as AnyClient
    await client.from('analytics_events').insert({
      user_id: user.id,
      tipo_evento: 'inference_rejected',
      modulo: 'brand_builder',
      metadata: { campo, razon: razon ?? null },
    })
    // Record lifecycle: rechazada (Phase 15)
    await recordInferenceRejected(user.id, campo, valorHash, razon).catch(() => {})
  }

  return result
}

/**
 * Get current aggregator stats for the UI.
 */
export async function getAggregatorStats(): Promise<{
  pendingCount: number
  lastRunAt: string | null
  totalRuns: number
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { pendingCount: 0, lastRunAt: null, totalRuns: 0 }

  const client = supabase as unknown as AnyClient

  const [profileRes, runsRes] = await Promise.all([
    client.from('agent_intelligence_profiles')
      .select('inferencias_pendientes')
      .eq('user_id', user.id)
      .single(),
    client.from('evidence_aggregator_runs')
      .select('ran_at', { count: 'exact', head: false })
      .eq('user_id', user.id)
      .order('ran_at', { ascending: false })
      .limit(1),
  ])

  const pending = ((profileRes.data as Record<string, unknown> | null)?.inferencias_pendientes as unknown[]) ?? []
  const runs = (runsRes.data as Array<{ ran_at: string }>) ?? []

  return {
    pendingCount: pending.length,
    lastRunAt: runs[0]?.ran_at ?? null,
    totalRuns: (runsRes as { count?: number }).count ?? 0,
  }
}

/**
 * Cleans up archived rejection log entries that meet ALL Decisión C conditions:
 * a) evidence_count_at_rejection < 3
 * b) antigüedad > 180 días
 * c) estado = 'archivado'
 * d) not referenced in current inferencias_pendientes
 *
 * Rejections with evidence_count >= 3 are NEVER auto-cleaned.
 */
export async function cleanupArchivedRejectionsAction(): Promise<{ removed: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { removed: 0, error: 'No autorizado' }

  const client = supabase as unknown as AnyClient

  try {
    // Call the PostgreSQL function from migration 011
    const { data, error } = await client.rpc('cleanup_archived_rejections', {
      p_user_id: user.id,
    })

    if (error) return { removed: 0, error: error.message }
    return { removed: (data as number) ?? 0 }
  } catch (err) {
    return { removed: 0, error: err instanceof Error ? err.message : 'Error inesperado' }
  }
}

/**
 * Archives a rejection (marks it as eligible for future cleanup).
 * An archived rejection still prevents re-proposal — it just becomes eligible
 * for cleanup if it also meets the weak-evidence + age conditions.
 */
export async function archiveRejectionAction(
  campo: string,
  valorHash: string
): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const client = supabase as unknown as AnyClient

  const { data: profileData } = await client
    .from('agent_intelligence_profiles')
    .select('inference_rejection_log')
    .eq('user_id', user.id)
    .single()

  if (!profileData) return { success: false }

  const log = ((profileData as Record<string, unknown>).inference_rejection_log as Array<Record<string, unknown>>) ?? []
  const updated = log.map(entry =>
    entry.campo === campo && entry.valor_hash === valorHash
      ? { ...entry, estado: 'archivado' }
      : entry
  )

  await client
    .from('agent_intelligence_profiles')
    .update({ inference_rejection_log: updated })
    .eq('user_id', user.id)

  return { success: true }
}
