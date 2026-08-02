'use client'

import { useState, useCallback, useRef } from 'react'
import type { ChannelId, ContentOutput } from '@/lib/content-studio/channel-registry'
import type { ModificationType } from '@/lib/content-studio/content-engine'

// ─── Static post channel normalization ───────────────────────────────────────
// The AI may return different field names depending on the prompt iteration:
//   - {caption, hashtags:{categoria_1_tema, categoria_2_comunidad, categoria_3_valor}}
//   - {hook, cuerpo, cta, hashtags:{producto, audiencia, marca}}
// Both are valid server responses. This function normalizes any variant to the
// StaticPostOutput shape that preview-components.tsx expects.
// Applied ONLY to static post channels — other channel types are untouched.

const STATIC_POST_CHANNELS = new Set([
  'instagram_post', 'facebook_post', 'linkedin_post', 'nextdoor_post',
])

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return (v as unknown[]).filter(s => typeof s === 'string') as string[]
  return []
}

function normalizeStaticPost(raw: Record<string, unknown>): Record<string, unknown> {
  // ── Text fields ────────────────────────────────────────────────────────────
  // Prefer explicit hook/cuerpo/cta; fall back to splitting caption if absent.
  const hook   = typeof raw.hook   === 'string' ? raw.hook   : ''
  const cta    = typeof raw.cta    === 'string' ? raw.cta    : ''
  // Prefer a non-empty cuerpo; if blank, fall back to caption.
  // Claude sometimes returns {cuerpo:'', caption:'real text'} when the prompt
  // schema includes both fields — empty string must not win over a real value.
  const rawCuerpo  = typeof raw.cuerpo  === 'string' ? raw.cuerpo  : ''
  const rawCaption = typeof raw.caption === 'string' ? raw.caption : ''
  const cuerpo = rawCuerpo.trim() || rawCaption.trim() || ''

  const texto_imagen = typeof raw.texto_imagen === 'string' ? raw.texto_imagen : undefined
  const alt_text     = typeof raw.alt_text     === 'string' ? raw.alt_text     : undefined

  // ── Hashtags ───────────────────────────────────────────────────────────────
  // Accept both naming schemes; preserve original category arrays.
  // Also build a deduped flat list (not stored in the output object — used
  // only by preview-components internally via spread of the three arrays).
  let htProducto:  string[] = []
  let htAudiencia: string[] = []
  let htMarca:     string[] = []

  const rawHt = raw.hashtags
  if (rawHt && typeof rawHt === 'object' && !Array.isArray(rawHt)) {
    const ht = rawHt as Record<string, unknown>

    // Scheme A: {producto, audiencia, marca}
    if (Array.isArray(ht.producto) || Array.isArray(ht.audiencia) || Array.isArray(ht.marca)) {
      htProducto  = toStringArray(ht.producto)
      htAudiencia = toStringArray(ht.audiencia)
      htMarca     = toStringArray(ht.marca)
    } else {
      // Scheme B: {categoria_1_*, categoria_2_*, categoria_3_*} or any other keys
      const buckets = Object.values(ht)
        .filter(Array.isArray)
        .map(toStringArray)
      htProducto  = buckets[0] ?? []
      htAudiencia = buckets[1] ?? []
      htMarca     = buckets[2] ?? []
    }
  }

  return {
    hook,
    cuerpo,
    cta,
    hashtags: { producto: htProducto, audiencia: htAudiencia, marca: htMarca },
    ...(texto_imagen ? { texto_imagen } : {}),
    ...(alt_text     ? { alt_text }     : {}),
  }
}

// ─── JSON extraction + minimal output helpers ────────────────────────────────
// Mirror of the server-side extractCleanJson — applied client-side when
// the API sends raw text instead of parsed_output (json_failed = true).

function extractCleanJsonClient(text: string): Record<string, unknown> | null {
  // Step 1: strip ```json ... ``` or ``` ... ``` fences first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const source = fenced?.[1]?.trim() ?? text

  // Step 2: find the longest valid JSON object using a stack-based extractor.
  // We try every { as a potential start and keep the longest parseable result.
  // This handles: preamble text with stray braces, fenced blocks, postamble text.
  let candidate: string | null = null

  for (let startIdx = 0; startIdx < source.length; startIdx++) {
    if (source[startIdx] !== '{') continue

    let depth = 0
    let inString = false
    let escape = false

    for (let i = startIdx; i < source.length; i++) {
      const ch = source[i]
      if (escape)       { escape = false; continue }
      if (ch === '\\') { escape = true;  continue }
      if (ch === '"')   { inString = !inString; continue }
      if (inString)     continue

      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          const slice = source.slice(startIdx, i + 1)
          // Keep the longest valid JSON object found
          if (slice.length > (candidate?.length ?? 0)) {
            try {
              JSON.parse(slice) // validate
              candidate = slice
            } catch { /* not valid at this start — try next */ }
          }
          break
        }
      }
    }
  }

  if (!candidate) return null

  try {
    const parsed = JSON.parse(candidate)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch { /* malformed JSON — return null */ }
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
      // UTF-8-aware — stream:true retains incomplete multi-byte sequences
      // (split emojis, accented chars) between reads.
      const decoder = new TextDecoder('utf-8', { fatal: false })

      // Buffer persists across reader.read() calls so that JSON events
      // split across TCP chunks are reassembled before parsing.
      let buffer = ''

      outer: while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // Flush any UTF-8 bytes the decoder is still holding
          buffer += decoder.decode()
          break
        }

        buffer += decoder.decode(value, { stream: true })

        // Split on newlines. The last element may be an incomplete SSE line —
        // pop() puts it back into buffer so it is completed by the next read.
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const raw of lines) {
          const line = raw.replace(/\r$/, '') // handle \r\n endings
          if (!line.startsWith('data: ')) continue

          const data = line.slice(6).trim()
          if (data === '[DONE]') break outer

          try {
            const evt = JSON.parse(data) as {
              text?:          string
              done?:          boolean
              parsed_output?: ContentOutput
              raw?:           string
              json_failed?:   boolean
              error?:         string
              progress?:      boolean
            }

            if (evt.error) throw new Error(evt.error)

            // Accumulate streaming text (shown live during generation)
            if (evt.text) {
              fullText += evt.text
              setState((prev) => ({ ...prev, rawStream: fullText }))
            }

            // Server signals completion with the parsed JSON
            if (evt.done) {
              if (evt.parsed_output) {
                parsedOutput = evt.parsed_output
              } else if (evt.raw) {
                // Server failed to parse — attempt client-side extraction
                parsedOutput = (extractCleanJsonClient(evt.raw) ?? buildMinimalOutput(evt.raw)) as unknown as ContentOutput
              }
              // parsed_output and raw both absent: fall through to fullText fallback below
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue // incomplete fragment — skip, not a crash
            throw e
          }
        }
      }

      // Process any bytes remaining in the buffer after the loop ends
      if (buffer.trim()) {
        const line = buffer.replace(/\r$/, '')
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data !== '[DONE]') {
            try {
              const evt = JSON.parse(data) as { done?: boolean; parsed_output?: ContentOutput; raw?: string; text?: string }
              if (evt.text) fullText += evt.text
              if (evt.done && evt.parsed_output) parsedOutput = evt.parsed_output
              else if (evt.done && evt.raw) {
                parsedOutput = (extractCleanJsonClient(evt.raw) ?? buildMinimalOutput(evt.raw)) as unknown as ContentOutput
              }
            } catch { /* incomplete final line — ignore */ }
          }
        }
      }

      // Fallback: stream closed without a done event (unexpected disconnect).
      // fullText contains all the text chunks Claude emitted.
      // Try to parse it as JSON before wrapping as minimal output.
      if (!parsedOutput && fullText) {
        parsedOutput = (extractCleanJsonClient(fullText) ?? buildMinimalOutput(fullText)) as unknown as ContentOutput
      }

      // Normalize static post channels to the shape StaticPostOutput expects.
      // Other channel types (carousel, story, reel, whatsapp…) are untouched.
      if (parsedOutput && STATIC_POST_CHANNELS.has(channelId)) {
        parsedOutput = normalizeStaticPost(
          parsedOutput as unknown as Record<string, unknown>
        ) as unknown as ContentOutput
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
