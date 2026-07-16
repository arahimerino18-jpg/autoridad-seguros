'use client'

import { useState, useCallback, useRef } from 'react'

type StreamingStatus = 'idle' | 'streaming' | 'complete' | 'error'

interface UseAIStreamOptions {
  onComplete?: (content: string) => void
  onError?: (error: string) => void
  onChunk?: (chunk: string) => void
}

interface UseAIStreamReturn {
  content: string
  status: StreamingStatus
  error: string | null
  isStreaming: boolean
  stream: (endpoint: string, body: Record<string, unknown>) => Promise<void>
  reset: () => void
  abort: () => void
}

/**
 * Hook for consuming Server-Sent Events (SSE) streams from the AI API routes.
 * Handles streaming text content token by token.
 */
export function useAIStream(options: UseAIStreamOptions = {}): UseAIStreamReturn {
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<StreamingStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    setContent('')
    setStatus('idle')
    setError(null)
  }, [])

  const abort = useCallback(() => {
    abortControllerRef.current?.abort()
    setStatus('idle')
  }, [])

  const stream = useCallback(
    async (endpoint: string, body: Record<string, unknown>) => {
      // Abort any in-flight request
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      setContent('')
      setError(null)
      setStatus('streaming')

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            errorData?.error?.message ?? `Error ${response.status}: ${response.statusText}`
          )
        }

        if (!response.body) {
          throw new Error('No response body received from the server.')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          const chunk = decoder.decode(value, { stream: true })

          // Parse SSE format: "data: <content>\n\n"
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)

              if (data === '[DONE]') {
                setStatus('complete')
                options.onComplete?.(accumulated)
                return
              }

              try {
                const parsed = JSON.parse(data) as { text?: string; delta?: string }
                const text = parsed.text ?? parsed.delta ?? ''
                if (text) {
                  accumulated += text
                  setContent(accumulated)
                  options.onChunk?.(text)
                }
              } catch {
                // Raw text chunk (not JSON)
                if (data) {
                  accumulated += data
                  setContent(accumulated)
                  options.onChunk?.(data)
                }
              }
            }
          }
        }

        setStatus('complete')
        options.onComplete?.(accumulated)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setStatus('idle')
          return
        }

        const message =
          err instanceof Error
            ? err.message
            : 'Error al generar el contenido. Por favor intenta de nuevo.'

        setError(message)
        setStatus('error')
        options.onError?.(message)
      }
    },
    [options]
  )

  return {
    content,
    status,
    error,
    isStreaming: status === 'streaming',
    stream,
    reset,
    abort,
  }
}
