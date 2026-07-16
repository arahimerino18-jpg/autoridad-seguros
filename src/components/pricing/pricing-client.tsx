'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCheckoutSession } from '@/lib/stripe/checkout'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanData {
  plan: string
  nombre_plan: string | null
  descripcion_plan: string | null
  precio_mensual_usd: number
  precio_anual_usd: number
  max_contenidos_mes: number
  max_copilot_mes: number
  max_objection_ai_mes: number
  max_imagenes_mes: number
  tiene_video_studio: boolean
  tiene_publicacion_directa: boolean
  caracteristicas: string[]
  restricciones: string[]
  badge_texto: string | null
  badge_color: string | null
  orden_display: number
}

interface PricingClientProps {
  plans: Record<string, unknown>[]
  currentPlan: string | null
  isLoggedIn: boolean
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  ciclo,
  isCurrentPlan,
  isLoggedIn,
  onUpgrade,
  loading,
}: {
  plan: PlanData
  ciclo: 'monthly' | 'annual'
  isCurrentPlan: boolean
  isLoggedIn: boolean
  onUpgrade: (plan: string, ciclo: 'monthly' | 'annual') => void
  loading: string | null
}) {
  const price = ciclo === 'monthly' ? plan.precio_mensual_usd : plan.precio_anual_usd / 12
  const isElite = plan.plan === 'elite'
  const isPopular = plan.badge_texto === 'Más popular'
  const isLoadingThis = loading === plan.plan

  return (
    <div className={cn(
      'relative flex flex-col rounded-2xl border-2 p-6 transition-all',
      isPopular ? 'border-[#D4A017] shadow-lg shadow-[#D4A017]/10 scale-[1.02]' :
      isElite ? 'border-[#1B2E6B] shadow-md' :
      'border-gray-200',
      isCurrentPlan && 'ring-2 ring-offset-2 ring-green-400'
    )}>
      {/* Badge */}
      {plan.badge_texto && (
        <div className={cn(
          'absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white',
          isPopular ? 'bg-[#D4A017]' : 'bg-[#1B2E6B]'
        )}>
          {plan.badge_texto}
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-3 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
          Plan actual
        </div>
      )}

      {/* Plan name + price */}
      <div className="mb-5">
        <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.nombre_plan ?? plan.plan}</h3>
        <p className="text-sm text-gray-500 mb-4 min-h-[2.5rem] leading-relaxed">
          {plan.descripcion_plan}
        </p>
        <div className="flex items-end gap-1">
          <span className="text-4xl font-bold text-gray-900">
            ${price.toFixed(0)}
          </span>
          <span className="text-gray-400 mb-1">/mes</span>
        </div>
        {ciclo === 'annual' && (
          <p className="text-xs text-green-600 font-medium mt-1">
            ${plan.precio_anual_usd.toFixed(0)} al año · Ahorras 2 meses
          </p>
        )}
      </div>

      {/* CTA */}
      {isCurrentPlan ? (
        <div className="w-full py-2.5 rounded-xl border border-green-200 bg-green-50 text-green-700 text-sm font-semibold text-center mb-5">
          ✓ Tu plan actual
        </div>
      ) : (
        <button
          onClick={() => onUpgrade(plan.plan, ciclo)}
          disabled={!!loading}
          className={cn(
            'w-full py-2.5 rounded-xl text-sm font-semibold transition-colors mb-5',
            isPopular
              ? 'bg-[#D4A017] text-white hover:bg-[#b8890f]'
              : isElite
              ? 'bg-[#1B2E6B] text-white hover:bg-[#16255a]'
              : 'border-2 border-[#1B2E6B] text-[#1B2E6B] hover:bg-[#1B2E6B] hover:text-white',
            loading && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isLoadingThis ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Procesando...
            </span>
          ) : isLoggedIn ? (
            plan.plan === 'starter' ? 'Comenzar gratis' : `Elegir ${plan.nombre_plan ?? plan.plan}`
          ) : (
            'Comenzar ahora'
          )}
        </button>
      )}

      {/* Features */}
      <div className="flex-1 space-y-2">
        {(plan.caracteristicas ?? []).map((feat: string, i: number) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5 shrink-0 text-sm">✓</span>
            <span className="text-sm text-gray-700">{feat}</span>
          </div>
        ))}
        {(plan.restricciones ?? []).map((rest: string, i: number) => (
          <div key={i} className="flex items-start gap-2 opacity-50">
            <span className="text-gray-400 mt-0.5 shrink-0 text-sm">✗</span>
            <span className="text-sm text-gray-500">{rest}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PricingClient({ plans, currentPlan, isLoggedIn }: PricingClientProps) {
  const router = useRouter()
  const [ciclo, setCiclo] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const typedPlans = plans as unknown as PlanData[]

  const handleUpgrade = async (planId: string, billing: 'monthly' | 'annual') => {
    if (!isLoggedIn) {
      router.push('/register?plan=' + planId)
      return
    }

    setLoading(planId)
    setError(null)

    try {
      const result = await createCheckoutSession(
        { plan: planId as 'starter' | 'pro' | 'elite', ciclo: billing },
        '/dashboard'
      )

      if ('error' in result) {
        setError(result.error)
        setLoading(null)
        return
      }

      // Redirect to Stripe Checkout
      window.location.href = result.url
    } catch {
      setError('Error al iniciar el proceso de pago. Inténtalo de nuevo.')
      setLoading(null)
    }
  }

  const annualSavings = Math.round(
    typedPlans.reduce((sum, p) => sum + (p.precio_mensual_usd * 12 - p.precio_anual_usd), 0) / typedPlans.length
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/20">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            El Director de Marketing IA para agentes de seguros hispanos
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8">
            Genera contenido, maneja objeciones y crece tu autoridad digital — en español, para tu comunidad.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setCiclo('monthly')}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-semibold transition-all',
                ciclo === 'monthly' ? 'bg-[#1B2E6B] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Mensual
            </button>
            <button
              onClick={() => setCiclo('annual')}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2',
                ciclo === 'annual' ? 'bg-[#1B2E6B] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Anual
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-bold',
                ciclo === 'annual' ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
              )}>
                -17%
              </span>
            </button>
          </div>

          {ciclo === 'annual' && annualSavings > 0 && (
            <p className="text-sm text-green-600 font-medium mt-3">
              💡 Pagas anual y ahorras en promedio ${annualSavings} por plan
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-lg mx-auto mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {typedPlans.map(plan => (
            <PlanCard
              key={plan.plan}
              plan={plan}
              ciclo={ciclo}
              isCurrentPlan={currentPlan === plan.plan}
              isLoggedIn={isLoggedIn}
              onUpgrade={handleUpgrade}
              loading={loading}
            />
          ))}
        </div>

        {/* Trust signals */}
        <div className="mt-14 text-center">
          <p className="text-xs text-gray-400 mb-4">Pago seguro con Stripe · Cancela cuando quieras · Sin contratos</p>
          <div className="flex flex-wrap justify-center gap-6 text-xs text-gray-400">
            <span>🔒 SSL encriptado</span>
            <span>💳 Tarjeta de crédito o débito</span>
            <span>🔄 Cambia o cancela en cualquier momento</span>
            <span>📧 Soporte en español</span>
          </div>
        </div>

        {/* FAQ minimal */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-lg font-bold text-gray-800 mb-6 text-center">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {[
              {
                q: '¿Puedo cambiar de plan después?',
                a: 'Sí. Puedes subir o bajar de plan en cualquier momento desde tu configuración. El cambio aplica inmediatamente.',
              },
              {
                q: '¿Qué pasa si cancelo?',
                a: 'Tu cuenta baja automáticamente al plan Starter. No pierdes tu contenido generado.',
              },
              {
                q: '¿Hay período de prueba?',
                a: 'El plan Starter es gratuito y te permite explorar la plataforma antes de decidir.',
              },
              {
                q: '¿Stripe es seguro para mis datos?',
                a: 'Stripe es el procesador de pagos de confianza usado por millones de empresas. Nosotros nunca almacenamos tu información de tarjeta.',
              },
            ].map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="font-semibold text-sm text-gray-800 mb-1">{faq.q}</p>
                <p className="text-sm text-gray-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
