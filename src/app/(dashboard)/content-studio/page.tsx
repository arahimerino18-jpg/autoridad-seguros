import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContentStudio } from '@/components/content-studio/content-studio'

export const metadata: Metadata = {
  title: 'Content Studio | Autoridad Seguros AI™',
}

export default async function ContentStudioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load agent handle for preview components
  const { data: brandKitData } = await supabase
    .from('brand_kits')
    .select('instagram_handle')
    .eq('user_id', user.id)
    .single()

  const brandKit = brandKitData as { instagram_handle?: string } | null
  const agentHandle = brandKit?.instagram_handle ?? undefined

  // Load current usage
  const period = new Date().toISOString().slice(0, 7) + '-01'
  const { count: usageCount } = await supabase
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('modulo', 'content_studio')
    .eq('periodo_mes', period)

  // Load plan limit
  const { data: profileData } = await supabase
    .from('profiles')
    .select('plan_tier')
    .eq('id', user.id)
    .single()

  const plan = (profileData as { plan_tier?: string } | null)?.plan_tier ?? 'starter'

  const { data: planData } = await supabase
    .from('plan_limits')
    .select('max_contenidos_mes')
    .eq('plan', plan)
    .single()

  const usageMax = (planData as { max_contenidos_mes?: number } | null)?.max_contenidos_mes ?? 30

  return (
    <div className="-m-6 h-[calc(100vh-56px)]">
      <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">Cargando Content Studio...</div>}>
        <ContentStudio
          agentHandle={agentHandle}
          usageCount={usageCount ?? 0}
          usageMax={usageMax}
        />
      </Suspense>
    </div>
  )
}
