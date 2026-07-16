'use client'

import { useState } from 'react'
import Link from 'next/link'

interface WelcomeBannerProps {
  type: 'onboarding' | 'payment'
  plan: string | null
  agentName?: string
}

export function WelcomeBanner({ type, plan, agentName }: WelcomeBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  if (type === 'payment') {
    return (
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white flex items-start justify-between gap-4">
        <div>
          <p className="font-bold text-lg mb-1">
            🎉 ¡Pago procesado exitosamente{plan ? ` — Plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}` : ''}!
          </p>
          <p className="text-emerald-100 text-sm">
            Tu plan ya está activo. Todas las funciones están disponibles.
          </p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-white/60 hover:text-white text-lg shrink-0">×</button>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-[#1B2E6B] to-[#2a4080] rounded-2xl p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-bold text-lg mb-1">
            ✦ ¡Bienvenido{agentName ? `, ${agentName.split(' ')[0]}` : ''}! Tu Director de Marketing IA está listo.
          </p>
          <p className="text-blue-200 text-sm mb-3">
            Ya tengo suficiente contexto para personalizar todo tu contenido. Empieza por donde quieras.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/content-studio"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors"
            >
              ✍️ Generar contenido
            </Link>
            <Link
              href="/marketing-copilot"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors"
            >
              🎯 Mi estrategia de hoy
            </Link>
            <Link
              href="/brand-builder"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors"
            >
              🧠 Ver mi perfil IA
            </Link>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-white/50 hover:text-white text-xl shrink-0">×</button>
      </div>
    </div>
  )
}
