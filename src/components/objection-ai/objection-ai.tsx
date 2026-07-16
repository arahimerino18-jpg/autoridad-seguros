'use client'

import { useState, useRef } from 'react'
import { saveObjectionAction, saveObjectionFeedback } from '@/lib/objection-ai/actions'
import type { ObjecionAnalisis, ObjecionAngulo, ObjecionTipo, CanalObjecion } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ObjectionAIProps {
  agentName: string
}

type Canal = CanalObjecion

const PRODUCTOS = [
  { value: 'medicare', label: 'Medicare' },
  { value: 'aca', label: 'ACA / Marketplace' },
  { value: 'iul', label: 'IUL (Vida Indexada)' },
  { value: 'final_expense', label: 'Gastos Finales' },
  { value: 'life', label: 'Seguro de Vida' },
  { value: 'general', label: 'General' },
]

const CANALES: { value: Canal; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'en_persona', label: 'En persona' },
  { value: 'llamada', label: 'Llamada telefónica' },
  { value: 'messenger', label: 'Messenger / DM' },
  { value: 'otro', label: 'Otro' },
]

const TIPO_LABELS: Record<ObjecionTipo, { emoji: string; label: string; color: string }> = {
  precio:     { emoji: '💰', label: 'Precio / Costo',     color: 'bg-amber-50 text-amber-800 border-amber-200' },
  tiempo:     { emoji: '⏰', label: 'Tiempo / Ocupado',   color: 'bg-blue-50 text-blue-800 border-blue-200' },
  confianza:  { emoji: '🤝', label: 'Confianza / Duda',   color: 'bg-purple-50 text-purple-800 border-purple-200' },
  necesidad:  { emoji: '❓', label: 'No cree necesitarlo', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  autoridad:  { emoji: '👥', label: 'Consultar con otro', color: 'bg-green-50 text-green-800 border-green-200' },
  otro:       { emoji: '💬', label: 'Otra razón',         color: 'bg-gray-50 text-gray-700 border-gray-200' },
}

const RESISTENCIA_CONFIG = {
  baja:  { color: 'text-green-600 bg-green-50',  label: 'Resistencia baja' },
  media: { color: 'text-amber-600 bg-amber-50',  label: 'Resistencia media' },
  alta:  { color: 'text-red-600 bg-red-50',       label: 'Resistencia alta' },
}

const ANGULO_CONFIG: Record<string, { icon: string; color: string }> = {
  empatico:       { icon: '💙', color: 'border-blue-200 bg-blue-50/30' },
  educativo:      { icon: '📚', color: 'border-indigo-200 bg-indigo-50/30' },
  descubrimiento: { icon: '🔍', color: 'border-violet-200 bg-violet-50/30' },
  historia:       { icon: '💬', color: 'border-teal-200 bg-teal-50/30' },
  acuerdo:        { icon: '✅', color: 'border-emerald-200 bg-emerald-50/30' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AnguloCard({
  angulo,
  canal,
  responseId,
  onCopy,
}: {
  angulo: ObjecionAngulo
  canal: Canal
  responseId: string | null
  onCopy: (angulo: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const config = ANGULO_CONFIG[angulo.angulo] ?? { icon: '💡', color: 'border-gray-200 bg-gray-50/30' }
  const useWhatsApp = canal === 'whatsapp' || canal === 'messenger'
  const text = useWhatsApp ? angulo.texto_whatsapp : angulo.texto_verbal

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    onCopy(angulo.angulo)
    if (responseId) {
      await saveObjectionAction(responseId, 'copiado', angulo.angulo)
    }
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`rounded-xl border-2 p-4 ${config.color} transition-all`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <span className="font-semibold text-gray-800 text-sm">{angulo.etiqueta}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm"
        >
          {copied ? (
            <>✓ <span>Copiado</span></>
          ) : (
            <>{useWhatsApp ? '💬' : '🎙️'} <span>Copiar</span></>
          )}
        </button>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed mb-2 whitespace-pre-wrap">{text}</p>
      <p className="text-xs text-gray-500 italic border-t border-gray-200/60 pt-2">
        💡 {angulo.cuando_usar}
      </p>
    </div>
  )
}

function FeedbackRow({ responseId }: { responseId: string }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handle = async (val: 'si' | 'no' | 'no_usada') => {
    setSelected(val)
    await saveObjectionFeedback(responseId, val)
    setSaved(true)
  }

  if (saved) {
    return (
      <p className="text-xs text-green-600 text-center py-2">✓ Gracias por tu feedback — nos ayuda a mejorar</p>
    )
  }

  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <span className="text-xs text-gray-500">¿Te fue útil?</span>
      {([
        { v: 'si', label: '👍 Sí', sel: 'border-green-400 bg-green-50 text-green-700' },
        { v: 'no', label: '👎 No', sel: 'border-red-300 bg-red-50 text-red-700' },
        { v: 'no_usada', label: '⏸ No la usé', sel: 'border-gray-300 bg-gray-50 text-gray-600' },
      ] as const).map(btn => (
        <button
          key={btn.v}
          onClick={() => handle(btn.v)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
            selected === btn.v ? btn.sel : 'border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ObjectionAI({ agentName }: ObjectionAIProps) {
  const [objecion, setObjecion] = useState('')
  const [producto, setProducto] = useState('general')
  const [canal, setCanal] = useState<Canal>('whatsapp')
  const [contexto, setContexto] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [analisis, setAnalisis] = useState<ObjecionAnalisis | null>(null)
  const [responseId, setResponseId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedAngulo, setCopiedAngulo] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleSubmit = async () => {
    if (!objecion.trim()) return
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setIsLoading(true)
    setStreamText('')
    setAnalisis(null)
    setResponseId(null)
    setError(null)
    setCopiedAngulo(null)

    try {
      const res = await fetch('/api/ai/objection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objecion, producto, canal, contexto }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Error al analizar la objeción')
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const raw = line.slice(6)
          if (raw === '[DONE]') break
          try {
            const msg = JSON.parse(raw) as {
              text?: string
              done?: boolean
              analisis?: ObjecionAnalisis
              response_id?: string
              error?: string
            }
            if (msg.text) setStreamText(prev => prev + msg.text)
            if (msg.done) {
              setAnalisis(msg.analisis ?? null)
              setResponseId(msg.response_id ?? null)
              if (msg.error) setError('Error al procesar el análisis')
            }
            if (msg.error) setError(msg.error)
          } catch { /* ignore malformed chunk */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('Error de conexión. Intenta de nuevo.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-br from-[#1B2E6B] to-[#2a4080] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🛡️</span>
          <div>
            <h1 className="text-xl font-bold">Objection AI™</h1>
            <p className="text-blue-200 text-sm">Respuestas éticas y personalizadas para {agentName}</p>
          </div>
        </div>
        <p className="text-blue-100 text-xs leading-relaxed mt-3 border-t border-white/20 pt-3">
          Esta herramienta te ayuda a entender y responder objeciones de manera honesta.
          No usa técnicas de presión — solo comunicación auténtica que construye confianza a largo plazo.
        </p>
      </div>

      {/* Input form */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            ¿Qué te dijo el prospecto? *
          </label>
          <textarea
            value={objecion}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setObjecion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={'Ej: "No tengo dinero para eso ahora mismo" o "Ya tengo seguro con mi trabajo"'}
            rows={3}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/30 focus:border-[#1B2E6B] resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">Escribe la objeción tal como la dijo — entre más exacta, mejor la respuesta. Cmd+Enter para analizar.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Producto</label>
            <select
              value={producto}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProducto(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/30"
            >
              {PRODUCTOS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Canal</label>
            <select
              value={canal}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCanal(e.target.value as Canal)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/30"
            >
              {CANALES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Contexto del prospecto <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={contexto}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContexto(e.target.value)}
            placeholder="Ej: madre soltera de 42 años, cubana, empleada en restaurante"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/30"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading || !objecion.trim()}
          className="w-full py-3 rounded-xl bg-[#1B2E6B] text-white font-semibold text-sm hover:bg-[#16255a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analizando objeción...
            </>
          ) : (
            <>🛡️ Analizar objeción</>
          )}
        </button>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Streaming indicator */}
      {isLoading && streamText && !analisis && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-2">Generando análisis...</p>
          <div className="text-xs text-gray-600 font-mono whitespace-pre-wrap opacity-60 max-h-32 overflow-hidden">
            {streamText.slice(-500)}
          </div>
        </div>
      )}

      {/* Analysis results */}
      {analisis && (
        <div className="space-y-4">

          {/* Summary */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-4">📊 Análisis de la objeción</h2>

            <div className="flex flex-wrap gap-2 mb-4">
              {/* Type badge */}
              {TIPO_LABELS[analisis.tipo] && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${TIPO_LABELS[analisis.tipo].color}`}>
                  {TIPO_LABELS[analisis.tipo].emoji} {TIPO_LABELS[analisis.tipo].label}
                </span>
              )}
              {/* Resistance badge */}
              <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold ${RESISTENCIA_CONFIG[analisis.nivel_resistencia].color}`}>
                ⚡ {RESISTENCIA_CONFIG[analisis.nivel_resistencia].label}
              </span>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">Lo que probablemente significa</p>
                <p className="text-sm text-blue-900">{analisis.significado_real}</p>
              </div>
              <div className="rounded-xl bg-[#1B2E6B]/5 border border-[#1B2E6B]/10 p-3">
                <p className="text-xs font-semibold text-[#1B2E6B] mb-1">Estrategia recomendada</p>
                <p className="text-sm text-gray-700">{analisis.estrategia_recomendada}</p>
              </div>
            </div>
          </div>

          {/* Angle cards */}
          <div>
            <h2 className="font-bold text-gray-800 mb-3">
              💬 5 formas de responder
              <span className="ml-2 text-xs text-gray-400 font-normal">
                {canal === 'whatsapp' || canal === 'messenger' ? '(formato WhatsApp activo)' : '(formato verbal)'}
              </span>
            </h2>
            <div className="space-y-3">
              {analisis.respuestas.map((angulo) => (
                <AnguloCard
                  key={angulo.angulo}
                  angulo={angulo}
                  canal={canal}
                  responseId={responseId}
                  onCopy={setCopiedAngulo}
                />
              ))}
            </div>
            {copiedAngulo && (
              <p className="text-xs text-center text-[#1B2E6B] mt-2 font-medium">
                ✓ Respuesta copiada — lista para usar
              </p>
            )}
          </div>

          {/* Follow-up question */}
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
            <p className="text-xs font-semibold text-amber-700 mb-1.5">🔮 Pregunta de seguimiento sugerida</p>
            <p className="text-sm text-amber-900 italic">"{analisis.pregunta_seguimiento}"</p>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(analisis.pregunta_seguimiento)
              }}
              className="mt-2 text-xs text-amber-700 hover:text-amber-900 underline"
            >
              Copiar pregunta
            </button>
          </div>

          {/* What to avoid */}
          {analisis.que_evitar?.length > 0 && (
            <div className="bg-red-50 rounded-xl border border-red-100 p-4">
              <p className="text-xs font-semibold text-red-700 mb-2">🚫 Qué evitar en esta situación</p>
              <ul className="space-y-1">
                {analisis.que_evitar.map((item, i) => (
                  <li key={i} className="text-xs text-red-800 flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5">✗</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Compliance note */}
          {analisis.compliance_nota && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-600 mb-1">⚖️ Nota de compliance</p>
              <p className="text-xs text-slate-700">{analisis.compliance_nota}</p>
            </div>
          )}

          {/* Feedback */}
          {responseId && (
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <FeedbackRow responseId={responseId} />
            </div>
          )}

          {/* New analysis button */}
          <button
            onClick={() => {
              setAnalisis(null)
              setStreamText('')
              setObjecion('')
              setContexto('')
              setResponseId(null)
              setError(null)
            }}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            + Analizar otra objeción
          </button>
        </div>
      )}
    </div>
  )
}
