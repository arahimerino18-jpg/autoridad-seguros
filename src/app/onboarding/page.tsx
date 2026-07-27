import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingShell } from '@/components/onboarding/onboarding-shell'
import { startOnboardingAction } from '@/lib/onboarding/actions'
import type { SupabaseClient } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: 'Configura tu Director de Marketing IA | Autoridad Seguros AI™',
}

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const client = supabase as unknown as SupabaseClient

  // Load profile state
  const { data: profileData } = await client
    .from('profiles')
    .select('onboarding_completed, onboarding_done, onboarding_last_step, onboarding_step, nombre_completo, especialidades, first_value_generated_at, onboarding_interview_id')
    .eq('id', user.id)
    .single()

  const p = profileData as Record<string, unknown> | null

  // Completed users → dashboard
  const isCompleted = !!(p?.onboarding_completed || p?.onboarding_done)
  if (isCompleted) redirect('/dashboard')

  // Determine resume step
  const lastStep = (p?.onboarding_last_step as number) ?? 0
  const legacyStep = (p?.onboarding_step as number) ?? 1

  // Map: if lastStep = 0, this is a fresh start → initialize
  let resumeStep = lastStep > 0 ? lastStep : Math.max(legacyStep, 1)

  // If user has first_value already but no completion, send to step 4
  if (p?.first_value_generated_at && resumeStep < 4) resumeStep = 4

  // Get or create interview session
  // INSTRUMENTATION: log every step server-side (visible in Vercel Function Logs)
  console.log('[Onboarding] user.id:', user?.id ?? 'NULL — auth failed')

  const { data: sessionData, error: selectError } = await client
    .from('interview_sessions')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()  // FIX: maybeSingle() returns null when 0 rows, no error

  console.log('[Onboarding] select result:', { id: (sessionData as {id?:string}|null)?.id ?? null, error: selectError?.message ?? null })

  const sess = sessionData as { id?: string } | null

  let sessionId = sess?.id ?? ''
  if (!sessionId) {
    const insertPayload = { user_id: user.id, status: 'en_progreso' }
    console.log('[Onboarding] before insert:', insertPayload)

    const { data: newSess, error: sessError } = await client
      .from('interview_sessions')
      .insert(insertPayload)
      .select('id')
      .single()

    console.log('[Onboarding] insert result:', { id: (newSess as {id?:string}|null)?.id ?? null, error: sessError?.message ?? null, code: sessError?.code ?? null })

    if (sessError) {
      console.error('[Onboarding] CRITICAL: interview_session insert failed:', sessError.message, 'code:', sessError.code)
    }
    sessionId = (newSess as { id?: string } | null)?.id ?? ''
  }

  console.log('[Onboarding] final sessionId:', sessionId || 'EMPTY — interview will not start')

  // Initialize onboarding tracking if first time
  if (lastStep === 0) {
    await startOnboardingAction()
  }

  return (
    <OnboardingShell
      initialStep={resumeStep as 1 | 2 | 3 | 4}
      initialData={{
        nombre:         (p?.nombre_completo as string | null) ?? null,
        especialidades: (p?.especialidades as string[]) ?? [],
        hasInterview:   !!(p?.onboarding_interview_id),
        hasFirstValue:  !!(p?.first_value_generated_at),
        sessionId,
      }}
    />
  )
}
