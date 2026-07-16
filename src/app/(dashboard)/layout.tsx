import { redirect } from 'next/navigation'
import { loadDashboardData } from '@/lib/dashboard/data-loader'
import { UsageProvider } from '@/components/dashboard/usage-provider'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Topbar } from '@/components/dashboard/topbar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const data = await loadDashboardData()

  // Onboarding guard — middleware handles this but we double-check at layout level
  const onboardingDone = data.profile.onboarding_done as boolean
  if (!onboardingDone) redirect('/onboarding')

  const profile = data.profile
  const intelScore = (data.intelligenceProfile?.score_perfil_completitud as number) ?? 0

  const planLimitTyped = {
    max_contenidos_mes: (data.planLimit.max_contenidos_mes as number) ?? 30,
    max_copilot_mes: (data.planLimit.max_copilot_mes as number) ?? 10,
    max_compliance_mes: (data.planLimit.max_compliance_mes as number) ?? 15,
    max_imagenes_mes: (data.planLimit.max_imagenes_mes as number) ?? 0,
    tiene_video_studio: (data.planLimit.tiene_video_studio as boolean) ?? false,
    tiene_publicacion_directa: (data.planLimit.tiene_publicacion_directa as boolean) ?? false,
    precio_mensual_usd: (data.planLimit.precio_mensual_usd as number) ?? 27,
    precio_anual_usd: (data.planLimit.precio_anual_usd as number) ?? 270,
  }

  return (
    <UsageProvider
      initialUsage={data.usage}
      planLimit={planLimitTyped}
      userId={data.userId}
    >
      <div className="flex h-screen bg-surface-subtle overflow-hidden">
        <Sidebar
          profile={profile}
          intelScore={intelScore}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar profile={profile} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </UsageProvider>
  )
}
