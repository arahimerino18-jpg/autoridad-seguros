'use server'

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { InferenceEstado, InferenceLifecycleEntry, InferenciaPendienteV2 } from '@/types/database'

type AnyClient = SupabaseClient

// ─── Record a lifecycle transition ───────────────────────────────────────────

export async function recordInferenceLifecycle(params: {
  userId: string
  campo: string
  valorHash: string
  fuente: string | null
  evidenceCount: number | null
  estado: InferenceEstado
  edited?: boolean
  valorPropuesto?: unknown
  valorAplicado?: unknown
  motivo?: string
  actionBy?: 'agent' | 'system' | 'cron'
}): Promise<string | null> {
  const supabase = await createClient()
  const client = supabase as unknown as AnyClient

  try {
    const { data } = await client
      .from('inference_lifecycle_log')
      .insert({
        user_id:        params.userId,
        campo:          params.campo,
        valor_hash:     params.valorHash,
        fuente:         params.fuente ?? null,
        evidence_count: params.evidenceCount ?? null,
        estado:         params.estado,
        edited:         params.edited ?? false,
        valor_propuesto: params.valorPropuesto !== undefined ? JSON.stringify(params.valorPropuesto) : null,
        valor_aplicado:  params.valorAplicado !== undefined ? JSON.stringify(params.valorAplicado) : null,
        motivo:         params.motivo ?? null,
        action_by:      params.actionBy ?? 'agent',
      })
      .select('id')
      .single()

    return (data as { id: string } | null)?.id ?? null
  } catch (err) {
    console.warn('[InferenceLifecycle] Failed to record:', err instanceof Error ? err.message : err)
    return null
  }
}

// ─── Get lifecycle history for a user ────────────────────────────────────────

export async function getInferenceLifecycle(
  campo?: string,
  limit = 50
): Promise<InferenceLifecycleEntry[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const client = supabase as unknown as AnyClient
  let query = client
    .from('inference_lifecycle_log')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (campo) {
    query = query.eq('campo', campo)
  }

  const { data } = await query
  return (data ?? []) as InferenceLifecycleEntry[]
}

// ─── Record when inference is proposed (by aggregator) ───────────────────────

export async function recordInferenceProposed(
  userId: string,
  inferencia: InferenciaPendienteV2
): Promise<void> {
  await recordInferenceLifecycle({
    userId,
    campo:          inferencia.campo,
    valorHash:      inferencia.valor_hash,
    fuente:         inferencia.fuente,
    evidenceCount:  inferencia.evidence_count,
    estado:         'pendiente',
    valorPropuesto: inferencia.valor_inferido,
    motivo:         `Propuesta por ${inferencia.fuente} — ${inferencia.signal_summary}`,
    actionBy:       'system',
  })
}

// ─── Record when agent approves/applies ──────────────────────────────────────

export async function recordInferenceApplied(
  userId: string,
  inferencia: InferenciaPendienteV2,
  valorAplicado: unknown,
  edited: boolean
): Promise<void> {
  // First mark as approved
  await recordInferenceLifecycle({
    userId,
    campo:          inferencia.campo,
    valorHash:      inferencia.valor_hash,
    fuente:         inferencia.fuente,
    evidenceCount:  inferencia.evidence_count,
    estado:         'aprobada',
    edited,
    valorPropuesto: inferencia.valor_inferido,
    valorAplicado,
    motivo:         edited ? 'Inferencia aprobada con edición del agente' : 'Inferencia aprobada sin cambios',
  })

  // Then mark as applied
  await recordInferenceLifecycle({
    userId,
    campo:          inferencia.campo,
    valorHash:      inferencia.valor_hash,
    fuente:         inferencia.fuente,
    evidenceCount:  inferencia.evidence_count,
    estado:         'aplicada',
    edited,
    valorAplicado,
    motivo:         'Valor escrito en Agent Intelligence Profile',
    actionBy:       'system',
  })
}

// ─── Record when agent rejects ────────────────────────────────────────────────

export async function recordInferenceRejected(
  userId: string,
  campo: string,
  valorHash: string,
  razon?: string
): Promise<void> {
  await recordInferenceLifecycle({
    userId,
    campo,
    valorHash,
    fuente:    null,
    evidenceCount: null,
    estado:    'rechazada',
    motivo:    razon ?? 'Rechazada por el agente',
  })
}

// ─── Record when inference is reverted ───────────────────────────────────────

export async function recordInferenceReverted(
  userId: string,
  campo: string,
  valorHash: string,
  motivo?: string
): Promise<void> {
  await recordInferenceLifecycle({
    userId,
    campo,
    valorHash,
    fuente:        null,
    evidenceCount: null,
    estado:        'revertida',
    motivo:        motivo ?? 'Valor revertido al estado anterior',
  })
}

// ─── Record archival ──────────────────────────────────────────────────────────

export async function recordInferenceArchived(
  userId: string,
  campo: string,
  valorHash: string
): Promise<void> {
  await recordInferenceLifecycle({
    userId,
    campo,
    valorHash,
    fuente:        null,
    evidenceCount: null,
    estado:        'archivada',
    motivo:        'Entrada del rejection_log archivada para posible limpieza',
    actionBy:      'system',
  })
}
