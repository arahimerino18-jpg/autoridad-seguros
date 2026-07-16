'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface OnboardingProgressBannerProps {
  lastStep: number
}

const SESSION_KEY = 'onboarding_banner_shown'

export function OnboardingProgressBanner({ lastStep }: OnboardingProgressBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Only show once per browser session
    const alreadyShown = sessionStorage.getItem(SESSION_KEY)
    if (!alreadyShown) {
      setVisible(true)
      sessionStorage.setItem(SESSION_KEY, '1')
    }
  }, [])

  if (!visible) return null

  const resumeStep = Math.max(lastStep, 1)

  return (
    <div className="bg-gradient-to-r from-[#4A90D9]/10 to-[#1B2E6B]/10 border border-[#4A90D9]/20 rounded-2xl p-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#1B2E6B]/10 flex items-center justify-center shrink-0 text-lg mt-0.5">
          ✦
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-0.5">
            Tu Director de Marketing IA todavía puede conocerte mejor
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Completa tu Entrevista Inteligente de Marca para recibir recomendaciones más precisas
            en Copilot, Content Studio y Objection AI.
          </p>
          <Link
            href={`/onboarding?step=${resumeStep}`}
            className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[#1B2E6B] hover:text-[#16255a] transition-colors"
          >
            Continuar donde lo dejé →
          </Link>
        </div>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="text-gray-300 hover:text-gray-500 text-xl leading-none shrink-0 transition-colors"
        aria-label="Cerrar"
      >
        ×
      </button>
    </div>
  )
}
