'use client'

import { useState, useCallback, useRef } from 'react'
import type { ChannelId, ContentOutput } from '@/lib/content-studio/channel-registry'
import type { ModificationType } from '@/lib/content-studio/content-engine'

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
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break

          try {
            const parsed = JSON.parse(data) as {
              text?: string
              done?: boolean
              parsed_output?: ContentOutput
              error?: string
            }

            if (parsed.error) throw new Error(parsed.error)

            if (parsed.text) {
              fullText += parsed.text
              setState((prev) => ({ ...prev, rawStream: fullText }))
            }

            if (parsed.done && parsed.parsed_output) {
              parsedOutput = parsed.parsed_output
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }

      // If JSON parse failed in the API (raw text), try client-side
      if (!parsedOutput && fullText) {
        try {
          parsedOutput = JSON.parse(fullText) as ContentOutput
        } catch {
          // Keep null — will show error state for JSON-required channels
        }
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
