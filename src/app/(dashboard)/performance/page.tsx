import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadPerformanceData } from '@/lib/dashboard/performance-loader'
import { PerformanceDashboard } from '@/components/performance/performance-dashboard'

export const metadata: Metadata = {
  title: 'Dashboard de Performance | Autoridad Seguros AI™',
  description: 'Métricas y rendimiento de tu actividad como agente',
}

export default async function PerformancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const metrics = await loadPerformanceData()
  if (!metrics) redirect('/dashboard')

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard de Performance</h1>
        <p className="text-gray-500 text-sm mt-1">
          Tu actividad real — contenido, objeciones, compliance e inteligencia IA
        </p>
      </div>
      <PerformanceDashboard metrics={metrics} />
    </div>
  )
}
