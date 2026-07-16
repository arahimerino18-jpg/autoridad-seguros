'use server'

/**
 * Agent Goals Server Actions — Autoridad Seguros AI™
 *
 * Manages monthly objectives that the AI Growth Engine uses to
 * orient all its recommendations toward concrete business goals.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types'
import type { AgentGoals } from '@/types/growth-engine'

export async function saveGoalsAction(
  data: Omit<AgentGoals, 'id' | 'leads_obtenidos' | 'clientes_cerrados'>
): Promise<ActionResult<AgentGoals>> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Sesión expirada.' }

  const mes = data.mes ?? new Date().toISOString().slice(0, 7)

  // Upsert — one goal per user per month
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: saved, error } = await (supabase.from('agent_goals') as any)
    .upsert(
      { ...data, mes, user_id: user.id },
      { onConflict: 'user_id,mes' }
    )
    .select()
    .single()

  if (error) return { success: false, error: 'Error al guardar los objetivos.' }

  revalidatePath('/marketing-copilot')
  return { success: true, data: saved as AgentGoals }
}

export async function updateGoalProgressAction(
  mes: string,
  updates: { leads_obtenidos?: number; clientes_cerrados?: number }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Sesión expirada.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('agent_goals') as any)
    .update(updates)
    .eq('user_id', user.id)
    .eq('mes', mes)

  if (error) return { success: false, error: 'Error al actualizar progreso.' }
  return { success: true, data: undefined }
}

export async function markRecommendationSeenAction(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('growth_engine_outputs') as any)
    .update({ fue_vista: true })
    .eq('id', id)
    .eq('user_id', user.id)
}

export async function markRecommendationExecutedAction(
  id: string,
  contenidoId?: string
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('growth_engine_outputs') as any)
    .update({
      fue_ejecutada: true,
      fue_vista: true,
      ...(contenidoId ? { contenido_generado_id: contenidoId } : {}),
    })
    .eq('id', id)
    .eq('user_id', user.id)
}
