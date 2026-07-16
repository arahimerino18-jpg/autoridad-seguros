'use client'

import { useState, useTransition } from 'react'
import { runAggregatorAction } from '@/lib/intelligence/actions'
import type { AggregatorConfig } from '@/types/database'

// ─── Profile presets ──────────────────────────────────────────────────────────

type ProfileName = 'conservador' | 'balanceado' | 'agresivo'

interface ConfigProfile {
  name: ProfileName
  label: string
  emoji: string
  description: string
  color: string
  config: Partial<AggregatorConfig>
}

const PROFILES: ConfigProfile[] = [
  {
    name: 'conservador',
    label: 'Conservador',
    emoji: '🛡️',
    description: 'Solo propone inferencias con evidencia muy sólida. Menos sugerencias, pero más confiables.',
    color: 'border-blue-200 bg-blue-50/50',
    config: {
      r1_min_signals:          5,
      r2_min_sessions:         8,
      r3_min_signals:          8,
      r3_min_per_product:      5,
      r4_min_useful_responses: 5,
      r5_min_prospects:        6,
      r5_min_pattern_count:    5,
      r6_min_useful_responses: 5,
      r6_min_phrase_repetitions: 3,
      conf_high_min_signals:   8,
      conf_medium_min_signals: 5,
      rejection_reproposal_evidence_factor: 2.0,
      rejection_reproposal_min_days: 30,
    },
  },
  {
    name: 'balanceado',
    label: 'Balanceado',
    emoji: '⚖️',
    description: 'Configuración recomendada. Equilibra calidad y frecuencia de inferencias.',
    color: 'border-emerald-200 bg-emerald-50/50',
    config: {
      r1_min_signals:          3,
      r2_min_sessions:         5,
      r3_min_signals:          5,
      r3_min_per_product:      3,
      r4_min_useful_responses: 3,
      r5_min_prospects:        4,
      r5_min_pattern_count:    3,
      r6_min_useful_responses: 3,
      r6_min_phrase_repetitions: 2,
      conf_high_min_signals:   5,
      conf_medium_min_signals: 3,
      rejection_reproposal_evidence_factor: 1.5,
      rejection_reproposal_min_days: 14,
    },
  },
  {
    name: 'agresivo',
    label: 'Agresivo',
    emoji: '🚀',
    description: 'Propone inferencias con menos evidencia. Más sugerencias, requiere más revisión manual.',
    color: 'border-amber-200 bg-amber-50/50',
    config: {
      r1_min_signals:          2,
      r2_min_sessions:         3,
      r3_min_signals:          3,
      r3_min_per_product:      2,
      r4_min_useful_responses: 2,
      r5_min_prospects:        3,
      r5_min_pattern_count:    2,
      r6_min_useful_responses: 2,
      r6_min_phrase_repetitions: 2,
      conf_high_min_signals:   4,
      conf_medium_min_signals: 2,
      rejection_reproposal_evidence_factor: 1.2,
      rejection_reproposal_min_days: 7,
    },
  },
]

// ─── Sandbox result ───────────────────────────────────────────────────────────

interface SandboxResult {
  proposed: number
  skipped: number
  reasons: string[]
  config_source: string
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AggregatorConfigUIProps {
  currentConfig: AggregatorConfig
  userId: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AggregatorConfigUI({ currentConfig, userId }: AggregatorConfigUIProps) {
  const [activeProfile, setActiveProfile] = useState<ProfileName | 'custom'>('balanceado')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [localConfig, setLocalConfig] = useState<AggregatorConfig>(currentConfig)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null)
  const [sandboxLoading, setSandboxLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  void isPending

  const detectActiveProfile = (cfg: AggregatorConfig): ProfileName | 'custom' => {
    for (const profile of PROFILES) {
      const keys = Object.keys(profile.config) as (keyof AggregatorConfig)[]
      const matches = keys.every(k => cfg[k] === profile.config[k])
      if (matches) return profile.name
    }
    return 'custom'
  }

  const applyProfile = (profile: ConfigProfile) => {
    setLocalConfig(prev => ({ ...prev, ...profile.config }))
    setActiveProfile(profile.name)
    setSandboxResult(null)
  }

  const handleAdvancedChange = (key: keyof AggregatorConfig, value: number) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }))
    setActiveProfile(detectActiveProfile({ ...localConfig, [key]: value }))
    setSandboxResult(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/intelligence/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...localConfig, user_id: userId }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (data.success) {
        setMessage('✓ Configuración guardada')
      } else {
        setMessage(`Error: ${data.error}`)
      }
    } catch {
      setMessage('Error al guardar la configuración')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleSandbox = async () => {
    setSandboxLoading(true)
    setSandboxResult(null)
    try {
      // Run the aggregator in dry-run mode via the simulation endpoint
      const res = await fetch('/api/intelligence/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: localConfig }),
      })
      const data = await res.json() as SandboxResult
      setSandboxResult(data)
    } catch {
      setMessage('Error al ejecutar la simulación')
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSandboxLoading(false)
    }
  }

  const handleRunForReal = async () => {
    startTransition(async () => {
      await runAggregatorAction('manual')
      setMessage('✦ Aggregator ejecutado — revisa el tab Inteligencia IA')
      setTimeout(() => setMessage(null), 4000)
    })
  }

  const current = activeProfile !== 'custom'
    ? PROFILES.find(p => p.name === activeProfile)
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-bold text-gray-800 mb-1">Evidence Aggregator</h3>
        <p className="text-sm text-gray-500">
          Controla qué tan agresivamente la IA analiza tus señales y propone inferencias para tu perfil.
        </p>
      </div>

      {/* Toast */}
      {message && (
        <div className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
          message.startsWith('✓') || message.startsWith('✦')
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      {/* Profile selector — simple mode */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Modo de análisis</p>
        <div className="grid grid-cols-3 gap-3">
          {PROFILES.map(profile => (
            <button
              key={profile.name}
              onClick={() => applyProfile(profile)}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                activeProfile === profile.name
                  ? profile.color + ' border-current'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-xl mb-1">{profile.emoji}</div>
              <p className="text-sm font-bold text-gray-800">{profile.label}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{profile.description}</p>
            </button>
          ))}
        </div>
        {activeProfile === 'custom' && (
          <p className="text-xs text-amber-600 mt-2">
            ⚙️ Configuración personalizada activa — no coincide con ningún perfil estándar
          </p>
        )}
      </div>

      {/* Advanced mode toggle */}
      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors"
        >
          <span>{showAdvanced ? '▲' : '▼'}</span>
          Modo avanzado — parámetros individuales
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs text-amber-700">
                ⚠️ Modo avanzado. Modifica los parámetros directamente.
                Los cambios aquí pueden no corresponder a ningún perfil estándar.
              </p>
            </div>

            {/* Rule thresholds */}
            {([
              { group: 'Regla 1 — Objeciones frecuentes', params: [
                { key: 'r1_min_signals' as keyof AggregatorConfig, label: 'Señales mínimas', min: 2, max: 10 },
                { key: 'r1_window_days' as keyof AggregatorConfig, label: 'Ventana (días)', min: 14, max: 180 },
              ]},
              { group: 'Regla 2 — Canal preferido', params: [
                { key: 'r2_min_sessions' as keyof AggregatorConfig, label: 'Sesiones mínimas', min: 2, max: 20 },
                { key: 'r2_window_days' as keyof AggregatorConfig, label: 'Ventana (días)', min: 7, max: 90 },
              ]},
              { group: 'Regla 3 — Productos principales', params: [
                { key: 'r3_min_signals' as keyof AggregatorConfig, label: 'Señales mínimas', min: 3, max: 15 },
                { key: 'r3_min_per_product' as keyof AggregatorConfig, label: 'Min por producto', min: 1, max: 8 },
                { key: 'r3_window_days' as keyof AggregatorConfig, label: 'Ventana (días)', min: 14, max: 180 },
              ]},
              { group: 'Confianza', params: [
                { key: 'conf_high_min_signals' as keyof AggregatorConfig, label: 'Señales para ALTA', min: 3, max: 15 },
                { key: 'conf_medium_min_signals' as keyof AggregatorConfig, label: 'Señales para MEDIA', min: 2, max: 8 },
              ]},
              { group: 'Política de re-propuesta', params: [
                { key: 'rejection_reproposal_min_days' as keyof AggregatorConfig, label: 'Días de espera tras rechazo', min: 7, max: 90 },
              ]},
            ] as const).map(section => (
              <div key={section.group}>
                <p className="text-xs font-semibold text-gray-700 mb-2">{section.group}</p>
                <div className="grid grid-cols-2 gap-3">
                  {section.params.map(param => (
                    <div key={param.key}>
                      <div className="flex justify-between mb-1">
                        <label className="text-xs text-gray-600">{param.label}</label>
                        <span className="text-xs font-mono font-bold text-gray-800">
                          {localConfig[param.key] as number}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={param.min}
                        max={param.max}
                        value={localConfig[param.key] as number}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleAdvancedChange(param.key, Number(e.target.value))
                        }
                        className="w-full h-1.5 accent-[#1B2E6B]"
                      />
                      <div className="flex justify-between mt-0.5">
                        <span className="text-xs text-gray-300">{param.min}</span>
                        <span className="text-xs text-gray-300">{param.max}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sandbox simulation */}
      <div className="bg-gradient-to-br from-[#1B2E6B]/5 to-[#4A90D9]/5 rounded-xl border border-[#1B2E6B]/15 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-gray-800 mb-1">🧪 Sandbox — Simular sin aplicar</p>
            <p className="text-xs text-gray-500">
              Ejecuta el Evidence Aggregator con esta configuración en modo simulación.
              No modifica tu perfil ni crea inferencias reales.
            </p>
          </div>
          <button
            onClick={handleSandbox}
            disabled={sandboxLoading}
            className="shrink-0 px-4 py-2 rounded-lg border border-[#1B2E6B]/30 text-[#1B2E6B] text-xs font-semibold hover:bg-[#1B2E6B]/5 disabled:opacity-50 transition-colors"
          >
            {sandboxLoading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-[#1B2E6B]/30 border-t-[#1B2E6B] rounded-full animate-spin" />
                Simulando...
              </span>
            ) : '▶ Simular'}
          </button>
        </div>

        {sandboxResult && (
          <div className="mt-3 pt-3 border-t border-[#1B2E6B]/10 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-[#1B2E6B]">{sandboxResult.proposed}</p>
                <p className="text-xs text-gray-500 mt-0.5">inferencias que se propondrían</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-400">{sandboxResult.skipped}</p>
                <p className="text-xs text-gray-500 mt-0.5">omitidas (pendientes o rechazadas)</p>
              </div>
            </div>
            {sandboxResult.reasons.length > 0 && (
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Detalle</p>
                <div className="space-y-0.5">
                  {sandboxResult.reasons.slice(0, 8).map((r, i) => (
                    <p key={i} className="text-xs text-gray-500 font-mono">{r}</p>
                  ))}
                  {sandboxResult.reasons.length > 8 && (
                    <p className="text-xs text-gray-400">... y {sandboxResult.reasons.length - 8} más</p>
                  )}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400 text-center">
              Fuente de reglas: {sandboxResult.config_source} · Sin cambios aplicados
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-[#1B2E6B] text-white text-sm font-semibold hover:bg-[#16255a] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando...' : '✓ Guardar configuración'}
        </button>
        <button
          onClick={handleRunForReal}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ✦ Ejecutar ahora
        </button>
      </div>

      {current && (
        <p className="text-xs text-center text-gray-400">
          Perfil activo: <strong>{current.emoji} {current.label}</strong> · {current.description}
        </p>
      )}
    </div>
  )
}
