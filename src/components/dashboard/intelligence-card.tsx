import Link from 'next/link'
import { cn } from '@/lib/utils'

interface IntelligenceCardProps {
  profile: Record<string, unknown> | null
  score: number
}

interface ProfileSection {
  key: string
  label: string
  completed: boolean
  points: number
  href: string
}

function getSections(profile: Record<string, unknown> | null): ProfileSection[] {
  const p = profile ?? {}
  return [
    {
      key: 'tono',
      label: 'Tono de voz',
      completed: !!(p.tono_comunicacion && p.propuesta_de_valor),
      points: 16,
      href: '/settings/perfil-ia',
    },
    {
      key: 'mercado',
      label: 'Mercado objetivo',
      completed: !!(p.mercado_objetivo && p.ciudad_estado),
      points: 16,
      href: '/settings/perfil-ia',
    },
    {
      key: 'productos',
      label: 'Productos principales',
      completed: Array.isArray(p.productos_principales) && p.productos_principales.length > 0,
      points: 8,
      href: '/settings/perfil-ia',
    },
    {
      key: 'objeciones',
      label: 'Objeciones frecuentes',
      completed: Array.isArray(p.objeciones_frecuentes) && p.objeciones_frecuentes.length > 0,
      points: 15,
      href: '/settings/perfil-ia',
    },
    {
      key: 'ctas',
      label: 'CTAs efectivos',
      completed: Array.isArray(p.ctas_efectivos) && p.ctas_efectivos.length > 0,
      points: 15,
      href: '/settings/perfil-ia',
    },
    {
      key: 'historias',
      label: 'Historias personales',
      completed: Array.isArray(p.historias_personales) && p.historias_personales.length > 0,
      points: 10,
      href: '/settings/perfil-ia',
    },
    {
      key: 'marca',
      label: 'Marca visual',
      completed: !!(p.instagram_handle && p.tagline),
      points: 10,
      href: '/brand-builder',
    },
  ]
}

export function IntelligenceCard({ profile, score }: IntelligenceCardProps) {
  const sections = getSections(profile)
  const incomplete = sections.filter((s) => !s.completed)
  const nextSection = incomplete[0]

  const barColor =
    score < 40 ? 'bg-red-400' :
    score < 70 ? 'bg-amber-400' :
    'bg-emerald-500'

  const label =
    score < 40 ? 'Básico' :
    score < 70 ? 'En progreso' :
    score < 90 ? 'Avanzado' :
    'Completo'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Perfil de IA</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Cuanto más completo, más la IA suena como tú
          </p>
        </div>
        <span
          className={cn(
            'text-xs font-semibold px-2 py-0.5 rounded-full',
            score < 40 && 'bg-red-50 text-red-600',
            score >= 40 && score < 70 && 'bg-amber-50 text-amber-700',
            score >= 70 && 'bg-emerald-50 text-emerald-700'
          )}
        >
          {label}
        </span>
      </div>

      {/* Score bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-gray-500">Completitud</span>
          <span className="text-sm font-bold text-gray-800">{score}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', barColor)}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Sections checklist */}
      <div className="space-y-2 mb-4">
        {sections.map((section) => (
          <Link
            key={section.key}
            href={section.href}
            className="flex items-center gap-2.5 group"
          >
            <div
              className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                section.completed
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-gray-300 group-hover:border-brand-navy-400'
              )}
            >
              {section.completed && (
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <span
              className={cn(
                'text-xs transition-colors',
                section.completed
                  ? 'text-gray-400 line-through'
                  : 'text-gray-600 group-hover:text-brand-navy-600'
              )}
            >
              {section.label}
            </span>
            {!section.completed && (
              <span className="ml-auto text-2xs text-brand-gold-500 font-medium">
                +{section.points}%
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Next action CTA */}
      {nextSection && (
        <Link
          href={nextSection.href}
          className="flex items-center justify-between w-full bg-brand-navy-50 hover:bg-brand-navy-100 transition-colors rounded-lg px-3 py-2.5"
        >
          <span className="text-xs font-medium text-brand-navy-600">
            Siguiente: {nextSection.label}
          </span>
          <svg
            className="h-3.5 w-3.5 text-brand-navy-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
      )}

      {score === 100 && (
        <div className="text-center py-1">
          <p className="text-xs text-emerald-600 font-medium">
            🎉 ¡Perfil completo! La IA suena exactamente como tú.
          </p>
        </div>
      )}
    </div>
  )
}
