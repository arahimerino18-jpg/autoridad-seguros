import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GoalsSetup } from '@/components/marketing-copilot/goals-setup'
import { MarketingCopilot } from '@/components/marketing-copilot/copilot'
import { getCurrentGoals } from '@/lib/growth-engine/context-builder'
import type { AgentGoals, CalendarEvent } from '@/types/growth-engine'

export const metadata: Metadata = {
  title: 'Marketing Copilot AI | Autoridad Seguros AI™',
}

export default async function MarketingCopilotPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load agent profile for personalization
  const { data: profileData } = await supabase
    .from('profiles')
    .select('nombre_completo, especialidades')
    .eq('id', user.id)
    .single()

  const profile = profileData as Record<string, unknown> | null
  const agentName = (profile?.nombre_completo as string) ?? ''

  // Get current goals
  const goals = await getCurrentGoals(user.id)

  // Show goals setup if first visit OR if explicitly requested
  const needsGoalsSetup = !goals || params.setup === 'goals'

  // Get upcoming events for the top bar
  const today = new Date().toISOString().split('T')[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: eventsData } = await (supabase.from('insurance_calendar') as any)
    .select('*')
    .gte('fecha_fin', today)
    .lte('fecha_inicio', new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0])
    .order('fecha_inicio', { ascending: true })
    .limit(6)

  const upcomingEvents = (eventsData ?? []) as CalendarEvent[]

  // Get pending (unseen) recommendations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingData } = await (supabase.from('growth_engine_outputs') as any)
    .select('id, titulo, tipo')
    .eq('user_id', user.id)
    .eq('fue_vista', false)
    .eq('fue_descartada', false)
    .order('created_at', { ascending: false })
    .limit(3)

  const pending = (pendingData ?? []) as Array<{ id: string; titulo: string; tipo: string }>

  // Context layers available
  const contextLayers = ['SEASONALITY']
  if (profile) contextLayers.push('AGENT_DATA')
  if (goals) contextLayers.push('GOALS')

  if (needsGoalsSetup) {
    return (
      <div className="max-w-xl mx-auto">
        <GoalsSetup
          agentName={agentName}
          onComplete={() => {
            // Client-side redirect after save — handled by the component
          }}
        />
      </div>
    )
  }

  return (
    <div className="-m-6 h-[calc(100vh-56px)]">
      <MarketingCopilot
        userId={user.id}
        agentName={agentName}
        goals={goals as AgentGoals}
        upcomingEvents={upcomingEvents}
        contextLayers={contextLayers}
        pendingRecommendations={pending}
      />
    </div>
  )
}
