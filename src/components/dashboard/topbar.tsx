'use client'

import Link from 'next/link'
import { useState } from 'react'
import { logoutAction } from '@/lib/auth/actions'
import { Avatar } from '@/components/ui'

interface TopbarProps {
  profile: Record<string, unknown>
}

export function Topbar({ profile }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const nombre = (profile.nombre_completo as string) ?? ''
  const email = (profile.email as string) ?? ''
  const foto = (profile.foto_url as string | null) ?? null
  const plan = (profile.plan_tier as string) ?? 'starter'

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-6 gap-4 shrink-0 z-header relative">
      {/* Page title slot — filled by each page via a portal in future phases */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Plan upgrade CTA — only show for non-elite */}
        {plan !== 'elite' && (
          <Link
            href="/billing"
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium bg-brand-gold-50 text-brand-gold-500 hover:bg-brand-gold-100 transition-colors px-3 py-1.5 rounded-full"
          >
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5 2a1 1 0 011 1v1h8V3a1 1 0 112 0v1h.5A2.5 2.5 0 0119 6.5v10a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 011 16.5v-10A2.5 2.5 0 013.5 4H4V3a1 1 0 011-1zm0 5a1 1 0 000 2h10a1 1 0 100-2H5z"
                clipRule="evenodd"
              />
            </svg>
            Mejorar plan
          </Link>
        )}

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <Avatar src={foto} name={nombre} size="sm" />
            <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
              {nombre.split(' ')[0]}
            </span>
            <svg
              className="h-3.5 w-3.5 text-gray-400 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {menuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-modal"
                onClick={() => setMenuOpen(false)}
              />
              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-card-xl border border-gray-100 py-1.5 z-modal">
                {/* User info */}
                <div className="px-3 py-2 border-b border-gray-100 mb-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{nombre}</p>
                  <p className="text-xs text-gray-400 truncate">{email}</p>
                </div>

                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  Configuración
                </Link>

                <Link
                  href="/billing"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                  </svg>
                  Plan y facturación
                </Link>

                <div className="border-t border-gray-100 mt-1 pt-1">
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-red-50 transition-colors"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                      </svg>
                      Cerrar sesión
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
