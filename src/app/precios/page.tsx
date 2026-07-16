import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PricingClient } from '@/components/pricing/pricing-client'
import type { SupabaseClient } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: 'Planes y Precios | Autoridad Seguros AI™',
  description: 'Elige el plan que mejor se adapte a tu negocio de seguros.',
}

export default async function PreciosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const client = supabase as unknown as SupabaseClient

  // Load plan limits — single source of truth
  const { data: plansData } = await client
    .from('plan_limits')
    .select('*')
    .order('orden_display', { ascending: true })

  const plans = (plansData ?? []) as Record<string, unknown>[]

  // Load current user plan if logged in
  let currentPlan: string | null = null
  if (user) {
    const { data: profileData } = await client
      .from('profiles')
      .select('plan_tier')
      .eq('id', user.id)
      .single()
    currentPlan = (profileData as { plan_tier?: string } | null)?.plan_tier ?? null
  }

  return (
    <PricingClient
      plans={plans}
      currentPlan={currentPlan}
      isLoggedIn={!!user}
    />
  )
}
