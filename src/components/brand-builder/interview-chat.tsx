'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useInterview } from '@/hooks/use-interview'
import { saveInterviewResultAction } from '@/lib/brand-builder/actions'
import { Button, Alert } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

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
        {message.displayContent}
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
  onComplete: () => void
  onSkip: () => void
}

export function InterviewChat({ initialSessionId, onComplete, onSkip }: InterviewChatProps) {
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
    sendMessage,
    generateSummary,
    setSummaryEdited,
    approveSummary,
  } = useInterview()

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentStreamText])

  // Start interview when component mounts with a valid session ID.
  //
  // Why [initialSessionId] only — no stale closure risk:
  //   startInterview is stable (defined with useCallback([streamRequest]),
  //   and streamRequest is stable (useCallback([])). Neither is ever recreated.
  //   So the function reference captured here is always the correct, current one.
  //   There is no need to list startInterview as a dep because it never changes.
  //   Listing initialSessionId ensures the effect re-runs if a new session is
  //   provided (e.g., session creation retried from outside), but not on every render.
  //
  // Timeout: cleared in success (via finally in startInterview), in error (same),
  //   and on component unmount (cleanup return).
  useEffect(() => {
    console.log('[InterviewChat] useEffect fired, initialSessionId=', JSON.stringify(initialSessionId), 'truthy=', !!initialSessionId)
    if (!initialSessionId) {
      console.error('[InterviewChat] BLOCKED: initialSessionId is empty/null — fetch will NOT run')
      return
    }

    console.log('[InterviewChat] calling startInterview with:', initialSessionId)
    let cancelled = false
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        console.error('[InterviewChat] startInterview exceeded 15s — no response from /api/ai/interview')
      }
    }, 15_000)

    void startInterview(initialSessionId).finally(() => {
      console.log('[InterviewChat] startInterview settled')
      if (!cancelled) clearTimeout(timeoutId)
    })

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [initialSessionId, startInterview]) // startInterview is stable — this is safe

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
