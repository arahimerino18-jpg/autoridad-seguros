import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/settings/settings-client'
import { AggregatorConfigUI } from '@/components/settings/aggregator-config-ui'
import type { SupabaseClient } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: 'Configuración | Autoridad Seguros AI™',
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const client = supabase as unknown as SupabaseClient

  // Load profile
  const { data: profileData } = await client
    .from('profiles')
    .select('nombre_completo, estado_usa, especialidades, plan_tier, onboarding_completed, onboarding_done')
    .eq('id', user.id)
    .single()

  const profile = profileData as Record<string, unknown> | null

  // Load subscription
  const { data: subData } = await client
    .from('subscriptions')
    .select('plan, status, periodo_fin, ciclo, precio_usd, stripe_customer_id, periodo_gracia_fin, cancel_at_period_end')
    .eq('user_id', user.id)
    .single()

  const sub = subData as Record<string, unknown> | null

  // Load plan limits for current plan
  const currentPlan = (profile?.plan_tier as string) ?? 'starter'
  const { data: planLimitData } = await client
    .from('plan_limits')
    .select('nombre_plan, max_contenidos_mes, max_copilot_mes, max_objection_ai_mes, max_compliance_mes, tiene_video_studio, tiene_publicacion_directa, precio_mensual_usd')
    .eq('plan', currentPlan)
    .single()

  const planLimit = planLimitData as Record<string, unknown> | null

  // Load current month usage
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data: usageData } = await client
    .from('ai_usage')
    .select('modulo')
    .eq('user_id', user.id)
    .eq('periodo_mes', period)

  const usage = usageData as Array<{ modulo: string }> | null
  const usageByModule = (usage ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.modulo] = (acc[row.modulo] ?? 0) + 1
    return acc
  }, {})

  // Load aggregator config
  const { getAggregatorConfig } = await import('@/lib/intelligence/config')
  const aggConfig = await getAggregatorConfig(user.id)

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm mt-1">Gestiona tu cuenta, seguridad y suscripción</p>
      </div>

      <SettingsClient
        user={{ id: user.id, email: user.email ?? '' }}
        profile={profile ?? {}}
        subscription={sub ?? {}}
        planLimit={planLimit ?? {}}
        usageByModule={usageByModule}
        currentPlan={currentPlan}
      />

      {/* Evidence Aggregator Config */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-4">
        <AggregatorConfigUI
          currentConfig={aggConfig}
          userId={user.id}
        />
      </div>
    </div>
  )
}
