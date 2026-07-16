'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { IntelSource, InferenciaPendiente, InferenciaPendienteV2 } from '@/types/database'
import { runAggregatorAction } from '@/lib/intelligence/actions'
import { getIntelProfileHistory, getFieldHistory, revertIntelFieldAction } from '@/lib/intelligence/history'
import { getInferenceLifecycle } from '@/lib/intelligence/lifecycle'
import type { InferenceLifecycleEntry } from '@/types/database'
import type { IntelProfileHistoryEntry, FieldConfidenceScore } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntelField {
  campo: string
  label: string
  valor: unknown
  source: string
  descripcion: string
}

interface TabInteligenciaIAProps {
  userId: string
  intelData: Record<string, unknown>
}

interface EditState {
  inferencia: InferenciaPendiente | InferenciaPendienteV2
  valorEditado: string   // Always string for input; parsed on submit
}

// ─── Source badge ─────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<IntelSource, { label: string; color: string; icon: string; description: string }> = {
  declarado:  { label: 'Declarado', color: 'bg-green-100 text-green-800 border-green-200',  icon: '✅', description: 'Tú lo dijiste directamente' },
  observado:  { label: 'Observado', color: 'bg-blue-100 text-blue-800 border-blue-200',    icon: '👁️', description: 'Lo detectamos de tu comportamiento' },
  inferido:   { label: 'Inferido',  color: 'bg-amber-100 text-amber-800 border-amber-200', icon: '🤔', description: 'La IA lo dedujo — pendiente de confirmar' },
  hipotesis:  { label: 'Hipótesis', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: '💭', description: 'Hipótesis de la IA — necesita más señales' },
  confirmado: { label: 'Confirmado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '🔒', description: 'Inferencia que tú aprobaste' },
}

function SourceBadge({ source }: { source: string }) {
  const config = SOURCE_CONFIG[source as IntelSource] ?? SOURCE_CONFIG.declarado
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${config.color}`}
      title={config.description}
    >
      {config.icon} {config.label}
    </span>
  )
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (Array.isArray(v)) return v.join(', ') || '—'
  if (typeof v === 'object') return JSON.stringify(v, null, 2)
  return String(v)
}

// ─── Edit Panel ───────────────────────────────────────────────────────────────
// Shown inline below an inference card when agent clicks "Revisar y editar"

function EditPanel({
  editState,
  onValueChange,
  onApply,
  onCancel,
  saving,
}: {
  editState: EditState
  onValueChange: (val: string) => void
  onApply: () => void
  onCancel: () => void
  saving: boolean
}) {
  const inf = editState.inferencia
  const isMultiLine = typeof inf.valor_inferido === 'object' || String(inf.valor_inferido).length > 80

  return (
    <div className="mt-3 border-t border-amber-200 pt-3 space-y-3">
      <div className="bg-white rounded-xl border border-[#1B2E6B]/20 p-3">
        <p className="text-xs font-semibold text-[#1B2E6B] mb-1">
          ✦ Propuesta de la IA
        </p>
        <p className="text-xs text-gray-600 font-mono bg-gray-50 rounded px-2 py-1">
          {formatValue(inf.valor_inferido)}
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Tu versión (edita si quieres ajustar antes de aprobar)
        </label>
        {isMultiLine ? (
          <textarea
            value={editState.valorEditado}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onValueChange(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/30 resize-none font-mono"
          />
        ) : (
          <input
            type="text"
            value={editState.valorEditado}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onValueChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/30"
          />
        )}
        <p className="text-xs text-gray-400 mt-1">
          El dato se guardará exactamente como lo escribas. Si usas la propuesta de la IA sin cambios, simplemente haz clic en Aplicar.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onApply}
          disabled={saving || !editState.valorEditado.trim()}
          className="flex-1 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Aplicando...' : '✓ Aplicar al perfil'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TabInteligenciaIA({ userId, intelData }: TabInteligenciaIAProps) {
  const supabase = createClient()
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [localInferencias, setLocalInferencias] = useState<(InferenciaPendiente | InferenciaPendienteV2)[]>(
    (intelData.inferencias_pendientes as (InferenciaPendiente | InferenciaPendienteV2)[] | null) ?? []
  )
  const [isPending] = useTransition()
  const [aggregatorStatus, setAggregatorStatus] = useState<string | null>(null)

  // Edit flow state — one card open at a time
  const [editState, setEditState] = useState<EditState | null>(null)

  // History state
  const [historyEntries, setHistoryEntries] = useState<IntelProfileHistoryEntry[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [revertingId, setRevertingId] = useState<string | null>(null)
  const [fieldHistoryOpen, setFieldHistoryOpen] = useState<string | null>(null)
  const [fieldHistoryData, setFieldHistoryData] = useState<Record<string, IntelProfileHistoryEntry[]>>({})
  const [loadingFieldHistory, setLoadingFieldHistory] = useState<string | null>(null)
  const [lifecycleOpen, setLifecycleOpen] = useState<string | null>(null)
  const [lifecycleData, setLifecycleData] = useState<Record<string, InferenceLifecycleEntry[]>>({})

  // Build field list from intel data
  const fields: IntelField[] = [
    {
      campo: 'tono_comunicacion',
      label: 'Tono de comunicación',
      valor: intelData.tono_comunicacion,
      source: (intelData.tono_source as string) ?? 'declarado',
      descripcion: 'Cómo hablas con tus prospectos',
    },
    {
      campo: 'nivel_formalidad',
      label: 'Nivel de formalidad',
      valor: intelData.nivel_formalidad,
      source: (intelData.estilo_source as string) ?? 'declarado',
      descripcion: 'Escala 1-5 de formal a informal',
    },
    {
      campo: 'frases_propias',
      label: 'Frases características',
      valor: intelData.frases_propias,
      source: (intelData.frases_source as string) ?? 'declarado',
      descripcion: 'Expresiones que definen tu voz',
    },
    {
      campo: 'palabras_a_evitar',
      label: 'Palabras a evitar',
      valor: intelData.palabras_a_evitar,
      source: 'declarado',
      descripcion: 'Términos que no usas en tu comunicación',
    },
    {
      campo: 'mercado_objetivo',
      label: 'Mercado objetivo',
      valor: intelData.mercado_objetivo,
      source: (intelData.mercado_source as string) ?? 'declarado',
      descripcion: 'Tu audiencia principal',
    },
    {
      campo: 'propuesta_de_valor',
      label: 'Propuesta de valor',
      valor: intelData.propuesta_de_valor,
      source: 'declarado',
      descripcion: 'Por qué los clientes te eligen a ti',
    },
    {
      campo: 'objeciones_frecuentes',
      label: 'Objeciones frecuentes',
      valor: intelData.objeciones_frecuentes,
      source: (intelData.objeciones_source as string) ?? 'declarado',
      descripcion: 'Objeciones que tus prospectos plantean más',
    },
    {
      campo: 'ctas_efectivos',
      label: 'CTAs efectivos',
      valor: intelData.ctas_efectivos,
      source: (intelData.ctas_source as string) ?? 'declarado',
      descripcion: 'Llamadas a la acción que mejor funcionan',
    },
    {
      campo: 'cliente_ideal_json',
      label: 'Cliente ideal (perfil completo)',
      valor: intelData.cliente_ideal_json ? '✓ Perfil generado con Cliente Ideal AI' : null,
      source: (intelData.cliente_ideal_source as string) ?? 'declarado',
      descripcion: 'Perfil detallado de tu prospecto ideal',
    },
  ].filter(f => f.valor !== null && f.valor !== undefined && f.valor !== '')

  // ─── Approve (with edit) ───────────────────────────────────────────────────

  const openEdit = (inferencia: InferenciaPendiente | InferenciaPendienteV2) => {
    setEditState({
      inferencia,
      valorEditado: formatValue(inferencia.valor_inferido),
    })
  }

  const handleApplyEdit = async () => {
    if (!editState) return
    const inf = editState.inferencia
    const isV2 = 'valor_hash' in inf

    setSaving(inf.campo)
    try {
      // Parse the edited value back to its natural type
      const rawValue = editState.valorEditado.trim()
      let parsedValue: unknown = rawValue
      try { parsedValue = JSON.parse(rawValue) } catch { /* keep as string */ }

      if (isV2) {
        const { approveInferenceAction } = await import('@/lib/intelligence/actions')
        // If edited, we apply the custom value directly (bypass server action's stored valor_inferido)
        const edited = rawValue !== formatValue(inf.valor_inferido)
        if (edited) {
          // Apply custom value directly to DB
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('agent_intelligence_profiles').update({
            [inf.campo]: parsedValue,
            [`${inf.campo}_source`]: 'confirmado',
            inferencias_pendientes: localInferencias.filter(i => i.campo !== inf.campo),
            updated_at: new Date().toISOString(),
          }).eq('user_id', userId)
        } else {
          // No edit — use standard server action
          await approveInferenceAction(inf.campo, (inf as InferenciaPendienteV2).valor_hash)
        }
      } else {
        // Legacy path
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('agent_intelligence_profiles').update({
          [inf.campo]: parsedValue,
          [`${inf.campo}_source`]: 'confirmado',
          inferencias_pendientes: localInferencias.filter(i => i.campo !== inf.campo),
        }).eq('user_id', userId)
      }

      setLocalInferencias(prev => prev.filter(i => i.campo !== inf.campo))
      setEditState(null)
      setMessage(`✓ "${inf.campo}" aplicado al perfil IA`)
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage('Error al aplicar la inferencia')
    } finally {
      setSaving(null)
    }
  }

  // ─── Reject ────────────────────────────────────────────────────────────────

  const handleReject = async (inferencia: InferenciaPendiente | InferenciaPendienteV2) => {
    setSaving(inferencia.campo + '_reject')
    if (editState?.inferencia.campo === inferencia.campo) setEditState(null)
    try {
      const isV2 = 'valor_hash' in inferencia
      if (isV2) {
        const { rejectInferenceAction } = await import('@/lib/intelligence/actions')
        await rejectInferenceAction(inferencia.campo, (inferencia as InferenciaPendienteV2).valor_hash)
      } else {
        const updated = localInferencias.filter(i => i.campo !== inferencia.campo)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('agent_intelligence_profiles')
          .update({ inferencias_pendientes: updated })
          .eq('user_id', userId)
      }
      setLocalInferencias(prev => prev.filter(i => i.campo !== inferencia.campo))
      setMessage('✗ Rechazado — no se volverá a proponer sin nueva evidencia significativa')
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage('Error al rechazar la inferencia')
    } finally {
      setSaving(null)
    }
  }

  // ─── Mark reviewed ─────────────────────────────────────────────────────────

  const handleMarkReviewed = async () => {
    setSaving('reviewed')
    // Direct write is OK here — perfil_ia_revisado_en is not a content field
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('agent_intelligence_profiles')
      .update({ perfil_ia_revisado_en: new Date().toISOString() })
      .eq('user_id', userId)
    setMessage('✓ Perfil marcado como revisado')
    setSaving(null)
    setTimeout(() => setMessage(null), 3000)
  }

  const lastReviewed = intelData.perfil_ia_revisado_en as string | null

  return (
    <div className="space-y-6">

      {/* Header explanation */}
      <div className="bg-gradient-to-br from-[#1B2E6B]/5 to-[#1B2E6B]/10 rounded-xl border border-[#1B2E6B]/15 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🧠</span>
          <div>
            <h3 className="font-bold text-gray-800 mb-1">Lo que la IA sabe sobre ti</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Esta pantalla muestra exactamente qué información usa la IA para personalizar todo el contenido,
              de dónde vino cada dato, y te da control total para revisar, editar y aprobar o rechazar inferencias.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
                <span key={key} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toast message */}
      {message && (
        <div className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
          message.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      {/* Pending inferences */}
      {localInferencias.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">
              {localInferencias.length}
            </span>
            Inferencias pendientes de revisión
          </h3>
          <div className="space-y-3">
            {localInferencias.map((inf) => {
              const isV2 = 'evidence_count' in inf
              const v2 = isV2 ? inf as InferenciaPendienteV2 : null
              const confidenceLabel = v2?.confidence === 'high' ? '● Alta confianza' : v2?.confidence === 'medium' ? '● Confianza media' : '● Baja confianza'
              const confidenceClass = v2?.confidence === 'high' ? 'text-green-600' : v2?.confidence === 'medium' ? 'text-amber-600' : 'text-gray-500'
              const hashKey = v2?.valor_hash ?? inf.campo
              const isEditing = editState?.inferencia.campo === inf.campo

              return (
                <div key={hashKey} className={`rounded-xl border-2 p-4 transition-all ${isEditing ? 'border-[#1B2E6B]/30 bg-[#1B2E6B]/3' : 'border-amber-200 bg-amber-50/50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-semibold text-amber-700">{inf.campo}</p>
                        {v2 && (
                          <span className={`text-xs font-semibold ${confidenceClass}`}>
                            {confidenceLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800">{inf.descripcion}</p>
                      {v2?.signal_summary && (
                        <p className="text-xs text-[#1B2E6B] mt-1.5 bg-[#1B2E6B]/5 px-2 py-1 rounded">
                          📊 {v2.signal_summary}
                        </p>
                      )}
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-500">
                          Valor actual: <span className="font-mono text-gray-700">{formatValue(inf.valor_actual) || '—'}</span>
                        </p>
                        <p className="text-xs text-amber-700">
                          Valor sugerido: <span className="font-mono font-semibold">{formatValue(inf.valor_inferido)}</span>
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {v2?.evidence_count && (
                            <span className="text-xs text-gray-400">📈 {v2.evidence_count} señales</span>
                          )}
                          {v2?.evidence_sources && v2.evidence_sources.length > 0 && (
                            <span className="text-xs text-gray-400">Fuentes: {v2.evidence_sources.join(', ')}</span>
                          )}
                          <span className="text-xs text-gray-400">{new Date(inf.fecha_inferencia).toLocaleDateString('es-US')}</span>
                        </div>
                      </div>

                      {/* Edit panel — inline, below the inference details */}
                      {isEditing && editState && (
                        <EditPanel
                          editState={editState}
                          onValueChange={(val) => setEditState(prev => prev ? { ...prev, valorEditado: val } : null)}
                          onApply={handleApplyEdit}
                          onCancel={() => setEditState(null)}
                          saving={saving === inf.campo}
                        />
                      )}
                    </div>

                    {/* Action buttons */}
                    {!isEditing && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => openEdit(inf)}
                          disabled={!!saving}
                          className="px-3 py-1.5 rounded-lg bg-[#1B2E6B] text-white text-xs font-semibold hover:bg-[#16255a] disabled:opacity-50 transition-colors"
                        >
                          ✦ Revisar y aplicar
                        </button>
                        <button
                          onClick={() => handleReject(inf)}
                          disabled={saving === inf.campo + '_reject'}
                          className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          {saving === inf.campo + '_reject' ? '...' : '✗ Rechazar'}
                        </button>
                      </div>
                    )}
                    {/* Lifecycle timeline toggle */}
                    {isV2 && v2?.valor_hash && (
                      <button
                        onClick={async () => {
                          const key = v2.valor_hash
                          if (lifecycleOpen === key) { setLifecycleOpen(null); return }
                          if (!lifecycleData[key]) {
                            const allEntries = await getInferenceLifecycle(inf.campo)
                            const entries = allEntries.filter((e: InferenceLifecycleEntry) => e.valor_hash === key)
                            setLifecycleData(prev => ({ ...prev, [key]: entries }))
                          }
                          setLifecycleOpen(key)
                        }}
                        className="text-xs text-gray-400 hover:text-[#1B2E6B] mt-1 underline underline-offset-2"
                      >
                        {lifecycleOpen === v2.valor_hash ? 'Ocultar ciclo de vida' : 'Ver ciclo de vida'}
                      </button>
                    )}
                    {isV2 && v2?.valor_hash && lifecycleOpen === v2.valor_hash && (
                      <div className="mt-2 pt-2 border-t border-amber-100 space-y-1">
                        {(lifecycleData[v2.valor_hash] ?? []).length === 0 ? (
                          <p className="text-xs text-gray-400">Sin historial de ciclo de vida</p>
                        ) : (
                          (lifecycleData[v2.valor_hash] ?? []).map((entry: InferenceLifecycleEntry) => {
                            const estadoColors: Record<string, string> = {
                              pendiente: 'text-amber-600', aprobada: 'text-blue-600',
                              aplicada: 'text-green-600', rechazada: 'text-red-500',
                              revertida: 'text-purple-600', archivada: 'text-gray-400',
                            }
                            return (
                              <div key={entry.id} className="flex items-center gap-2 text-xs">
                                <div className="w-1.5 h-1.5 rounded-full bg-current shrink-0" style={{color: 'inherit'}} />
                                <span className={`font-semibold ${estadoColors[entry.estado] ?? 'text-gray-600'}`}>{entry.estado}</span>
                                <span className="text-gray-400">{new Date(entry.created_at).toLocaleString('es-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                {entry.motivo && <span className="text-gray-400 italic">· {entry.motivo}</span>}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Known fields with Confidence Score */}
      <div>
        <h3 className="font-bold text-gray-800 mb-3">Perfil actual de la IA</h3>
        {fields.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-400 text-sm">Completa la entrevista con Marco para que la IA conozca tu perfil</p>
          </div>
        ) : (
          <div className="space-y-2">
            {fields.map((field) => {
              // Build inline confidence score for this field
              const confScore: FieldConfidenceScore = {
                campo: field.campo,
                label: field.label,
                source: field.source as import('@/types/database').IntelSource,
                confidence: field.source === 'confirmado' ? 'confirmed'
                  : field.source === 'declarado' ? 'declarado'
                  : field.source === 'inferido' ? 'medium'
                  : field.source === 'hipotesis' ? 'low'
                  : 'low',
                evidence_category: field.source === 'declarado' || field.source === 'confirmado' ? 'directa'
                  : field.source === 'inferido' || field.source === 'hipotesis' ? 'inferida'
                  : 'observada',
                explanation: field.source === 'declarado' ? 'Declarado directamente por ti'
                  : field.source === 'confirmado' ? 'Inferencia aprobada por ti — equivalente a declarado'
                  : field.source === 'inferido' ? 'Inferido por la IA desde señales de comportamiento'
                  : field.source === 'hipotesis' ? 'Hipótesis de la IA — necesita más señales'
                  : 'Detectado de tu comportamiento en la plataforma',
                last_updated: null,
              }
              const confColors: Record<string, string> = {
                declarado: 'text-green-600',
                confirmed: 'text-emerald-600',
                high: 'text-green-600',
                medium: 'text-amber-600',
                low: 'text-gray-400',
              }
              const confClass = confColors[confScore.confidence] ?? 'text-gray-400'

              return (
                <div key={field.campo} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-600">{field.label}</span>
                        <SourceBadge source={field.source} />
                      </div>
                      <p className="text-xs text-gray-400 mb-2">{field.descripcion}</p>
                      <p className="text-sm text-gray-800 break-words">{formatValue(field.valor)}</p>
                      {/* Confidence Score indicator */}
                      <p className={`text-xs mt-1.5 ${confClass}`} title={confScore.explanation}>
                        {confScore.evidence_category === 'directa' ? '✓' : confScore.evidence_category === 'inferida' ? '~' : '○'} {confScore.explanation}
                      </p>
                      {/* Per-field history toggle */}
                      <button
                        onClick={async () => {
                          if (fieldHistoryOpen === field.campo) {
                            setFieldHistoryOpen(null)
                            return
                          }
                          if (!fieldHistoryData[field.campo]) {
                            setLoadingFieldHistory(field.campo)
                            const entries = await getFieldHistory(field.campo)
                            setFieldHistoryData(prev => ({ ...prev, [field.campo]: entries }))
                            setLoadingFieldHistory(null)
                          }
                          setFieldHistoryOpen(field.campo)
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600 mt-1.5 underline underline-offset-2"
                      >
                        {loadingFieldHistory === field.campo ? 'Cargando...' : fieldHistoryOpen === field.campo ? 'Ocultar historial' : 'Ver historial'}
                      </button>
                      {fieldHistoryOpen === field.campo && (
                        <div className="mt-2 border-t border-gray-100 pt-2 space-y-1.5">
                          {(fieldHistoryData[field.campo] ?? []).length === 0 ? (
                            <p className="text-xs text-gray-400">Sin historial para este campo</p>
                          ) : (
                            (fieldHistoryData[field.campo] ?? []).map(entry => (
                              <div key={entry.id} className="rounded-lg bg-gray-50 border border-gray-100 p-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="text-xs">{entry.source_type === 'inferencia_ia' ? '✦' : entry.source_type === 'reversion' ? '↩' : '✍️'}</span>
                                      <span className="text-xs font-medium text-gray-600">{entry.source_type.replace(/_/g, ' ')}</span>
                                      <span className="text-xs text-gray-400">{new Date(entry.created_at).toLocaleDateString('es-US')}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 break-words">
                                      <span className="line-through opacity-50">{formatValue(entry.valor_anterior)}</span>
                                      {" → "}<span className="font-mono font-medium text-gray-700">{formatValue(entry.valor_nuevo)}</span>
                                    </p>
                                    {entry.motivo && <p className="text-xs text-gray-400 italic mt-0.5">{entry.motivo}</p>}
                                    {entry.fuente_evidencia && <p className="text-xs text-gray-400">Fuente: {entry.fuente_evidencia}</p>}
                                  </div>
                                  {entry.valor_anterior !== null && (
                                    <button
                                      onClick={async () => {
                                        setRevertingId(entry.id)
                                        const result = await revertIntelFieldAction(entry.id)
                                        if (result.success) {
                                          setMessage('↩ Campo revertido al estado anterior')
                                          const updated = await getFieldHistory(field.campo)
                                          setFieldHistoryData(prev => ({ ...prev, [field.campo]: updated }))
                                        } else {
                                          setMessage(`Error: ${result.error}`)
                                        }
                                        setRevertingId(null)
                                        setTimeout(() => setMessage(null), 3000)
                                      }}
                                      disabled={revertingId === entry.id}
                                      className="px-1.5 py-0.5 rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-white disabled:opacity-50 shrink-0 text-xs"
                                      title="Revertir a este estado"
                                    >
                                      {revertingId === entry.id ? '...' : '↩'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Profile History Panel */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={async () => {
            if (!historyLoaded) {
              const entries = await getIntelProfileHistory(30)
              setHistoryEntries(entries)
              setHistoryLoaded(true)
            }
            setShowHistory(h => !h)
          }}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">📋 Historial de versiones</span>
            <span className="text-xs text-gray-400">(últimos 30 cambios)</span>
          </div>
          <span className="text-gray-400 text-xs">{showHistory ? '▲' : '▼'}</span>
        </button>

        {showHistory && (
          <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
            {historyEntries.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                Sin historial de cambios todavía
              </p>
            ) : (
              historyEntries.map((entry) => {
                const sourceLabels: Record<string, { icon: string; label: string }> = {
                  declarado: { icon: '✍️', label: 'Declarado' },
                  inferencia_ia: { icon: '✦', label: 'Inferencia IA aprobada' },
                  inferencia_editada: { icon: '✏️', label: 'Inferencia IA (editada)' },
                  reversion: { icon: '↩', label: 'Reversión' },
                  importado: { icon: '📥', label: 'Importado' },
                }
                const src = sourceLabels[entry.source_type] ?? { icon: '?', label: entry.source_type }
                return (
                  <div key={entry.id} className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs">{src.icon}</span>
                          <span className="text-xs font-semibold text-gray-700">{entry.campo}</span>
                          <span className="text-xs text-gray-400">{src.label}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          <span className="line-through">{formatValue(entry.valor_anterior)}</span>
                          {' → '}
                          <span className="font-medium text-gray-700">{formatValue(entry.valor_nuevo)}</span>
                        </p>
                        {entry.motivo && (
                          <p className="text-xs text-gray-400 mt-0.5 italic">{entry.motivo}</p>
                        )}
                        <p className="text-xs text-gray-300 mt-1">{new Date(entry.created_at).toLocaleString('es-US')}</p>
                      </div>
                      {entry.valor_anterior !== null && entry.valor_anterior !== undefined && (
                        <button
                          onClick={async () => {
                            setRevertingId(entry.id)
                            const result = await revertIntelFieldAction(entry.id)
                            if (result.success) {
                              setMessage('↩ Campo revertido a la versión anterior')
                              const entries = await getIntelProfileHistory(30)
                              setHistoryEntries(entries)
                            } else {
                              setMessage(`Error: ${result.error}`)
                            }
                            setRevertingId(null)
                            setTimeout(() => setMessage(null), 3000)
                          }}
                          disabled={revertingId === entry.id}
                          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50 shrink-0 transition-colors"
                          title="Revertir a este estado"
                        >
                          {revertingId === entry.id ? '...' : '↩'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Aggregator + Reviewed status */}
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-0.5">Evidence Aggregator</p>
            <p className="text-xs text-gray-400">Analiza tus señales y propone inferencias para revisión</p>
            {aggregatorStatus && (
              <p className="text-xs text-[#1B2E6B] mt-1">{aggregatorStatus}</p>
            )}
          </div>
          <button
            onClick={async () => {
              setSaving('aggregator')
              const result = await runAggregatorAction('manual')
              if (result.error) {
                setAggregatorStatus(`Error: ${result.error}`)
              } else if (result.proposed > 0) {
                setAggregatorStatus(`✦ ${result.proposed} nueva(s) inferencia(s) propuesta(s)`)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data } = await (supabase as any)
                  .from('agent_intelligence_profiles')
                  .select('inferencias_pendientes')
                  .eq('user_id', userId)
                  .single()
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setLocalInferencias((data as any)?.inferencias_pendientes ?? localInferencias)
              } else {
                setAggregatorStatus('Sin nuevas inferencias — continúa usando la plataforma')
              }
              setSaving(null)
              setTimeout(() => setAggregatorStatus(null), 5000)
            }}
            disabled={saving === 'aggregator' || isPending}
            className="text-xs px-3 py-1.5 rounded-lg border border-[#1B2E6B]/30 text-[#1B2E6B] font-medium hover:bg-[#1B2E6B]/5 disabled:opacity-50 transition-colors shrink-0"
          >
            {saving === 'aggregator' ? 'Analizando...' : '✦ Analizar señales'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {lastReviewed
              ? `Última revisión: ${new Date(lastReviewed).toLocaleDateString('es-US', { dateStyle: 'long' })}`
              : 'Nunca has revisado tu perfil de IA'
            }
          </p>
          <button
            onClick={handleMarkReviewed}
            disabled={saving === 'reviewed'}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#1B2E6B] text-white font-medium hover:bg-[#16255a] disabled:opacity-50 transition-colors"
          >
            {saving === 'reviewed' ? 'Guardando...' : '✓ Marcar como revisado'}
          </button>
        </div>
      </div>
    </div>
  )
}
