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
          'max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isAssistant
            ? 'bg-white border border-gray-100 shadow-card text-gray-800 rounded-tl-none'
            : 'bg-brand-navy-500 text-white rounded-tr-none'
        )}
      >
        {message.displayContent}
        {isStreaming && (
          <span className="inline-block w-1 h-4 bg-current ml-0.5 animate-blink align-middle" />
        )}
      </div>
    </div>
  )
}

// ─── Summary review panel ─────────────────────────────────────────────────────

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
  const fieldCount = Object.keys(summary.datos_estructurados).length

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Tu perfil profesional
        </h3>
        <p className="text-xs text-gray-500">
          La IA extrajo {fieldCount} datos de tu entrevista. Revisa, edita si quieres, y aprueba.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Resumen visible (editable)
        </label>
        <textarea
          value={summary.resumen_visible}
          onChange={(e) => onEdit(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-navy-500 resize-none leading-relaxed"
        />
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Datos extraídos para la IA</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(summary.datos_estructurados)
            .filter(([, v]) => v && String(v).length > 0)
            .slice(0, 10)
            .map(([key, value]) => (
              <div key={key} className="bg-brand-navy-50 rounded-lg px-3 py-2">
                <p className="text-2xs text-brand-navy-400 font-medium uppercase tracking-wide">
                  {key.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-brand-navy-700 mt-0.5 line-clamp-2">
                  {Array.isArray(value) ? (value as string[]).join(', ') : String(value)}
                </p>
              </div>
            ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          onClick={onRegenerate}
          disabled={isLoading}
          className="flex-1"
          size="sm"
        >
          Regenerar
        </Button>
        <Button
          onClick={onApprove}
          isLoading={isLoading}
          loadingText="Guardando..."
          className="flex-1"
        >
          Aprobar y guardar →
        </Button>
      </div>
    </div>
  )
}

// ─── Main interview component ─────────────────────────────────────────────────

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

  // Start interview when component mounts
  useEffect(() => {
    if (initialSessionId && phase === 'idle') {
      startInterview(initialSessionId)
    }
  }, [initialSessionId, phase, startInterview])

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isWaiting) return
    const text = inputText
    setInputText('')
    await sendMessage(text)
  }, [inputText, isWaiting, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [handleSend]
  )

  const handleApprove = async () => {
    if (!summary || !sessionId) return
    approveSummary()
    setIsSaving(true)

    const result = await saveInterviewResultAction({
      datos_estructurados: summary.datos_estructurados,
      resumen_visible: summary.resumen_visible,
      session_id: sessionId,
    })

    if (result.success) {
      toast.success('¡Perfil guardado!', 'Tu Perfil de IA está listo.')
      onComplete()
    } else {
      toast.error('Error al guardar', result.error)
      setIsSaving(false)
    }
  }

  // ── Idle state ──────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-brand-navy-100 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🎙️</span>
          </div>
          <p className="text-sm text-gray-500">Iniciando entrevista...</p>
        </div>
      </div>
    )
  }

  // ── Summary review state ────────────────────────────────────────────────────
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

  // ── Generating summary state ────────────────────────────────────────────────
  if (phase === 'generating_summary') {
    return (
      <div className="flex flex-col items-center justify-center p-10 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-brand-navy-50 flex items-center justify-center">
          <svg className="h-7 w-7 text-brand-navy-500 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-800">Analizando tu entrevista...</p>
          <p className="text-xs text-gray-400 mt-1">La IA está construyendo tu perfil profesional</p>
        </div>
        {currentStreamText && (
          <div className="w-full max-w-sm bg-gray-50 rounded-xl p-4 text-xs text-gray-600 font-mono line-clamp-4">
            {currentStreamText}
          </div>
        )}
      </div>
    )
  }

  // ── Conversation state ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Topic coverage */}
      <TopicBar covered={metadata.temas_cubiertos} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {/* Streaming message */}
        {isWaiting && currentStreamText && (
          <MessageBubble
            message={{ role: 'assistant', displayContent: currentStreamText }}
            isStreaming
          />
        )}

        {/* Typing indicator */}
        {isWaiting && !currentStreamText && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-navy-500 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <div className="bg-white border border-gray-100 shadow-card rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 pb-2">
          <Alert variant="danger" onDismiss={() => {}}>
            {error}
          </Alert>
        </div>
      )}

      {/* Generate summary CTA when ready */}
      {metadata.listo_para_resumir && !isWaiting && (
        <div className="px-4 pb-2 animate-fade-in">
          <button
            onClick={() => void generateSummary()}
            className="w-full py-2.5 text-sm font-medium bg-brand-gold-50 text-brand-gold-600 hover:bg-brand-gold-100 rounded-xl border border-brand-gold-200 transition-colors"
          >
            ✨ Tengo suficiente información — Generar mi perfil
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-100 p-3 flex gap-2">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu respuesta..."
          rows={2}
          disabled={isWaiting}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <div className="flex flex-col gap-2">
          <Button
            size="icon"
            onClick={() => void handleSend()}
            disabled={!inputText.trim() || isWaiting}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </Button>
          <button
            onClick={onSkip}
            className="text-2xs text-gray-300 hover:text-gray-500 transition-colors text-center px-1"
            title="Saltar entrevista"
          >
            saltar
          </button>
        </div>
      </div>
    </div>
  )
}
