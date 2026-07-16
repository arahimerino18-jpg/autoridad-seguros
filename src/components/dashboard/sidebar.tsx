'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { UsageProgress, PlanBadge } from '@/components/ui'
import { useUsage } from './usage-provider'
import type { PlanTier } from '@/types/database'

// ─── Navigation structure ─────────────────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: string
  phase?: number   // For items not yet built — shows "Próximamente"
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    label: 'Performance',
    href: '/performance',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    label: 'Content Studio',
    href: '/content-studio',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
      </svg>
    ),
  },
  {
    label: 'Objection AI™',
    href: '/objection-ai',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    label: 'Marketing Copilot',
    href: '/marketing-copilot',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.992.29-1.96.8-2.8A5 5 0 006.23 10H6a5 5 0 004.8 5H12v-1z" />
      </svg>
    ),
    phase: 5,
  },
  {
    label: 'Mis contenidos',
    href: '/contenidos',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
      </svg>
    ),
  },
]

const BOTTOM_NAV: NavItem[] = [
  {
    label: 'Brand Builder',
    href: '/brand-builder',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486z"
          clipRule="evenodd"
        />
      </svg>
    ),
    phase: 4,
  },
  {
    label: 'Configuración',
    href: '/settings',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
]

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  profile: Record<string, unknown>
  intelScore: number
}

export function Sidebar({ profile, intelScore }: SidebarProps) {
  const pathname = usePathname()
  const { usage, planLimit, contenidosPercentage } = useUsage()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex flex-col w-60 shrink-0 bg-white border-r border-gray-100 h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-navy-500 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-navy-500 leading-tight truncate">
              Autoridad Seguros
            </p>
            <p className="text-2xs text-gray-400">AI™</p>
          </div>
        </Link>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
        ))}
      </nav>

      {/* Usage counter */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="mb-1">
          <UsageProgress
            used={usage.contenidos_mes}
            max={planLimit.max_contenidos_mes}
            label="Contenidos este mes"
            showNumbers
          />
        </div>
        {contenidosPercentage >= 80 && planLimit.max_contenidos_mes !== -1 && (
          <Link
            href="/precios"
            className="block text-2xs text-brand-sky-500 hover:underline mt-1"
          >
            Mejorar plan →
          </Link>
        )}
      </div>

      {/* Intelligence profile score */}
      <div className="px-4 py-3 border-t border-gray-100">
        <Link
          href="/brand-builder?tab=inteligencia"
          className="flex items-center justify-between group"
        >
          <span className="text-xs text-gray-500 group-hover:text-brand-navy-500 transition-colors">
            Perfil de IA
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  intelScore < 40 ? 'bg-red-400' : intelScore < 70 ? 'bg-amber-400' : 'bg-emerald-500'
                )}
                style={{ width: `${intelScore}%` }}
              />
            </div>
            <span className="text-2xs font-medium text-gray-500">{intelScore}%</span>
          </div>
        </Link>
      </div>

      {/* Bottom navigation */}
      <div className="px-2 py-2 border-t border-gray-100 space-y-0.5">
        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
        ))}
      </div>

      {/* Plan badge */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <PlanBadge plan={(profile.plan_tier as PlanTier) ?? 'starter'} />
          <Link
            href="/precios"
            className="text-2xs text-gray-400 hover:text-brand-navy-500 transition-colors"
          >
            {profile.plan_tier !== 'elite' ? 'Mejorar' : 'Gestionar'}
          </Link>
        </div>
      </div>
    </aside>
  )
}

// ─── NavLink sub-component ────────────────────────────────────────────────────

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const isSoon = !!item.phase

  return (
    <Link
      href={isSoon ? '#' : item.href}
      onClick={isSoon ? (e) => e.preventDefault() : undefined}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-brand-navy-50 text-brand-navy-600'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
        isSoon && 'opacity-50 cursor-not-allowed'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <span
        className={cn(
          'shrink-0',
          isActive ? 'text-brand-navy-500' : 'text-gray-400'
        )}
      >
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
      {isSoon && (
        <span className="ml-auto text-2xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded shrink-0">
          Pronto
        </span>
      )}
      {item.badge && !isSoon && (
        <span className="ml-auto text-2xs bg-brand-gold-50 text-brand-gold-500 font-semibold px-1.5 py-0.5 rounded shrink-0">
          {item.badge}
        </span>
      )}
    </Link>
  )
}
