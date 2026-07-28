'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useInterview } from '@/hooks/use-interview'
import { saveInterviewResultAction, markSessionCompleteAction } from '@/lib/brand-builder/actions'
import type { InterviewSessionData } from '@/lib/brand-builder/actions'
import { Button, Alert } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ─── Simple Markdown renderer ─────────────────────────────────────────────────
// Handles **bold**, *italic*, and line breaks without a full markdown library.
function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    // Preserve line breaks
    return part.split('\n').map((line, j) => (
      <span key={`${i}-${j}`}>
        {j > 0 && <br />}
        {line}
      </span>
    ))
  })
}


// ─── All 13 interview topics ──────────────────────────────────────────────────
const ALL_TOPICS = [
  'historia_personal','motivacion_profunda','mercado_objetivo',
  'productos_principales','diferenciadores','estilo_comunicacion',
  'valores','cliente_ideal','objeciones_frecuentes',
  'frases_propias','ctas_efectivos','mision_profesional','vision_negocio',
]

// ─── JSON recovery helpers ────────────────────────────────────────────────────

interface RecoveredSummary {
  resumen_visible: string
  datos_estructurados: Record<string, unknown>
}

/**
 * Tries to extract a final structured JSON object from a message that
 * may contain raw JSON (from the previous bug where summary leaked into chat).
 * Returns null if the message is a normal conversational response.
 */
// Profile field keys expected in the final JSON
const PROFILE_ROOT_KEYS = [
  'historia_personal','motivacion_profunda','mercado_objetivo',
  'productos_principales','estilo_comunicacion','diferenciadores',
  'valores','objeciones_frecuentes','frases_propias','ctas_efectivos',
  'mision','vision','mision_profesional','vision_negocio',
  'cliente_ideal','cliente_ideal_descripcion','tono_comunicacion',
  'propuesta_de_valor','historia_profesional','nivel_formalidad',
  'tipo_humor','nivel_emocional','usa_emojis','usa_historias',
]

// METADATA keys — never treat as a profile JSON
const METADATA_ROOT_KEYS = new Set(['temas_cubiertos','listo_para_resumir','extractos'])

function isMetadataObject(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj)
  // METADATA has exactly: temas_cubiertos, listo_para_resumir, extractos (±1 key)
  const metaHits = keys.filter(k => METADATA_ROOT_KEYS.has(k))
  return metaHits.length >= 2 && keys.length <= 5
}

/**
 * Normalizes the parsed JSON to a flat profile object.
 * Handles two structures:
 *   A) Root object with profile keys directly
 *   B) { temas_cubiertos, listo_para_resumir, extractos: { profile keys } }
 */
function normalizeProfileJson(
  parsed: Record<string, unknown>
): Record<string, unknown> | null {
  const rootKeys = Object.keys(parsed)
  const rootProfileHits = rootKeys.filter(k => PROFILE_ROOT_KEYS.includes(k))

  console.log('[normalizeProfileJson] rootKeys=', rootKeys.length, rootKeys.slice(0,6))
  console.log('[normalizeProfileJson] rootProfileHits=', rootProfileHits.length)

  // Case B: profile is nested inside extractos
  if (isMetadataObject(parsed) && typeof parsed.extractos === 'object' && parsed.extractos !== null) {
    const extractos = parsed.extractos as Record<string, unknown>
    const extractosHits = Object.keys(extractos).filter(k =>
      PROFILE_ROOT_KEYS.includes(k) ||
      ['historia_personal','motivacion_profunda','mercado_objetivo','objeciones','frases','ctas','mision','vision'].some(alias => k.includes(alias))
    )
    console.log('[normalizeProfileJson] Case B: extractos keys=', Object.keys(extractos).length, 'hits=', extractosHits.length)
    if (extractosHits.length >= 3) return extractos
    return null
  }

  // Case A: profile keys at root
  if (rootProfileHits.length >= 3) {
    return parsed
  }

  return null
}

/**
 * Builds a human-readable Spanish resumen from profile data.
 * Uses whichever fields are available — never returns empty.
 */
function buildResumenFromProfile(profile: Record<string, unknown>): string {
  const lines: string[] = []

  const get = (key: string): string => {
    const v = profile[key]
    if (typeof v === 'string' && v.trim().length > 3) return v.trim()
    if (Array.isArray(v) && v.length > 0) return (v as string[]).join(', ')
    return ''
  }

  const pv    = get('propuesta_de_valor')
  const hp    = get('historia_personal') || get('historia_profesional')
  const mo    = get('mercado_objetivo')
  const tono  = get('tono_comunicacion')
  const mision = get('mision') || get('mision_profesional')
  const prod  = get('productos_principales')

  if (pv)    lines.push(`Mi propuesta de valor: ${pv}`)
  if (hp)    lines.push(`Mi historia: ${hp}`)
  if (mo)    lines.push(`Mi mercado objetivo: ${mo}`)
  if (prod)  lines.push(`Productos principales: ${prod}`)
  if (tono)  lines.push(`Tono de comunicación: ${tono}`)
  if (mision) lines.push(`Mi misión: ${mision}`)

  const result = lines.join('\n\n')
  console.log('[buildResumenFromProfile] resumen length=', result.length, 'sections=', lines.length)
  return result || 'Perfil recuperado. Puedes editar este resumen antes de guardar.'
}

function tryExtractFinalJson(content: string): RecoveredSummary | null {
  if (!content || typeof content !== 'string') return null

  // Strip only markdown code fences — do NOT strip <!--METADATA:--> here.
  // The profile JSON lives inside the METADATA comment block.
  // Removing it before stack extraction was the regression in 8d43c97.
  // normalizeProfileJson handles separating metadata wrapper from profile data.
  const cleaned = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // Quick check: must have at least 3 profile key strings anywhere in content
  const quickHits = PROFILE_ROOT_KEYS.filter(k => cleaned.includes(`"${k}"`))
  console.log('[tryExtractFinalJson] quickHits=', quickHits.length, quickHits.slice(0, 5))
  if (quickHits.length < 3) return null

  // Stack-based extractor: find ALL top-level JSON objects and test each
  const candidates: string[] = []
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] !== '{') continue
    let depth = 0, j = i
    while (j < cleaned.length) {
      if (cleaned[j] === '{') depth++
      else if (cleaned[j] === '}') { depth--; if (depth === 0) { candidates.push(cleaned.slice(i, j + 1)); break } }
      j++
    }
    // After finding a top-level object, skip past it
    if (depth === 0) i = j
  }

  console.log('[tryExtractFinalJson] candidates found=', candidates.length)

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>
      const normalized = normalizeProfileJson(parsed)
      if (!normalized) {
        console.log('[tryExtractFinalJson] candidate skipped — not a profile object')
        continue
      }

      const resumenVisible = buildResumenFromProfile(normalized)
      console.log('[tryExtractFinalJson] MATCH — profile keys=', Object.keys(normalized).length)
      return { resumen_visible: resumenVisible, datos_estructurados: normalized }
    } catch (err) {
      console.log('[tryExtractFinalJson] parse failed:', (err as Error).message?.slice(0, 60))
    }
  }

  console.log('[tryExtractFinalJson] no valid profile JSON found after scanning', candidates.length, 'candidates')
  return null
}

/**
 * Strips the final JSON block from a message for display purposes.
 */
function stripFinalJson(content: string): string {
  const stripped = content
    .replace(/```json[\s\S]*?```/gi, '')
    .replace(/<!--METADATA:.*?-->/s, '')
    .replace(/\{[\s\S]*"historia_personal"[\s\S]*\}/s, '')
    .trim()
  return stripped || '✓ Entrevista completada'
}

// ─── Topic coverage indicator ─────────────────────────────────────────────────

const TOPIC_LABELS: Record<string, string> = {
  historia_personal: 'Tu historia',
  motivacion_profunda: 'Motivación',
  mercado_objetivo: 'Mercado',
  productos_principales: 'Productos',
  diferenciadores: 'Diferenciadores',
  estilo_comunicacion: 'Estilo',
  valores: 'Valores',
  cliente_ideal: 'Cliente ideal',
  objeciones_frecuentes: 'Objeciones',
  frases_propias: 'Frases propias',
  ctas_efectivos: 'CTAs',
  mision_profesional: 'Misión',
  vision_negocio: 'Visión',
}

function TopicBar({ covered }: { covered: string[] }) {
  const total = Object.keys(TOPIC_LABELS).length
  const pct = Math.round((covered.length / total) * 100)

  return (
    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-navy-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 shrink-0">{covered.length}/{total} temas</span>
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5">
        {Object.entries(TOPIC_LABELS).map(([key, label]) => (
          <span
            key={key}
            className={cn(
              'text-2xs px-1.5 py-0.5 rounded-full transition-all duration-300',
              covered.includes(key)
                ? 'bg-brand-navy-500 text-white'
                : 'bg-gray-200 text-gray-400'
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isStreaming,
}: {
  message: { role: string; displayContent: string }
  isStreaming?: boolean
}) {
  const isAssistant = message.role === 'assistant'

  return (
    <div className={cn('flex gap-3', !isAssistant && 'flex-row-reverse')}>
      {isAssistant && (
        <div className="w-8 h-8 rounded-full bg-brand-navy-500 flex items-center justify-center shrink-0 mt-1">
          <span className="text-white text-xs font-bold">M</span>
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isAssistant
            ? 'bg-gray-100 text-gray-800 rounded-tl-none'
            : 'bg-brand-navy-500 text-white rounded-tr-none'
        )}
      >
        {isAssistant ? renderMarkdown(message.displayContent) : message.displayContent}
        {isStreaming && (
          <span className="inline-block w-1 h-3.5 bg-current ml-0.5 animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  )
}

// ─── Summary review ───────────────────────────────────────────────────────────

function SummaryReview({
  summary,
  onEdit,
  onApprove,
  onRegenerate,
  isLoading,
}: {
  summary: { resumen_visible: string; datos_estructurados: Record<string, unknown> }
  onEdit: (text: string) => void
  onApprove: () => void
  onRegenerate: () => void
  isLoading: boolean
}) {
  const profileKeyCount = Object.keys(summary.datos_estructurados).length
  const hasResumen = summary.resumen_visible.trim().length > 5

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex-1 overflow-y-auto space-y-3">
        <div>
          <h3 className="font-semibold text-gray-800 mb-1">✓ Entrevista completada</h3>
          <p className="text-xs text-gray-500">
            Se recuperaron {profileKeyCount} campos de tu perfil estratégico.
            Revisa y edita el resumen antes de guardar.
          </p>
        </div>

        {!hasResumen && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            El resumen está vacío. Puedes escribir uno o usar "Regenerar" para que la IA lo cree.
          </div>
        )}

        <textarea
          value={summary.resumen_visible}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onEdit(e.target.value)}
          className="w-full h-48 p-3 border border-gray-200 rounded-xl text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-brand-navy-300"
          placeholder="Escribe o edita tu resumen de perfil aquí..."
        />
        <p className="text-xs text-gray-400">
          Este texto personaliza tu contenido, copilot y recomendaciones en toda la plataforma.
        </p>
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        {/* Primary action — always visible */}
        <Button
          size="sm"
          onClick={onApprove}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Guardando...' : '✓ Guardar perfil y continuar'}
        </Button>
        {/* Secondary action */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onRegenerate}
          disabled={isLoading}
          className="w-full"
        >
          Regenerar resumen con IA
        </Button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface InterviewChatProps {
  initialSessionId?: string
  initialSession?: InterviewSessionData | null  // full session for restoration
  onComplete: () => void
  onSkip: () => void
}

export function InterviewChat({ initialSessionId, initialSession, onComplete, onSkip }: InterviewChatProps) {
  const [inputText, setInputText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const {
    phase,
    messages,
    currentStreamText,
    isWaiting,
    metadata,
    summary,
    sessionId,
    error,
    startInterview,
    restoreInterview,
    sendMessage,
    generateSummary,
    setSummaryEdited,
    approveSummary,
  } = useInterview()

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentStreamText])

  // Initialize interview on mount.
  // Uses initialSession (full data) when available — no API call needed.
  // Falls back to startInterview (API call) when starting fresh.
  // All functions referenced (startInterview, restoreInterview) are stable.
  useEffect(() => {
    const sid = initialSession?.sessionId ?? initialSessionId
    if (!sid) {
      console.log('[InterviewChat] no sessionId — waiting')
      return
    }

    const existingMsgs = initialSession?.conversacion ?? []
    const existingTemas = initialSession?.temas_cubiertos ?? []
    console.log('[InterviewChat] mount sid=', sid, 'msgs=', existingMsgs.length, 'temas=', existingTemas.length)

    if (existingMsgs.length > 0) {
      // ── Diagnostics: inspect last 3 messages ───────────────────────────────
      const last3 = existingMsgs.slice(-3)
      console.log('[InterviewChat] últimos 3 mensajes:')
      last3.forEach((m, i) => {
        const raw = m.content
        const t = typeof raw
        const isArr = Array.isArray(raw)
        // Normalize to string for inspection
        const asStr = isArr
          ? JSON.stringify(raw)
          : t === 'object' && raw !== null
            ? JSON.stringify(raw)
            : t === 'string' ? (raw as string) : String(raw ?? '')
        console.log(`  [${existingMsgs.length - 3 + i}] role=${m.role} typeof=${t} isArray=${isArr}`)
        console.log(`       first150=${asStr.slice(0, 150)}`)
        console.log(`       last150=${asStr.slice(-150)}`)
      })

      // ── Scan ALL assistant messages from last to first ──────────────────────
      let recovered: RecoveredSummary | null = null
      const assistantMsgs = [...existingMsgs]
        .map((m, idx) => ({ ...m, _idx: idx }))
        .filter(m => m.role === 'assistant')
        .reverse()

      console.log('[InterviewChat] escaneando', assistantMsgs.length, 'mensajes de assistant...')

      for (const m of assistantMsgs) {
        // Normalize content to string regardless of how it was stored
        let contentStr: string
        if (typeof m.content === 'string') {
          contentStr = m.content
        } else if (Array.isArray(m.content)) {
          // Anthropic sometimes stores content as array of blocks
          contentStr = (m.content as Array<{ type?: string; text?: string }>)
            .map(b => (b.type === 'text' ? (b.text ?? '') : JSON.stringify(b)))
            .join('')
        } else if (m.content !== null && typeof m.content === 'object') {
          contentStr = JSON.stringify(m.content)
        } else {
          contentStr = String(m.content ?? '')
        }

        console.log(`[InterviewChat] msg[${m._idx}] contentStr length=${contentStr.length}`)
        const attempt = tryExtractFinalJson(contentStr)
        console.log(`[InterviewChat] msg[${m._idx}] tryExtract result=`, attempt ? `FOUND (${Object.keys(attempt.datos_estructurados).length} keys)` : 'null')

        if (attempt) {
          recovered = attempt
          // Also clean this message for display
          const cleanedContent = stripFinalJson(contentStr)
          console.log('[InterviewChat] JSON final detectado en msg[' + m._idx + '] — recuperación retroactiva')

          const msgs = existingMsgs.map((msg, idx) => ({
            role: msg.role as 'user' | 'assistant',
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            displayContent: idx === m._idx
              ? cleanedContent
              : msg.role === 'assistant'
                ? (typeof msg.content === 'string'
                    ? msg.content.replace(/<!--METADATA:.*?-->/s, '').trim()
                    : JSON.stringify(msg.content))
                : (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)),
            timestamp: msg.timestamp ?? new Date().toISOString(),
          }))

          void markSessionCompleteAction(sid, recovered.datos_estructurados, recovered.resumen_visible)
            .then(r => {
              if (r.success) console.log('[InterviewChat] sesión marcada como completada en DB')
              else console.error('[InterviewChat] markSessionComplete failed:', r.error)
            })

          restoreInterview(sid, msgs, ALL_TOPICS, recovered)
          return
        }
      }

      // No JSON found — restore as in-progress conversation
      console.log('[InterviewChat] sin JSON final detectado — restaurando conversación en progreso')
      const msgs = existingMsgs.map(m => {
        const contentStr = typeof m.content === 'string'
          ? m.content
          : JSON.stringify(m.content)
        return {
          role: m.role as 'user' | 'assistant',
          content: contentStr,
          displayContent: m.role === 'assistant'
            ? contentStr.replace(/<!--METADATA:.*?-->/s, '').trim()
            : contentStr,
          timestamp: m.timestamp ?? new Date().toISOString(),
        }
      })
      restoreInterview(sid, msgs, existingTemas)
      return
    }

    // No existing messages — call AI for first question
    let cancelled = false
    const timeoutId = setTimeout(() => {
      if (!cancelled) console.error('[InterviewChat] startInterview exceeded 15s')
    }, 15_000)
    void startInterview(sid).finally(() => {
      if (!cancelled) clearTimeout(timeoutId)
    })
    return () => { cancelled = true; clearTimeout(timeoutId) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Stable refs — run once on mount

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isWaiting) return
    const text = inputText
    setInputText('')
    await sendMessage(text)
  }, [inputText, isWaiting, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [handleSend]
  )

  async function handleApprove() {
    const sid = sessionId ?? initialSession?.sessionId ?? initialSessionId ?? ''
    console.log('[handleApprove] sid=', sid, 'resumen length=', summary?.resumen_visible?.length ?? 0,
      'datos keys=', Object.keys(summary?.datos_estructurados ?? {}).length)

    if (!sid) {
      toast.error('Error', 'No se encontró la sesión. Recarga la página.')
      return
    }

    approveSummary()
    setIsSaving(true)

    const result = await saveInterviewResultAction({
      datos_estructurados: summary!.datos_estructurados,
      resumen_visible: summary!.resumen_visible,
      session_id: sid,
    })

    if (result.success) {
      console.log('[handleApprove] guardado OK — avanzando al paso 4')
      toast.success('¡Perfil guardado!', 'Tu Perfil de IA está listo.')
      onComplete()
    } else {
      console.error('[handleApprove] saveInterviewResultAction failed:', result.error)
      toast.error('Error al guardar', result.error)
      setIsSaving(false)
    }
  }

  // ── Idle / loading state ───────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-brand-navy-100 flex items-center justify-center mx-auto mb-3">
            {error ? (
              <span className="text-2xl">⚠️</span>
            ) : (
              <span className="text-2xl">🎙️</span>
            )}
          </div>
          {error ? (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 max-w-xs mx-auto">
              <p className="font-semibold mb-1">Error al iniciar la entrevista</p>
              <p className="text-xs mb-3">{error}</p>
              <button
                onClick={() => {
                  if (initialSessionId) void startInterview(initialSessionId)
                }}
                className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Intentar de nuevo
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Iniciando entrevista...</p>
          )}
        </div>
      </div>
    )
  }

  // ── Summary review state ───────────────────────────────────────────────────
  if (phase === 'reviewing_summary' || phase === 'saving') {
    return summary ? (
      <SummaryReview
        summary={summary}
        onEdit={setSummaryEdited}
        onApprove={() => void handleApprove()}
        onRegenerate={() => void generateSummary()}
        isLoading={isSaving || phase === 'saving'}
      />
    ) : null
  }

  // ── Generating summary state ───────────────────────────────────────────────
  if (phase === 'generating_summary') {
    return (
      <div className="flex flex-col items-center justify-center p-10 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-brand-navy-50 flex items-center justify-center">
          <svg className="h-7 w-7 text-brand-navy-500 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-800">Generando tu Perfil IA</p>
          <p className="text-sm text-gray-500 mt-1">Marco está analizando toda la entrevista...</p>
        </div>
        {currentStreamText && (
          <p className="text-xs text-gray-400 italic max-w-xs text-center line-clamp-3">
            {currentStreamText}
          </p>
        )}
      </div>
    )
  }

  // ── Conversation state ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <TopicBar covered={metadata.temas_cubiertos} />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            isStreaming={i === messages.length - 1 && isWaiting}
          />
        ))}

        {isWaiting && currentStreamText && (
          <MessageBubble
            message={{ role: 'assistant', displayContent: currentStreamText }}
            isStreaming
          />
        )}

        {isWaiting && !currentStreamText && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-navy-500 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="danger">
            <p className="text-sm">{error}</p>
          </Alert>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-100">
        {metadata.listo_para_resumir ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-center text-brand-navy-600 font-medium">
              ✓ Entrevista completa — listo para generar tu Perfil IA
            </p>
            <Button onClick={() => void generateSummary()} disabled={isWaiting} className="w-full">
              Generar mi Perfil IA
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <textarea
              value={inputText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu respuesta..."
              rows={2}
              disabled={isWaiting}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy-300 disabled:opacity-50"
            />
            <button
              onClick={() => void handleSend()}
              disabled={isWaiting || !inputText.trim()}
              className="px-4 py-2 rounded-xl bg-brand-navy-500 text-white text-sm font-medium hover:bg-brand-navy-600 disabled:opacity-50 transition-colors self-end"
            >
              Enviar
            </button>
          </div>
        )}
        <div className="flex justify-center mt-2">
          <button
            onClick={onSkip}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Completar después
          </button>
        </div>
      </div>
    </div>
  )
}
