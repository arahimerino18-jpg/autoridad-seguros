'use client'

/**
 * UsageProvider — Autoridad Seguros AI™
 *
 * Distributes current usage counts to all dashboard modules via Context.
 * Prevents each module (Content Studio, Objection AI, etc.) from
 * independently querying Supabase for the same counter data.
 *
 * Key method: refreshUsage() — called after a successful AI generation
 * to update the counter in real-time without a full page reload.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import type { } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

// Subset of PlanLimit used by the usage system
export interface PlanLimitData {
  max_contenidos_mes: number
  max_copilot_mes: number
  max_compliance_mes: number
  max_imagenes_mes: number
  tiene_video_studio: boolean
  tiene_publicacion_directa: boolean
  precio_mensual_usd: number
  precio_anual_usd: number
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UsageCounts {
  contenidos_mes: number
  copilot_mes: number
  compliance_mes: number
  periodo: string
}

interface UsageContextValue {
  usage: UsageCounts
  planLimit: PlanLimitData
  isRefreshing: boolean
  refreshUsage: () => Promise<void>
  // Computed
  contenidosRemaining: number
  contenidosPercentage: number
  isAtLimit: (module: 'content_studio' | 'marketing_copilot' | 'compliance_center') => boolean
  canGenerate: (module: 'content_studio' | 'marketing_copilot' | 'compliance_center') => boolean
}

const UsageContext = createContext<UsageContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

interface UsageProviderProps {
  children: ReactNode
  initialUsage: UsageCounts
  planLimit: PlanLimitData
  userId: string
}

export function UsageProvider({
  children,
  initialUsage,
  planLimit,
  userId,
}: UsageProviderProps) {
  const [usage, setUsage] = useState<UsageCounts>(initialUsage)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const supabase = createClient()

  const refreshUsage = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const now = new Date()
      const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      const { data } = await supabase
        .from('ai_usage')
        .select('modulo')
        .eq('user_id', userId)
        .eq('periodo_mes', periodo)

      if (data) {
        const records = data as Array<{ modulo: string }>
        setUsage({
          contenidos_mes: records.filter((r) => r.modulo === 'content_studio').length,
          copilot_mes: records.filter((r) => r.modulo === 'marketing_copilot').length,
          compliance_mes: records.filter((r) => r.modulo === 'compliance_center').length,
          periodo,
        })
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [supabase, userId])

  const value = useMemo<UsageContextValue>(() => {
    const maxContenidos = planLimit.max_contenidos_mes
    const isUnlimited = maxContenidos === -1

    const contenidosRemaining = isUnlimited
      ? Infinity
      : Math.max(0, maxContenidos - usage.contenidos_mes)

    const contenidosPercentage = isUnlimited
      ? 0
      : Math.min(100, Math.round((usage.contenidos_mes / maxContenidos) * 100))

    const isAtLimit = (module: 'content_studio' | 'marketing_copilot' | 'compliance_center') => {
      if (module === 'content_studio') {
        return !isUnlimited && usage.contenidos_mes >= maxContenidos
      }
      if (module === 'marketing_copilot') {
        const max = planLimit.max_copilot_mes
        return max !== -1 && usage.copilot_mes >= max
      }
      if (module === 'compliance_center') {
        const max = planLimit.max_compliance_mes
        return max !== -1 && usage.compliance_mes >= max
      }
      return false
    }

    return {
      usage,
      planLimit,
      isRefreshing,
      refreshUsage,
      contenidosRemaining,
      contenidosPercentage,
      isAtLimit,
      canGenerate: (module) => !isAtLimit(module),
    }
  }, [usage, planLimit, isRefreshing, refreshUsage])

  return <UsageContext.Provider value={value}>{children}</UsageContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUsage(): UsageContextValue {
  const ctx = useContext(UsageContext)
  if (!ctx) {
    throw new Error('useUsage() must be used inside <UsageProvider>.')
  }
  return ctx
}
