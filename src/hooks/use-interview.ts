'use client'

import { useState, useCallback, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InterviewMessage {
  role: 'user' | 'assistant'
  content: string           // Full content including metadata (for API)
  displayContent: string    // Clean content for display (no metadata)
  timestamp: string
  isStreaming?: boolean
}

export interface InterviewMetadata {
  temas_cubiertos: string[]
  listo_para_resumir: boolean
  extractos: Record<string, string>
}

export type InterviewPhase =
  | 'idle'           // Not started
  | 'conversation'   // Active interview
  | 'generating_summary'  // Generating summary
  | 'reviewing_summary'   // Agent reviewing the summary
  | 'saving'         // Saving to DB
  | 'done'           // Saved successfully

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

  const abortRef = useRef<AbortController | null>(null)

  // ─── Stream helper ──────────────────────────────────────────────────────────

  const streamRequest = useCallback(
    async (
      conversacion: Array<{ role: string; content: string }>,
      action: 'message' | 'summary',
      sid: string | null
    ): Promise<{ fullText: string; metadata: InterviewMetadata; summary: SummaryData | null }> => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

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
      let finalMetadata: InterviewMetadata = metadata
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
    [metadata]
  )

  // ─── Start interview ────────────────────────────────────────────────────────

  const startInterview = useCallback(async (sid: string) => {
    setSessionId(sid)
    setPhase('conversation')
    setIsWaiting(true)
    setCurrentStreamText('')
    setError(null)

    try {
      const { fullText, metadata: newMeta } = await streamRequest([], 'message', sid)

      const assistantMsg: InterviewMessage = {
        role: 'assistant',
        content: fullText,
        displayContent: fullText.replace(/<!--METADATA:.*?-->/s, '').trim(),
        timestamp: new Date().toISOString(),
      }

      setMessages([assistantMsg])
      setMetadata(newMeta)
      setCurrentStreamText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar la entrevista')
      setPhase('idle')
    } finally {
      setIsWaiting(false)
    }
  }, [streamRequest])

  // ─── Send message ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isWaiting) return

    const userMsg: InterviewMessage = {
      role: 'user',
      content: text,
      displayContent: text,
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setIsWaiting(true)
    setCurrentStreamText('')
    setError(null)

    try {
      const conversacion = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const { fullText, metadata: newMeta } = await streamRequest(conversacion, 'message', sessionId)

      const assistantMsg: InterviewMessage = {
        role: 'assistant',
        content: fullText,
        displayContent: fullText.replace(/<!--METADATA:.*?-->/s, '').trim(),
        timestamp: new Date().toISOString(),
      }

      setMessages([...updatedMessages, assistantMsg])
      setMetadata(newMeta)
      setCurrentStreamText('')

      // Auto-trigger summary if ready
      if (newMeta.listo_para_resumir) {
        setTimeout(() => generateSummaryInternal([...updatedMessages, assistantMsg]), 1000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el mensaje')
    } finally {
      setIsWaiting(false)
    }
  }, [messages, isWaiting, sessionId, streamRequest])

  // ─── Generate summary ───────────────────────────────────────────────────────

  const generateSummaryInternal = useCallback(async (msgs: InterviewMessage[]) => {
    setPhase('generating_summary')
    setCurrentStreamText('')
    setError(null)

    try {
      const conversacion = msgs.map((m) => ({ role: m.role, content: m.content }))
      const { summary: newSummary } = await streamRequest(conversacion, 'summary', sessionId)

      if (newSummary) {
        setSummary(newSummary)
        setPhase('reviewing_summary')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el resumen')
      setPhase('conversation')
    } finally {
      setCurrentStreamText('')
    }
  }, [sessionId, streamRequest])

  const generateSummary = useCallback(() => generateSummaryInternal(messages), [messages, generateSummaryInternal])

  // ─── Edit summary ───────────────────────────────────────────────────────────

  const setSummaryEdited = useCallback((text: string) => {
    setSummary((prev) => prev ? { ...prev, resumen_visible: text } : prev)
  }, [])

  // ─── Approve summary ────────────────────────────────────────────────────────

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
    sendMessage,
    generateSummary,
    setSummaryEdited,
    approveSummary,
  }
}
