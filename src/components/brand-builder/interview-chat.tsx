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
function tryExtractFinalJson(content: string): RecoveredSummary | null {
  // Strip markdown code fences and leading/trailing text
  const cleaned = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // Heuristic: must contain at least 3 of the expected profile keys
  const expectedKeys = [
    'historia_personal','motivacion_profunda','mercado_objetivo',
    'productos_principales','estilo_comunicacion','diferenciadores',
    'valores','objeciones_frecuentes','frases_propias','ctas_efectivos',
  ]

  const keyMatches = expectedKeys.filter(k => cleaned.includes(`"${k}"`))
  if (keyMatches.length < 3) return null

  // Try to find and parse the JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]+\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const resumenParts: string[] = []
    if (typeof parsed.propuesta_de_valor === 'string') resumenParts.push(parsed.propuesta_de_valor)
    if (typeof parsed.historia_personal === 'string') resumenParts.push(parsed.historia_personal)
    const resumenVisible = resumenParts.join(' ') || 'Perfil recuperado automáticamente.'

    console.log('[tryExtractFinalJson] JSON válido detectado, keys=', Object.keys(parsed).length)
    return { resumen_visible: resumenVisible, datos_estructurados: parsed }
  } catch {
    return null
  }
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
  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex-1 overflow-y-auto">
        <h3 className="font-semibold text-gray-800 mb-3">Resumen de tu perfil IA</h3>
        <textarea
          value={summary.resumen_visible}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onEdit(e.target.value)}
          className="w-full h-48 p-3 border border-gray-200 rounded-xl text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-brand-navy-300"
          placeholder="Resumen generado..."
        />
        <p className="text-xs text-gray-400 mt-1">
          Puedes editar el resumen antes de guardar. Este texto se usará para personalizar todo el contenido de la plataforma.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={onRegenerate}
          disabled={isLoading}
          className="flex-1"
        >
          Regenerar
        </Button>
        <Button
          size="sm"
          onClick={onApprove}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? 'Guardando...' : 'Guardar perfil IA'}
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
      // Check if last assistant message has raw JSON (retroactive recovery)
      const lastAssistant = [...existingMsgs].reverse().find(m => m.role === 'assistant')
      const recovered = lastAssistant ? tryExtractFinalJson(lastAssistant.content) : null

      if (recovered) {
        console.log('[InterviewChat] JSON final detectado — recuperación retroactiva')
        const msgs = existingMsgs.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          displayContent: m.role === 'assistant' ? stripFinalJson(m.content) : m.content,
          timestamp: m.timestamp ?? new Date().toISOString(),
        }))
        void markSessionCompleteAction(sid, recovered.datos_estructurados, recovered.resumen_visible)
          .then(r => { if (!r.success) console.error('[InterviewChat] markSessionComplete failed:', r.error) })
        restoreInterview(sid, msgs, ALL_TOPICS, recovered)
        return
      }

      // Normal restoration — conversation in progress
      console.log('[InterviewChat] restaurando conversación en progreso')
      const msgs = existingMsgs.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        displayContent: m.role === 'assistant'
          ? m.content.replace(/<!--METADATA:.*?-->/s, '').trim()
          : m.content,
        timestamp: m.timestamp ?? new Date().toISOString(),
      }))
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
    approveSummary()
    setIsSaving(true)

    const result = await saveInterviewResultAction({
      datos_estructurados: summary!.datos_estructurados,
      resumen_visible: summary!.resumen_visible,
      session_id: sessionId ?? initialSessionId ?? '',
    })

    if (result.success) {
      toast.success('¡Perfil guardado!', 'Tu Perfil de IA está listo.')
      onComplete()
    } else {
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
