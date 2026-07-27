'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InterviewMessage {
  role: 'user' | 'assistant'
  content: string
  displayContent: string
  timestamp: string
  isStreaming?: boolean
}

export interface InterviewMetadata {
  temas_cubiertos: string[]
  listo_para_resumir: boolean
  extractos: Record<string, string>
}

export type InterviewPhase =
  | 'idle'
  | 'conversation'
  | 'generating_summary'
  | 'reviewing_summary'
  | 'saving'
  | 'done'

export interface SummaryData {
  resumen_visible: string
  datos_estructurados: Record<string, unknown>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseInterviewReturn {
  phase: InterviewPhase
  messages: InterviewMessage[]
  currentStreamText: string
  isWaiting: boolean
  metadata: InterviewMetadata
  summary: SummaryData | null
  sessionId: string | null
  error: string | null
  startInterview: (sessionId: string) => Promise<void>
  restoreInterview: (
    sid: string,
    msgs: InterviewMessage[],
    temas: string[],
    existingSummary?: SummaryData | null
  ) => void
  sendMessage: (text: string) => Promise<void>
  generateSummary: () => Promise<void>
  setSummaryEdited: (text: string) => void
  approveSummary: () => void
}

export function useInterview(): UseInterviewReturn {
  const [phase, setPhase] = useState<InterviewPhase>('idle')
  const [messages, setMessages] = useState<InterviewMessage[]>([])
  const [currentStreamText, setCurrentStreamText] = useState('')
  const [isWaiting, setIsWaiting] = useState(false)
  const [metadata, setMetadata] = useState<InterviewMetadata>({
    temas_cubiertos: [],
    listo_para_resumir: false,
    extractos: {},
  })
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Stable refs — values readable inside callbacks without stale closures ──
  // These refs always point to the latest value without recreating callbacks.
  const metadataRef = useRef(metadata)
  const messagesRef = useRef(messages)
  const sessionIdRef = useRef(sessionId)
  const isWaitingRef = useRef(isWaiting)
  const abortRef = useRef<AbortController | null>(null)

  // Keep refs in sync with state
  useEffect(() => { metadataRef.current = metadata }, [metadata])
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])
  useEffect(() => { isWaitingRef.current = isWaiting }, [isWaiting])

  // ─── Stream helper — stable, no deps, reads via refs ─────────────────────
  // useCallback with [] deps = created once, never recreated.
  // Reads current values through refs instead of closure-captured state.

  const streamRequest = useCallback(
    async (
      conversacion: Array<{ role: string; content: string }>,
      action: 'message' | 'summary',
      sid: string | null
    ): Promise<{ fullText: string; metadata: InterviewMetadata; summary: SummaryData | null }> => {
      // Abort any in-flight request before starting a new one.
      // Save old controller, create new one, assign to ref, THEN abort old one.
      // This order guarantees the new controller is in the ref before abort fires,
      // so no other caller can read a stale ref and abort the new request.
      const previousController = abortRef.current
      const controller = new AbortController()
      abortRef.current = controller
      previousController?.abort()

      console.log('[useInterview] fetch starting → POST /api/ai/interview, sid=', sid)
      const response = await fetch('/api/ai/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, conversacion, session_id: sid }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      // Read current metadata from ref — no stale closure
      let finalMetadata: InterviewMetadata = metadataRef.current
      let finalSummary: SummaryData | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break

          try {
            const parsed = JSON.parse(data) as {
              text?: string
              done?: boolean
              metadata?: InterviewMetadata
              resumen_visible?: string
              datos_estructurados?: Record<string, unknown>
              error?: string
            }

            if (parsed.error) throw new Error(parsed.error)

            if (parsed.text) {
              accumulated += parsed.text
              setCurrentStreamText(accumulated)
            }

            if (parsed.metadata) {
              finalMetadata = parsed.metadata
            }

            if (parsed.done && action === 'summary') {
              finalSummary = {
                resumen_visible: parsed.resumen_visible ?? '',
                datos_estructurados: parsed.datos_estructurados ?? {},
              }
            }
          } catch (e) {
            if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
              throw e
            }
          }
        }
      }

      return { fullText: accumulated, metadata: finalMetadata, summary: finalSummary }
    },
    [] // Stable — reads metadata via metadataRef, not closure
  )

  // ─── Start interview — stable ──────────────────────────────────────────────
  // useCallback with [streamRequest] — streamRequest never changes ([] deps above),
  // so startInterview is also created once and never recreated.

  const startInterview = useCallback(async (sid: string) => {
    console.log('[useInterview] startInterview called, sid=', JSON.stringify(sid))
    setSessionId(sid)
    sessionIdRef.current = sid
    setPhase('conversation')
    setIsWaiting(true)
    isWaitingRef.current = true
    setCurrentStreamText('')
    setError(null)

    try {
      console.log('[useInterview] calling streamRequest...')
      const { fullText, metadata: newMeta } = await streamRequest([], 'message', sid)
      console.log('[useInterview] streamRequest resolved, fullText length=', fullText?.length)

      const assistantMsg: InterviewMessage = {
        role: 'assistant',
        content: fullText,
        displayContent: fullText.replace(/<!--METADATA:.*?-->/s, '').trim(),
        timestamp: new Date().toISOString(),
      }

      setMessages([assistantMsg])
      // Ensure metadata has latest temas_cubiertos
      metadataRef.current = newMeta
      setMetadata(newMeta)
      metadataRef.current = newMeta
      setCurrentStreamText('')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[useInterview] AbortError — request was superseded')
        return
      }
      const msg = err instanceof Error ? err.message : 'Error al iniciar la entrevista'
      console.error('[useInterview] startInterview FAILED:', msg, err)
      setError(msg)
      setPhase('idle')
    } finally {
      console.log('[useInterview] startInterview finally block')
      setIsWaiting(false)
      isWaitingRef.current = false
    }
  }, [streamRequest]) // streamRequest is stable, so startInterview is stable

  // ─── Send message — stable ─────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isWaitingRef.current) return

    const userMsg: InterviewMessage = {
      role: 'user',
      content: text,
      displayContent: text,
      timestamp: new Date().toISOString(),
    }

    // Read current messages from ref — no stale closure
    const updatedMessages = [...messagesRef.current, userMsg]
    setMessages(updatedMessages)
    messagesRef.current = updatedMessages
    setIsWaiting(true)
    isWaitingRef.current = true
    setCurrentStreamText('')
    setError(null)

    try {
      const conversacion = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const { fullText, metadata: newMeta } = await streamRequest(
        conversacion,
        'message',
        sessionIdRef.current
      )

      const assistantMsg: InterviewMessage = {
        role: 'assistant',
        content: fullText,
        displayContent: fullText.replace(/<!--METADATA:.*?-->/s, '').trim(),
        timestamp: new Date().toISOString(),
      }

      const finalMessages = [...updatedMessages, assistantMsg]
      setMessages(finalMessages)
      messagesRef.current = finalMessages
      setMetadata(newMeta)
      metadataRef.current = newMeta
      setCurrentStreamText('')

      if (newMeta.listo_para_resumir) {
        setTimeout(() => void generateSummaryInternal(finalMessages), 1000)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Error al enviar el mensaje')
    } finally {
      setIsWaiting(false)
      isWaitingRef.current = false
    }
  }, [streamRequest]) // stable

  // ─── Restore existing interview — no API call ────────────────────────────────
  // Called when the client finds an existing session in DB.
  // Loads messages and metadata into state without hitting the AI.
  // If existingSummary is provided, goes directly to reviewing_summary phase.

  const restoreInterview = useCallback((
    sid: string,
    msgs: InterviewMessage[],
    temas: string[],
    existingSummary?: SummaryData | null,
  ) => {
    console.log('[useInterview] restoreInterview sid=', sid, 'msgs=', msgs.length, 'temas=', temas.length)
    setSessionId(sid)
    sessionIdRef.current = sid
    setMessages(msgs)
    messagesRef.current = msgs
    setMetadata({
      temas_cubiertos: temas,
      listo_para_resumir: temas.length >= 8,
      extractos: {},
    })

    if (existingSummary) {
      setSummary(existingSummary)
      setPhase('reviewing_summary')
    } else if (msgs.length > 0) {
      setPhase('conversation')
    }
    // If msgs.length === 0: stay idle — will call startInterview normally
  }, []) // Stable — only sets state, no closures needed

  // ─── Generate summary — stable ─────────────────────────────────────────────

  const generateSummaryInternal = useCallback(async (msgs: InterviewMessage[]) => {
    setPhase('generating_summary')
    setCurrentStreamText('')
    setError(null)

    try {
      const conversacion = msgs.map((m) => ({ role: m.role, content: m.content }))
      const { summary: newSummary } = await streamRequest(
        conversacion,
        'summary',
        sessionIdRef.current
      )

      if (!newSummary) {
        throw new Error('No se recibió el resumen de la IA. Intenta de nuevo.')
      }

      // Mark all topics as covered when summary is generated
      setMetadata(prev => ({
        ...prev,
        listo_para_resumir: true,
        temas_cubiertos: Object.keys({
          historia_personal: 1, motivacion_profunda: 1, mercado_objetivo: 1,
          productos_principales: 1, diferenciadores: 1, estilo_comunicacion: 1,
          valores: 1, cliente_ideal: 1, objeciones_frecuentes: 1,
          frases_propias: 1, ctas_efectivos: 1, mision_profesional: 1, vision_negocio: 1,
        }),
      }))

      setSummary(newSummary)
      setPhase('reviewing_summary')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Error al generar el resumen'
      console.error('[useInterview] generateSummaryInternal failed:', msg)
      setError(msg)
      setPhase('conversation')
    } finally {
      setCurrentStreamText('')
    }
  }, [streamRequest]) // stable

  const generateSummary = useCallback(
    () => generateSummaryInternal(messagesRef.current),
    [generateSummaryInternal]
  ) // stable

  // ─── Edit / approve summary ────────────────────────────────────────────────

  const setSummaryEdited = useCallback((text: string) => {
    setSummary((prev) => prev ? { ...prev, resumen_visible: text } : prev)
  }, [])

  const approveSummary = useCallback(() => {
    setPhase('saving')
  }, [])

  return {
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
  }
}
