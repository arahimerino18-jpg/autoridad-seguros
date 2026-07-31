'use client'

import { useState, useCallback, useRef } from 'react'
import type { ChannelId, ContentOutput } from '@/lib/content-studio/channel-registry'
import type { ModificationType } from '@/lib/content-studio/content-engine'

// ─── JSON extraction + minimal output helpers ────────────────────────────────
// Mirror of the server-side extractCleanJson — applied client-side when
// the API sends raw text instead of parsed_output (json_failed = true).

function extractCleanJsonClient(text: string): Record<string, unknown> | null {
  // Strip ```json ... ``` fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced?.[1]?.trim() ?? (() => {
    const s = text.indexOf('{'), e = text.lastIndexOf('}')
    return s !== -1 && e > s ? text.slice(s, e + 1) : text.trim()
  })()

  try {
    const parsed = JSON.parse(candidate)
    // Accept only if it looks like a content output (has at least one text field)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
  } catch { /* not valid JSON */ }
  return null
}

// Builds the minimum StaticPostOutput-compatible object from raw text.
// Used only when ALL JSON parsing attempts fail. Ensures the view,
// "Copiar todo", and "Guardar contenido" always have something to show.
function buildMinimalOutput(raw: string): Record<string, unknown> {
  return {
    hook: '',
    cuerpo: raw,
    cta: '',
    hashtags: { producto: [], audiencia: [], marca: [] },
  }
}


// ─── Types ────────────────────────────────────────────────────────────────────

export type GenerationStatus = 'idle' | 'generating' | 'modifying' | 'complete' | 'error'

export interface ComplianceIssue {
  category: string
  rule_id?: string
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  problematic_text: string
  explanation: string
  recommended_revision: string
  source: 'deterministic' | 'ai'
}

export interface ComplianceResult {
  // Phase 10 Engine fields
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  overall_summary: string
  detected_issues: ComplianceIssue[]
  requires_human_review: boolean
  product_context: string
  channel_context: string
  compliance_notes: string[]
  disclaimer: string
  ai_layer_used: boolean
  log_id?: string | null
  // Legacy fields (Phase 1-8 compat — may be absent in new responses)
  nivel?: 'verde' | 'amarillo' | 'rojo'
  score_riesgo?: number
  aprobado?: boolean
  problemas?: Array<{ tipo: string; descripcion: string; fragmento: string; sugerencia: string }>
  advertencias?: string[]
  nota_disclaimer?: string
}

export interface GenerationState {
  status: GenerationStatus
  rawStream: string              // Token-by-token stream (for display during generation)
  parsedOutput: ContentOutput | null   // Parsed JSON after complete
  compliance: ComplianceResult | null  // Compliance result (runs after generation)
  error: string | null
  channelId: ChannelId | null
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useContentGeneration() {
  const [state, setState] = useState<GenerationState>({
    status: 'idle',
    rawStream: '',
    parsedOutput: null,
    compliance: null,
    error: null,
    channelId: null,
  })

  const abortRef = useRef<AbortController | null>(null)

  // ── Core stream function ────────────────────────────────────────────────────

  const stream = useCallback(async (
    action: 'generate' | 'modify',
    params: Record<string, unknown>,
    channelId: ChannelId,
    options: { runCompliance?: boolean; producto?: string } = {}
  ) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const isModify = action === 'modify'

    setState({
      status: isModify ? 'modifying' : 'generating',
      rawStream: '',
      parsedOutput: null,
      compliance: null,
      error: null,
      channelId,
    })

    let fullText = ''
    let parsedOutput: ContentOutput | null = null

    try {
      const response = await fetch('/api/ai/content-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params: { ...params, channelId } }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json() as { error?: string }
        throw new Error(err?.error ?? `Error ${response.status}`)
      }

      const reader = response.body!.getReader()
      // UTF-8 aware decoder — stream:true holds incomplete multi-byte
      // sequences (e.g. split emojis or accented chars) across reads.
      const decoder = new TextDecoder('utf-8', { fatal: false })

      // Buffer persists across reader.read() calls.
      // Incomplete SSE lines (JSON split across TCP chunks) are held here
      // until the next read delivers the rest — never discarded.
      let buffer = ''

      // Inline helper — used both inside the loop and after it
      const processLines = (lines: string[]) => {
        for (const line of lines) {
          // Support both \n and \r\n line endings
          const trimmedLine = line.replace(/\r$/, '')
          if (!trimmedLine.startsWith('data: ')) continue
          const data = trimmedLine.slice(6).trim()
          if (data === '[DONE]') return true  // signal to break outer

          try {
            const parsed = JSON.parse(data) as {
              text?: string
              done?: boolean
              parsed_output?: ContentOutput
              raw?: string
              json_failed?: boolean
              error?: string
              fatal?: boolean
            }

            if (parsed.error) throw new Error(parsed.error)

            if (parsed.text) {
              fullText += parsed.text
              setState((prev) => ({ ...prev, rawStream: fullText }))
            }

            if (parsed.done) {
              if (parsed.parsed_output) {
                // Ideal path: server extracted valid JSON
                parsedOutput = parsed.parsed_output
              } else if (parsed.raw) {
                // Degraded path: server sent raw text (json_failed=true).
                // Try client-side extraction first (handles fences/preamble),
                // then fall back to a minimal StaticPostOutput-compatible object
                // so the view, "Copiar todo" and "Guardar" are never empty.
                const extracted = extractCleanJsonClient(parsed.raw)
                parsedOutput = (extracted ?? buildMinimalOutput(parsed.raw)) as unknown as ContentOutput
              }
            }
          } catch (e) {
            // SyntaxError here means genuinely malformed JSON on a complete line —
            // fragments are held in `buffer` by lines.pop() and never reach here.
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
        return false  // did not encounter [DONE]
      }

      outer: while (true) {
        const { done, value } = await reader.read()
        if (done) {
          // Flush any pending UTF-8 multi-byte sequences held by the decoder
          buffer += decoder.decode()
          // Process whatever remains in the buffer (last line may lack trailing \n)
          if (buffer.trim()) {
            processLines([buffer])
          }
          break
        }

        // Append decoded bytes to buffer — never lose bytes between reads
        buffer += decoder.decode(value, { stream: true })

        // Split on \n — \r is stripped inside processLines.
        // The last element may be an incomplete line — pop() holds it in buffer.
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        if (processLines(lines)) break outer
      }

      // Fallback: stream ended with text but no parsed_output event.
      // This can happen if the server closes the connection unexpectedly.
      // Use the same extraction path as the degraded route above.
      if (!parsedOutput && fullText) {
        const extracted = extractCleanJsonClient(fullText)
        parsedOutput = (extracted ?? buildMinimalOutput(fullText)) as unknown as ContentOutput
      }

      setState((prev) => ({
        ...prev,
        status: 'complete',
        parsedOutput,
      }))

      // Run compliance check after generation (not after modify)
      if (!isModify && options.runCompliance && parsedOutput && options.producto) {
        void runComplianceCheck(parsedOutput, channelId, options.producto)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setState((prev) => ({ ...prev, status: 'idle' }))
        return
      }
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Error al generar contenido',
      }))
    }
  }, [])

  // ── Generate ────────────────────────────────────────────────────────────────

  const generate = useCallback(async (params: {
    channelId: ChannelId
    tema: string
    producto: string
    objetivo: string
    tono_override?: string
    instruccion_extra?: string
    growth_output_id?: string
    contenido_origen_id?: string
  }) => {
    await stream('generate', params, params.channelId, {
      runCompliance: true,
      producto: params.producto,
    })
  }, [stream])

  // ── Modify (short pipeline) ─────────────────────────────────────────────────

  const modify = useCallback(async (
    modification: ModificationType,
    customInstruction?: string
  ) => {
    if (!state.parsedOutput || !state.channelId) return

    await stream('modify', {
      current_output: state.parsedOutput,
      modification,
      custom_instruction: customInstruction,
    }, state.channelId)
  }, [state.parsedOutput, state.channelId, stream])

  // ── Compliance check ────────────────────────────────────────────────────────

  const runComplianceCheck = useCallback(async (
    output: ContentOutput,
    channelId: ChannelId,
    producto: string
  ) => {
    try {
      // Extract text content from the structured output for compliance analysis
      const contenido = extractTextFromOutput(output)

      const response = await fetch('/api/ai/content-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'compliance',
          params: { contenido, producto, canal: channelId },
        }),
      })

      if (!response.ok) return

      const result = await response.json() as ComplianceResult
      setState((prev) => ({ ...prev, compliance: result }))
    } catch {
      // Compliance check failed silently — don't block the workflow
    }
  }, [])

  // ── Reset ───────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState({
      status: 'idle',
      rawStream: '',
      parsedOutput: null,
      compliance: null,
      error: null,
      channelId: null,
    })
  }, [])

  // ── Abort ───────────────────────────────────────────────────────────────────

  const abort = useCallback(() => {
    abortRef.current?.abort()
    setState((prev) => ({ ...prev, status: 'idle' }))
  }, [])

  return {
    state,
    generate,
    modify,
    reset,
    abort,
    isGenerating: state.status === 'generating',
    isModifying: state.status === 'modifying',
    isComplete: state.status === 'complete',
    hasOutput: !!state.parsedOutput,
  }
}

// ─── Helper: extract text for compliance ─────────────────────────────────────

function extractTextFromOutput(output: ContentOutput): string {
  const texts: string[] = []

  const traverse = (obj: unknown) => {
    if (typeof obj === 'string') { texts.push(obj); return }
    if (Array.isArray(obj)) { obj.forEach(traverse); return }
    if (obj && typeof obj === 'object') {
      Object.values(obj as Record<string, unknown>).forEach(traverse)
    }
  }

  traverse(output)
  return texts.join(' ').slice(0, 3000) // Max 3k chars for compliance check
}
