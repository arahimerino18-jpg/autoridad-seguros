/**
 * Autoridad Seguros AI™ — Shared SSE Stream Parser
 *
 * Single implementation used by Content Studio, Marketing Copilot,
 * Objection AI, and any future streaming endpoint.
 *
 * Guarantees:
 *  - Buffer persists across reader.read() — JSON split across TCP chunks is
 *    reassembled before parsing. No SyntaxError data loss.
 *  - UTF-8 aware with stream:true — accented chars and emojis never corrupted.
 *  - Handles both \n and \r\n line endings.
 *  - Flushes residual buffer after reader closes.
 *  - AbortError bubbles to caller (user cancel vs real error).
 */

export interface SSEEvent {
  text?: string
  done?: boolean
  error?: string
  progress?: boolean
  [key: string]: unknown
}

export interface ParseStreamOptions {
  onChunk: (chunk: string) => void
  onDone: (event: SSEEvent) => void
  onError: (message: string) => void
  signal?: AbortSignal
}

export async function parseStream(
  url: string,
  body: Record<string, unknown>,
  { onChunk, onDone, onError, signal }: ParseStreamOptions
): Promise<void> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err
    onError(err instanceof Error ? err.message : 'Error de conexión')
    return
  }

  if (!response.ok) {
    try {
      const payload = await response.json() as { error?: string }
      onError(payload?.error ?? `Error del servidor (${response.status})`)
    } catch {
      onError(`Error del servidor (${response.status})`)
    }
    return
  }

  if (!response.body) {
    onError('El servidor no devolvió un stream')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: false })
  let buffer = ''
  let doneEventReceived = false

  const processLine = (line: string): boolean => {
    const trimmed = line.replace(/\r$/, '')
    if (!trimmed.startsWith('data: ')) return false

    const data = trimmed.slice(6).trim()
    if (data === '[DONE]') return true

    let evt: SSEEvent
    try {
      evt = JSON.parse(data) as SSEEvent
    } catch {
      return false // incomplete JSON held in buffer — should not reach here
    }

    if (evt.error) {
      onError(evt.error as string)
      return true
    }
    if (evt.text) onChunk(evt.text as string)
    if (evt.done) {
      doneEventReceived = true
      onDone(evt)
      return true
    }
    return false // progress pulse — continue
  }

  try {
    outer: while (true) {
      const { done, value } = await reader.read()

      if (done) {
        buffer += decoder.decode() // flush pending UTF-8 bytes
        if (buffer.trim()) processLine(buffer)
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (processLine(line)) break outer
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err
    onError(err instanceof Error ? err.message : 'Error en el stream')
    return
  }

  if (!doneEventReceived) onDone({})
}
