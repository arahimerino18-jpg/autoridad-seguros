import { redirect } from 'next/navigation'
import { loadDashboardData } from '@/lib/dashboard/data-loader'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { IntelligenceCard } from '@/components/dashboard/intelligence-card'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { RecentContent } from '@/components/dashboard/recent-content'
import { WelcomeBanner } from '@/components/dashboard/welcome-banner'
import { OnboardingProgressBanner } from '@/components/dashboard/onboarding-progress-banner'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; payment?: string; plan?: string }>
}) {
  const params = await searchParams
  const data = await loadDashboardData()

  // Check both old and new completion flags (backward compat)
  const profile = data.profile as Record<string, unknown>
  const onboardingDone = !!(profile.onboarding_done || profile.onboarding_completed)
  if (!onboardingDone) redirect('/onboarding')

  // Onboarding progress banner logic
  const lastStep = (profile.onboarding_last_step as number) ?? 0
  const showOnboardingBanner = onboardingDone && lastStep < 3 && params.welcome !== '1'

  const supabase = await createClient()
  const { data: recentContent } = await supabase
    .from('contenidos')
    .select('id, tipo, producto, titulo, created_at, status, compliance_revisado')
    .eq('user_id', data.userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Welcome/activation banners */}
      {(params.welcome === '1' || params.payment === 'success') && (
        <WelcomeBanner
          type={params.payment === 'success' ? 'payment' : 'onboarding'}
          plan={params.plan ?? null}
          agentName={(profile.nombre_completo as string | null) ?? undefined}
        />
      )}

      {/* Onboarding progress banner (once per session, non-blocking) */}
      {showOnboardingBanner && (
        <OnboardingProgressBanner lastStep={lastStep} />
      )}

      <DashboardHero profile={data.profile} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <QuickActions />
          <RecentContent items={(recentContent ?? []) as Record<string, unknown>[]} />
        </div>
        <div>
          <IntelligenceCard
            profile={data.intelligenceProfile}
            score={(data.intelligenceProfile?.score_perfil_completitud as number) ?? 0}
          />
        </div>
      </div>
    </div>
  )
}
