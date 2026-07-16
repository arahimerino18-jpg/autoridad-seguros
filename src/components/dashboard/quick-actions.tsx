'use client'

import Link from 'next/link'
import { useUsage } from './usage-provider'
import { cn } from '@/lib/utils'

const ACTIONS = [
  {
    href: '/content-studio?tipo=post',
    icon: '✍️',
    label: 'Post de Instagram',
    desc: 'Genera en 30 segundos',
    color: 'hover:bg-brand-navy-50 hover:border-brand-navy-200',
    module: 'content_studio' as const,
  },
  {
    href: '/content-studio?tipo=carousel',
    icon: '📸',
    label: 'Carrusel 6 slides',
    desc: 'Tu diferenciador #1',
    color: 'hover:bg-brand-sky-50 hover:border-brand-sky-200',
    module: 'content_studio' as const,
  },
  {
    href: '/content-studio?tipo=whatsapp',
    icon: '💬',
    label: 'Mensaje WhatsApp',
    desc: 'Con markdown nativo',
    color: 'hover:bg-emerald-50 hover:border-emerald-200',
    module: 'content_studio' as const,
  },
  {
    href: '/objection-ai',
    icon: '🛡️',
    label: 'Manejar objeción',
    desc: '6 respuestas en 30s',
    color: 'hover:bg-red-50 hover:border-red-200',
    module: 'objection_ai' as const,
  },
]

export function QuickActions() {
  const { canGenerate } = useUsage()

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Acciones rápidas
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ACTIONS.map((action) => {
          const moduleKey = action.module === 'objection_ai' ? 'content_studio' : action.module
          const disabled = !canGenerate(moduleKey)

          return (
            <Link
              key={action.href}
              href={disabled ? '/billing' : action.href}
              className={cn(
                'flex flex-col gap-2 p-4 rounded-xl border border-gray-200 bg-white',
                'transition-all duration-150 group',
                disabled
                  ? 'opacity-60 cursor-not-allowed'
                  : action.color
              )}
            >
              <span className="text-2xl">{action.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 leading-tight">
                  {action.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{action.desc}</p>
              </div>
              {disabled && (
                <span className="text-2xs text-brand-sky-500 font-medium">
                  Límite alcanzado →
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
