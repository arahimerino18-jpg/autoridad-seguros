'use client'

import type { PerformanceMetrics } from '@/types/database'

interface PerformanceDashboardProps {
  metrics: PerformanceMetrics
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  icon,
  color = 'bg-white',
  valueColor = 'text-gray-900',
}: {
  label: string
  value: string | number
  sub?: string
  icon: string
  color?: string
  valueColor?: string
}) {
  return (
    <div className={`${color} rounded-2xl border border-gray-200 p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
          <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  )
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function SimpleBar({
  data,
  label,
  colorClass = 'bg-[#1B2E6B]',
}: {
  data: Record<string, number>
  label: string
  colorClass?: string
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const max = Math.max(...entries.map(([, v]) => v), 1)

  if (entries.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-gray-400">Sin datos suficientes todavía</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-600 mb-3">{label}</p>
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-28 shrink-0 truncate capitalize">{key.replace(/_/g, ' ')}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${colorClass} transition-all`}
              style={{ width: `${(val / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-gray-700 w-8 text-right">{val}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Risk donut ───────────────────────────────────────────────────────────────

function RiskMeter({ low, medium, high }: { low: number; medium: number; high: number }) {
  const total = low + medium + high
  if (total === 0) return <p className="text-xs text-gray-400 text-center py-4">Sin revisiones de compliance todavía</p>

  const pctLow = Math.round((low / total) * 100)
  const pctMed = Math.round((medium / total) * 100)
  const pctHigh = Math.round((high / total) * 100)

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-600 mb-3">Distribución de riesgo en compliance</p>
      {[
        { label: 'Riesgo bajo', pct: pctLow, count: low, color: 'bg-green-500' },
        { label: 'Riesgo medio', pct: pctMed, count: medium, color: 'bg-amber-500' },
        { label: 'Riesgo alto', pct: pctHigh, count: high, color: 'bg-red-500' },
      ].map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
          <span className="text-xs text-gray-500 flex-1">{item.label}</span>
          <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
          </div>
          <span className="text-xs font-mono text-gray-600 w-8 text-right">{item.count}</span>
          <span className="text-xs text-gray-400 w-8">{item.pct}%</span>
        </div>
      ))}
      <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
        Total revisiones: {total}
      </p>
    </div>
  )
}

// ─── Objection funnel ─────────────────────────────────────────────────────────

function ObjectionFunnel({ utilRate, total }: { utilRate: number; total: number }) {
  if (total === 0) {
    return <p className="text-xs text-gray-400 text-center py-4">Sin datos de Objection AI todavía</p>
  }

  const color = utilRate >= 70 ? 'text-green-600' : utilRate >= 40 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="flex items-center gap-6">
      <div className="text-center">
        <p className={`text-4xl font-bold ${color}`}>{utilRate}%</p>
        <p className="text-xs text-gray-500 mt-1">Tasa de utilidad</p>
        <p className="text-xs text-gray-400">de {total} análisis</p>
      </div>
      <div className="flex-1">
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${utilRate >= 70 ? 'bg-green-500' : utilRate >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
            style={{ width: `${utilRate}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {utilRate >= 70 ? '🟢 Tus respuestas de objeciones son muy efectivas' :
           utilRate >= 40 ? '🟡 Hay oportunidad de mejorar la efectividad' :
           '🔴 Considera revisar tus estrategias de respuesta'}
        </p>
      </div>
    </div>
  )
}

// ─── Profile progress ─────────────────────────────────────────────────────────

function ProfileProgress({ score, firstValue }: { score: number; firstValue: string | null }) {
  const scoreColor = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-500'
  const ringColor = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-20 h-20 shrink-0">
        <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke={ringColor} strokeWidth="3"
            strokeDasharray={`${score} ${100 - score}`}
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${scoreColor}`}>
          {score}
        </span>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800 mb-1">Perfil de Inteligencia IA</p>
        <p className="text-xs text-gray-500">
          {score >= 80 ? 'Tu perfil está muy completo — la IA te conoce bien.' :
           score >= 50 ? 'Buen progreso. Completa la entrevista Marco para mejorar.' :
           'Completa el Brand Builder para que la IA entienda tu voz.'}
        </p>
        {firstValue && (
          <p className="text-xs text-[#1B2E6B] mt-1.5 font-medium">
            ✦ Primer contenido generado el {new Date(firstValue).toLocaleDateString('es-US', { dateStyle: 'medium' })}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── AI Activity timeline (by module) ────────────────────────────────────────

function AIActivityBreakdown({ byModule, totalMes, costoMes }: {
  byModule: Record<string, number>
  totalMes: number
  costoMes: number
}) {
  const MODULE_LABELS: Record<string, { label: string; icon: string }> = {
    content_studio:   { label: 'Content Studio', icon: '✍️' },
    marketing_copilot: { label: 'Marketing Copilot', icon: '🎯' },
    objection_ai:     { label: 'Objection AI', icon: '🛡️' },
    compliance_center: { label: 'Compliance Review', icon: '⚖️' },
    interview:        { label: 'Entrevista Marco', icon: '🎙️' },
    growth_engine:    { label: 'AI Growth Engine', icon: '📊' },
  }

  const entries = Object.entries(byModule).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, v]) => s + v, 0)

  if (total === 0) {
    return <p className="text-xs text-gray-400 text-center py-4">Sin actividad de IA registrada todavía</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-600">Llamadas IA este mes</p>
        <div className="text-right">
          <span className="text-lg font-bold text-gray-900">{totalMes}</span>
          {costoMes > 0 && (
            <p className="text-xs text-gray-400">${costoMes.toFixed(3)} estimado</p>
          )}
        </div>
      </div>
      {entries.slice(0, 5).map(([mod, count]) => {
        const cfg = MODULE_LABELS[mod] ?? { label: mod, icon: '🤖' }
        const pct = Math.round((count / total) * 100)
        return (
          <div key={mod} className="flex items-center gap-3">
            <span className="text-sm shrink-0">{cfg.icon}</span>
            <span className="text-xs text-gray-600 flex-1 truncate">{cfg.label}</span>
            <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-[#4A90D9] rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-mono text-gray-600 w-6 text-right">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PerformanceDashboard({ metrics: m }: PerformanceDashboardProps) {
  return (
    <div className="space-y-6">

      {/* Row 1: Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Contenido generado"
          value={m.contenidos_total}
          sub={`${m.contenidos_mes} este mes`}
          icon="✍️"
        />
        <MetricCard
          label="Análisis de objeciones"
          value={m.objections_total}
          sub={`${m.objections_util_rate}% efectividad`}
          icon="🛡️"
          valueColor={m.objections_total > 0 ? 'text-[#1B2E6B]' : 'text-gray-400'}
        />
        <MetricCard
          label="Revisiones de compliance"
          value={m.compliance_checks}
          sub={m.compliance_risk_high > 0 ? `${m.compliance_risk_high} riesgo alto` : 'Sin riesgo alto'}
          icon="⚖️"
          valueColor={m.compliance_risk_high > 0 ? 'text-amber-600' : 'text-gray-900'}
        />
        <MetricCard
          label="Inferencias propuestas"
          value={m.inferencias_propuestas}
          sub={`${m.inferencias_aprobadas} aprobadas`}
          icon="✦"
          valueColor="text-[#1B2E6B]"
        />
      </div>

      {/* Row 2: Profile + Objection effectiveness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <ProfileProgress
            score={m.perfil_score}
            firstValue={m.first_value_generated_at}
          />
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm font-bold text-gray-800 mb-4">Efectividad de Objection AI</p>
          <ObjectionFunnel utilRate={m.objections_util_rate} total={m.objections_total} />
        </div>
      </div>

      {/* Row 3: Content breakdown + compliance risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <SimpleBar
            data={m.contenidos_por_producto}
            label="Contenido por producto"
            colorClass="bg-[#1B2E6B]"
          />
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <RiskMeter
            low={m.compliance_risk_low}
            medium={m.compliance_risk_medium}
            high={m.compliance_risk_high}
          />
        </div>
      </div>

      {/* Row 4: Objection types + AI activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <SimpleBar
            data={m.objections_por_tipo}
            label="Objeciones más frecuentes (90 días)"
            colorClass="bg-[#D4A017]"
          />
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <AIActivityBreakdown
            byModule={m.ai_calls_por_modulo}
            totalMes={m.ai_calls_mes}
            costoMes={m.costo_usd_mes}
          />
        </div>
      </div>

      {/* Row 5: Content by canal + aggregator stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <SimpleBar
            data={m.contenidos_por_canal}
            label="Contenido por canal"
            colorClass="bg-[#4A90D9]"
          />
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm font-bold text-gray-800 mb-4">Evidence Aggregator</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Propuestas', value: m.inferencias_propuestas, color: 'text-[#1B2E6B]' },
              { label: 'Aprobadas', value: m.inferencias_aprobadas, color: 'text-green-600' },
              { label: 'Rechazadas', value: m.inferencias_rechazadas, color: 'text-red-500' },
            ].map(item => (
              <div key={item.label} className="text-center bg-gray-50 rounded-xl p-3">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            {m.inferencias_propuestas === 0
              ? 'Usa la plataforma más para acumular señales y recibir inferencias'
              : m.inferencias_aprobadas === 0
              ? 'Hay inferencias pendientes — revísalas en Brand Builder → Inteligencia IA'
              : '✓ El ciclo de aprendizaje está activo'}
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-400 text-center">
          Los datos reflejan tu actividad en Autoridad Seguros AI™. El costo de IA es estimado.
          Las métricas de compliance son de apoyo — no certifican cumplimiento regulatorio.
        </p>
      </div>
    </div>
  )
}
