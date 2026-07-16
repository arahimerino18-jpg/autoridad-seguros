'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Records which angle the agent chose and what action they took.
 * Minimum learning signal — does NOT modify the agent intelligence profile.
 */
export async function saveObjectionAction(
  responseId: string,
  accion: 'copiado' | 'regenerado' | 'descartado',
  anguloCopiad?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const update: Record<string, string> = { accion }
  if (anguloCopiad) update.angulo_copiado = anguloCopiad

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('objection_responses')
    .update(update)
    .eq('id', responseId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}

/**
 * Records whether the response was useful.
 * Called after the agent has had time to use (or not use) the response.
 */
export async function saveObjectionFeedback(
  responseId: string,
  fueUtil: 'si' | 'no' | 'no_usada',
  notasAgente?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const update: Record<string, string> = { fue_util: fueUtil }
  if (notasAgente) update.notas_agente = notasAgente

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('objection_responses')
    .update(update)
    .eq('id', responseId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/objection-ai')
  return { success: true }
}

/**
 * Fetches recent objection history for the current agent.
 */
export async function getObjectionHistory(limit = 20) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'No autorizado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('objection_responses')
    .select('id, objecion_texto, objecion_tipo, producto, accion, fue_util, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data: data ?? [], error: error?.message ?? null }
}
