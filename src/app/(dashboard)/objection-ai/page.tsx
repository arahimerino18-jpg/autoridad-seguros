import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ObjectionAI } from '@/components/objection-ai/objection-ai'

export const metadata = {
  title: 'Objection AI™ | Autoridad Seguros AI',
  description: 'Respuestas éticas y personalizadas para manejar objeciones de prospectos',
}

export default async function ObjectionAIPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre_completo, onboarding_completed')
    .eq('id', user.id)
    .single()

  const p = profile as { nombre_completo?: string; onboarding_completed?: boolean } | null

  if (!p?.onboarding_completed) redirect('/onboarding')

  const agentName = p.nombre_completo?.split(' ')[0] ?? 'Agente'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <ObjectionAI agentName={agentName} />
      </div>
    </div>
  )
}
