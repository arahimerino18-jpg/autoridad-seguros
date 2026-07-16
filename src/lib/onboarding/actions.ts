'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateAgentProfileDeclared } from '@/lib/intelligence/profile-service'
import type { SupabaseClient } from '@supabase/supabase-js'

type AnyClient = SupabaseClient // eslint-disable-line @typescript-eslint/no-explicit-any

// ─── Analytics helper ─────────────────────────────────────────────────────────

async function trackEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  tipoEvento: string,
  metadata: Record<string, unknown> = {}
) {
  const client = supabase as unknown as AnyClient
  await client.from('analytics_events').insert({
    user_id:    userId,
    tipo_evento: tipoEvento,
    modulo:     'onboarding',
    metadata,
  })
}

// ─── Step progression ─────────────────────────────────────────────────────────

/**
 * Called when user enters onboarding for the first time.
 * Idempotent — safe to call multiple times.
 */
export async function startOnboardingAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const client = supabase as unknown as AnyClient
  const { data: profile } = await client
    .from('profiles')
    .select('onboarding_last_step, onboarding_completed')
    .eq('id', user.id)
    .single()

  const p = profile as { onboarding_last_step?: number; onboarding_completed?: boolean } | null

  // Don't restart if already past step 0
  if (p?.onboarding_last_step && p.onboarding_last_step > 0) {
    return { success: true, resumeStep: p.onboarding_last_step }
  }

  await client.from('profiles').update({ onboarding_last_step: 1, onboarding_step: 1 }).eq('id', user.id)
  await trackEvent(supabase, user.id, 'onboarding_iniciado', {})
  return { success: true, resumeStep: 1 }
}

/**
 * Step 1: Identity capture — name, location, primary specialties
 */
export async function onboardingStep1(data: {
  nombre_completo: string
  estado_usa: string
  especialidades: string[]
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autorizado' }

  const client = supabase as unknown as AnyClient
  const { error } = await client.from('profiles').update({
    nombre_completo: data.nombre_completo.trim(),
    estado_usa:      data.estado_usa,
    especialidades:  data.especialidades,
    onboarding_step: 2,
    onboarding_last_step: 2,
  }).eq('id', user.id)

  if (error) return { success: false, error: 'Error al guardar tu información.' }

  // Update intel profile via centralized service (Phase 14)
  await updateAgentProfileDeclared({
    ciudad_estado: data.estado_usa,
    mercado_objetivo: `Comunidad hispana en ${data.estado_usa}`,
  }, 'onboarding', 'Paso 1: identidad básica')

  await trackEvent(supabase, user.id, 'onboarding_paso_1_completado', {
    especialidades_count: data.especialidades.length,
  })

  return { success: true }
}

/**
 * Step 2: Products — primary products the agent sells
 */
export async function onboardingStep2(data: {
  productos: string[]
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autorizado' }

  const client = supabase as unknown as AnyClient
  await client.from('profiles').update({
    especialidades:  data.productos,
    onboarding_step: 3,
    onboarding_last_step: 3,
  }).eq('id', user.id)

  await updateAgentProfileDeclared({
    productos_principales: data.productos,
  }, 'onboarding', 'Paso 2: productos prioritarios')

  await trackEvent(supabase, user.id, 'onboarding_paso_2_completado', {
    productos: data.productos,
  })

  return { success: true }
}

/**
 * Step 3: Interview skip/continue — records whether interview was done or deferred
 */
export async function onboardingSkipInterview(): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const client = supabase as unknown as AnyClient
  await client.from('profiles').update({
    onboarding_step: 4,
    onboarding_last_step: 4,
  }).eq('id', user.id)

  await trackEvent(supabase, user.id, 'onboarding_entrevista_omitida', {})
  return { success: true }
}

export async function onboardingCompleteInterview(sessionId: string): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const client = supabase as unknown as AnyClient
  await client.from('profiles').update({
    onboarding_step: 4,
    onboarding_last_step: 4,
    onboarding_interview_id: sessionId,
  }).eq('id', user.id)

  await trackEvent(supabase, user.id, 'onboarding_paso_3_completado', { session_id: sessionId })
  return { success: true }
}

/**
 * Step 4: First value generation — marks activation event
 * Called after the first content piece is generated during onboarding.
 */
export async function markFirstValueGenerated(): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const client = supabase as unknown as AnyClient

  // Only mark once — idempotent
  const { data: p } = await client
    .from('profiles')
    .select('first_value_generated_at')
    .eq('id', user.id)
    .single()

  const profile = p as { first_value_generated_at?: string | null } | null
  if (profile?.first_value_generated_at) return { success: true } // already marked

  const now = new Date().toISOString()
  await client.from('profiles').update({
    first_value_generated_at: now,
    onboarding_step: 5,
    onboarding_last_step: 5,
  }).eq('id', user.id)

  await trackEvent(supabase, user.id, 'first_value_generated', { timestamp: now })
  await trackEvent(supabase, user.id, 'onboarding_paso_4_completado', {})
  return { success: true }
}

/**
 * Step 5: Complete onboarding — redirect to dashboard
 */
export async function completeOnboarding(): Promise<never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const client = supabase as unknown as AnyClient
    await client.from('profiles').update({
      onboarding_done:      true,
      onboarding_completed: true,
      onboarding_step:      5,
      onboarding_last_step: 5,
    }).eq('id', user.id)

    await trackEvent(supabase, user.id, 'onboarding_completado', {})

    // Send welcome email (non-blocking — doesn't fail onboarding if email fails)
    try {
      const { data: profileData } = await client
        .from('profiles').select('nombre_completo').eq('id', user.id).single()
      const nombre = (profileData as { nombre_completo?: string } | null)?.nombre_completo ?? 'Agente'
      const { sendWelcomeEmail } = await import('@/lib/email/resend')
      await sendWelcomeEmail({ to: user.email ?? '', nombre })
    } catch { /* email is non-critical */ }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard?welcome=1')
}

/**
 * Resume check — returns which step to resume from.
 * Used by middleware and onboarding page to route correctly.
 */
export async function getOnboardingState(): Promise<{
  completed: boolean
  lastStep: number
  hasInterview: boolean
  hasFirstValue: boolean
  nombre: string | null
  especialidades: string[]
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { completed: false, lastStep: 0, hasInterview: false, hasFirstValue: false, nombre: null, especialidades: [] }

  const client = supabase as unknown as AnyClient
  const { data } = await client
    .from('profiles')
    .select('onboarding_completed, onboarding_done, onboarding_last_step, onboarding_interview_id, first_value_generated_at, nombre_completo, especialidades')
    .eq('id', user.id)
    .single()

  const p = data as Record<string, unknown> | null
  return {
    completed:      !!(p?.onboarding_completed || p?.onboarding_done),
    lastStep:       (p?.onboarding_last_step as number) ?? 0,
    hasInterview:   !!(p?.onboarding_interview_id),
    hasFirstValue:  !!(p?.first_value_generated_at),
    nombre:         (p?.nombre_completo as string | null) ?? null,
    especialidades: (p?.especialidades as string[]) ?? [],
  }
}
