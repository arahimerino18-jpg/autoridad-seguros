'use client'
import { parseStream, type SSEEvent } from '@/lib/sse/parse-stream'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button, Spinner, Alert } from '@/components/ui'
import { markRecommendationSeenAction } from '@/lib/growth-engine/goals-actions'
import type { CopilotMode, CalendarEvent, AgentGoals } from '@/types/growth-engine'

// ─── Mode config ──────────────────────────────────────────────────────────────

const MODES: Array<{
  id: CopilotMode
  icon: string
  label: string
  desc: string
  recommended?: boolean
}> = [
  { id: 'estratega', icon: '🎯', label: 'Estratega Diario', desc: '¿Qué hago hoy?', recommended: true },
  { id: 'analista', icon: '📊', label: 'Análisis', desc: '¿Qué está funcionando?' },
  { id: 'campana', icon: '📅', label: 'Campaña', desc: 'Diseña una campaña' },
  { id: 'posicionamiento', icon: '🏆', label: 'Posicionamiento', desc: 'Conviértete en el experto' },
  { id: 'chat', icon: '💬', label: 'Consultor Libre', desc: 'Pregunta lo que quieras' },
]

// ─── Evidence badge ───────────────────────────────────────────────────────────


// ─── Calendar event pill ──────────────────────────────────────────────────────

function CalendarPill({ event }: { event: CalendarEvent }) {
  const urgencia = event.esta_activo ? '🔴' : (event.dias_hasta_inicio ?? 99) <= 14 ? '⚠️' : '📅'
  const dias = event.esta_activo
    ? `Activo — ${event.dias_restantes}d restantes`
    : `En ${event.dias_hasta_inicio}d`

  return (
    <div className="flex items-center gap-2 text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
      <span>{urgencia}</span>
      <span className="font-medium text-gray-700 truncate max-w-[120px]">{event.nombre}</span>
      <span className="text-gray-400 shrink-0">{dias}</span>
    </div>
  )
}

// ─── Campana params form ──────────────────────────────────────────────────────

function CampanaForm({
  onSubmit,
}: {
  onSubmit: (params: Record<string, unknown>) => void
}) {
  const [params, setParams] = useState({
    producto: 'medicare',
    duracion: '2_semanas',
    objetivo: 'leads',
    tiempo_diario_min: 30,
  })

  return (
    <div className="p-5 space-y-4 animate-fade-in">
      <h3 className="text-base font-semibold text-gray-900">Diseña tu campaña</h3>
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            key: 'producto',
            label: 'Producto',
            options: [
              ['medicare', 'Medicare'],
              ['aca', 'ACA / Salud'],
              ['iul', 'IUL / Vida'],
              ['final_expense', 'Gastos Finales'],
              ['life', 'Seguro de Vida'],
            ],
          },
          {
            key: 'duracion',
            label: 'Duración',
            options: [
              ['1_semana', '1 semana'],
              ['2_semanas', '2 semanas'],
              ['1_mes', '1 mes'],
            ],
          },
          {
            key: 'objetivo',
            label: 'Objetivo',
            options: [
              ['leads', 'Conseguir leads'],
              ['educacion', 'Educar audiencia'],
              ['reconocimiento', 'Dar a conocer'],
            ],
          },
          {
            key: 'tiempo_diario_min',
            label: 'Tiempo por día',
            options: [
              [15, '15 minutos'],
              [30, '30 minutos'],
              [60, '1 hora'],
            ],
          },
        ].map(({ key, label, options }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <select
              value={params[key as keyof typeof params]}
              onChange={(e) => setParams((p) => ({ ...p, [key]: e.target.value }))}
              className="w-full h-9 px-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-navy-500"
            >
              {options.map(([value, label]) => (
                <option key={String(value)} value={String(value)}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <Button onClick={() => onSubmit(params)} className="w-full">
        Diseñar mi campaña →
      </Button>
    </div>
  )
}

// ─── Main Copilot component ───────────────────────────────────────────────────

interface MarketingCopilotProps {
  userId: string
  agentName: string
  goals: AgentGoals | null
  upcomingEvents: CalendarEvent[]
  contextLayers: string[]
  pendingRecommendations: Array<{
    id: string
    titulo: string
    tipo: string
  }>
}

export function MarketingCopilot({
  userId: _userId,
  agentName: _agentName,
  goals,
  upcomingEvents,
  contextLayers,
  pendingRecommendations,
}: MarketingCopilotProps) {
  const [activeMode, setActiveMode] = useState<CopilotMode>('estratega')
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [fullContent, setFullContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showCampanaForm, setShowCampanaForm] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string; timestamp: string }>>([])
  const [chatInput, setChatInput] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom of content as it streams
  useEffect(() => {
    contentRef.current?.scrollTo({ top: contentRef.current.scrollHeight, behavior: 'smooth' })
  }, [streamContent])

  const generate = useCallback(async (modo: CopilotMode, params: Record<string, unknown> = {}) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsGenerating(true)
    setStreamContent('')
    setFullContent('')
    setError(null)

    try {
      let accumulated = ''
      await parseStream(
        '/api/ai/copilot',
        { modo, params },
        {
          signal: controller.signal,
          onChunk: (chunk: string) => {
            accumulated += chunk
            setStreamContent(accumulated)
          },
          onDone: (_evt: SSEEvent) => { setFullContent(accumulated) },
          onError: (msg: string) => { throw new Error(msg) },
        }
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Error al generar el análisis')
    } finally {
      setIsGenerating(false)
    }
  }, [])

  const handleModeSelect = useCallback((mode: CopilotMode) => {
    setActiveMode(mode)
    setStreamContent('')
    setFullContent('')
    setError(null)
    setShowCampanaForm(false)
    setChatMessages([])

    if (mode === 'campana') {
      setShowCampanaForm(true)
    } else if (mode !== 'chat') {
      void generate(mode)
    }
  }, [generate])

  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || isGenerating) return
    const msg = chatInput.trim()
    setChatInput('')

    const newUserMsg = { role: 'user', content: msg, timestamp: new Date().toISOString() }
    const updatedMessages = [...chatMessages, newUserMsg]
    setChatMessages(updatedMessages)

    setIsGenerating(true)
    setStreamContent('')
    setError(null)

    try {
      let accumulated = ''
      await parseStream(
        '/api/ai/copilot',
        { modo: 'chat', params: { pregunta: msg }, conversacion: updatedMessages },
        {
          onChunk: (chunk: string) => {
            accumulated += chunk
            setStreamContent(accumulated)
          },
          onDone: (_evt: SSEEvent) => {
            setChatMessages([
              ...updatedMessages,
              { role: 'assistant', content: accumulated, timestamp: new Date().toISOString() },
            ])
            setStreamContent('')
          },
          onError: (errMsg: string) => { throw new Error(errMsg) },
        }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setIsGenerating(false)
    }
  }, [chatInput, chatMessages, isGenerating])

  const displayContent = streamContent || fullContent

  return (
    <div className="flex h-full gap-0 animate-fade-in">
      {/* Left sidebar: mode selector */}
      <div className="w-56 shrink-0 border-r border-gray-100 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Modos</p>
        </div>

        <div className="flex-1 p-2 space-y-1">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleModeSelect(mode.id)}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-xl transition-all group',
                activeMode === mode.id
                  ? 'bg-brand-navy-500 text-white'
                  : 'hover:bg-gray-50 text-gray-700'
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">{mode.icon}</span>
                <div className="min-w-0">
                  <p className={cn('text-xs font-semibold truncate', activeMode === mode.id ? 'text-white' : 'text-gray-800')}>
                    {mode.label}
                  </p>
                  <p className={cn('text-2xs truncate', activeMode === mode.id ? 'text-white/70' : 'text-gray-400')}>
                    {mode.desc}
                  </p>
                </div>
                {mode.recommended && (
                  <span className={cn('ml-auto text-2xs font-medium shrink-0', activeMode === mode.id ? 'text-white/70' : 'text-brand-gold-500')}>
                    Hoy
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Context quality indicator */}
        <div className="p-3 border-t border-gray-100">
          <p className="text-2xs font-medium text-gray-400 mb-1.5">Contexto disponible</p>
          <div className="space-y-1">
            {[
              { key: 'AGENT_DATA', label: 'Perfil del agente', available: contextLayers.includes('AGENT_DATA') },
              { key: 'SEASONALITY', label: 'Calendario seguros', available: contextLayers.includes('SEASONALITY') },
              { key: 'GOALS', label: 'Objetivos del mes', available: !!goals },
            ].map(({ label, available }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={cn('w-1.5 h-1.5 rounded-full', available ? 'bg-emerald-500' : 'bg-gray-300')} />
                <span className={cn('text-2xs', available ? 'text-gray-600' : 'text-gray-300')}>{label}</span>
              </div>
            ))}
          </div>
          {!goals && (
            <Link href="?setup=goals" className="block mt-2 text-2xs text-brand-sky-500 hover:underline">
              + Configurar objetivos
            </Link>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface-subtle">
        {/* Top bar: upcoming events */}
        {upcomingEvents.length > 0 && (
          <div className="px-5 py-2.5 bg-white border-b border-gray-100 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-gray-400 shrink-0">Próximos eventos:</span>
            {upcomingEvents.slice(0, 4).map((evt) => (
              <CalendarPill key={evt.nombre} event={evt} />
            ))}
          </div>
        )}

        {/* Pending recommendations banner */}
        {pendingRecommendations.length > 0 && (
          <div className="mx-5 mt-4 bg-brand-gold-50 border border-brand-gold-200 rounded-xl p-3 flex items-center gap-3">
            <span className="text-base shrink-0">💡</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-brand-gold-700">
                {pendingRecommendations.length} recomendación{pendingRecommendations.length > 1 ? 'es' : ''} pendiente{pendingRecommendations.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-brand-gold-600 truncate">{pendingRecommendations[0]?.titulo}</p>
            </div>
            <button
              onClick={() => {
                if (pendingRecommendations[0]?.id) {
                  void markRecommendationSeenAction(pendingRecommendations[0].id)
                }
              }}
              className="text-2xs text-brand-gold-500 hover:text-brand-gold-700 shrink-0"
            >
              Ver →
            </button>
          </div>
        )}

        {/* Content area */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto p-5"
        >
          {/* Campana form */}
          {showCampanaForm && activeMode === 'campana' && !isGenerating && !displayContent && (
            <div className="max-w-lg mx-auto">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-card">
                <CampanaForm onSubmit={(params) => {
                  setShowCampanaForm(false)
                  void generate('campana', params)
                }} />
              </div>
            </div>
          )}

          {/* Chat mode */}
          {activeMode === 'chat' && (
            <div className="max-w-2xl mx-auto space-y-4">
              {chatMessages.length === 0 && !isGenerating && (
                <div className="text-center py-8">
                  <p className="text-2xl mb-3">💬</p>
                  <p className="text-sm font-medium text-gray-700 mb-1">Consultor de Marketing Libre</p>
                  <p className="text-xs text-gray-400">Pregúntame cualquier cosa sobre tu estrategia de marketing</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {[
                      '¿Qué debo publicar hoy?',
                      '¿Cómo genero más leads con Medicare?',
                      '¿Qué errores estoy cometiendo?',
                    ].map((q) => (
                      <button key={q} onClick={() => setChatInput(q)}
                        className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-brand-navy-300 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-brand-navy-500 text-white rounded-tr-none'
                      : 'bg-white border border-gray-100 shadow-card text-gray-800 rounded-tl-none'
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {isGenerating && streamContent && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] bg-white border border-gray-100 shadow-card rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {streamContent}
                    <span className="inline-block w-1 h-4 bg-current ml-0.5 animate-blink align-middle" />
                  </div>
                </div>
              )}

              {isGenerating && !streamContent && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 shadow-card rounded-2xl rounded-tl-none px-4 py-3 flex gap-1.5 items-center">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Structured mode output */}
          {activeMode !== 'chat' && (
            <div className="max-w-2xl mx-auto">
              {isGenerating && !displayContent && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Spinner size="lg" />
                  <p className="text-sm text-gray-500">Analizando tu situación...</p>
                  <p className="text-xs text-gray-400">Procesando {contextLayers.join(', ')}</p>
                </div>
              )}

              {error && (
                <Alert variant="danger" className="mb-4">{error}</Alert>
              )}

              {displayContent && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
                  <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {displayContent
                      .replace(/---JSON_CAMPANA---[\s\S]*?---FIN_JSON---/g, '')
                      .trim()}
                  </div>
                  {isGenerating && (
                    <span className="inline-block w-1 h-4 bg-brand-navy-500 ml-0.5 animate-blink align-middle" />
                  )}
                  {!isGenerating && (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <p className="text-xs text-gray-400">¿Quieres crear contenido basado en este análisis?</p>
                      <Link
                        href="/content-studio"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B2E6B] text-white text-xs font-semibold hover:bg-[#16255a] transition-colors"
                      >
                        ✍️ Crear en Content Studio →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {!isGenerating && !displayContent && !error && !showCampanaForm && (
                <div className="text-center py-16">
                  <p className="text-3xl mb-3">
                    {MODES.find(m => m.id === activeMode)?.icon ?? '🎯'}
                  </p>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    {MODES.find(m => m.id === activeMode)?.label}
                  </p>
                  <p className="text-xs text-gray-400 mb-4">
                    {MODES.find(m => m.id === activeMode)?.desc}
                  </p>
                  <Button onClick={() => void generate(activeMode)}>
                    Generar análisis →
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat input (only for chat mode) */}
        {activeMode === 'chat' && (
          <div className="border-t border-gray-100 bg-white p-3 flex gap-2">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleChatSend() } }}
              placeholder="Escribe tu pregunta estratégica..."
              rows={2}
              disabled={isGenerating}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy-500 disabled:bg-gray-50"
            />
            <Button
              size="icon"
              onClick={handleChatSend}
              disabled={!chatInput.trim() || isGenerating}
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}


