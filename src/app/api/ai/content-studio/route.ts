import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { runContentEngine } from '@/lib/content-studio/content-engine'
import type { EngineParams } from '@/lib/content-studio/content-engine'
import type { ChannelId } from '@/lib/content-studio/channel-registry'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function getMaxTokensForChannel(channelId: string): number {
  const limits: Record<string, number> = {
    carousel: 2000, reel_script: 1800, tiktok_script: 1500,
    video_educativo: 3000, email_marketing: 2500, story: 800,
    whatsapp: 700, sms: 300,
  }
  return limits[channelId] ?? 1000
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json() as {
    action: 'generate' | 'modify' | 'compliance'
    params: Record<string, unknown>
  }

  const { action, params } = body

  // ── Compliance check (non-streaming) ─────────────────────────────────────
  if (action === 'compliance') {
    const { contenido, producto, canal, contenido_id, force_ai } = params as {
      contenido: string
      producto: string
      canal: string
      contenido_id?: string
      force_ai?: boolean
    }

    // Check usage limit for compliance
    const limit = await checkUsageLimit(user.id, 'compliance_center', supabase)
    if (!limit.allowed) {
      return NextResponse.json({
        error: `Límite de compliance alcanzado (${limit.used}/${limit.max}). Actualiza tu plan.`
      }, { status: 429 })
    }

    // Run Phase 10 Compliance Engine (hybrid deterministic + AI)
    const { runComplianceEngine } = await import('@/lib/compliance/engine')
    const result = await runComplianceEngine({ contenido, producto, canal, force_ai })

    // Save audit log to compliance_logs
    const client = supabase as unknown as import('@supabase/supabase-js').SupabaseClient
    const { data: logData } = await client.from('compliance_logs').insert({
      user_id:               user.id,
      contenido_id:          contenido_id ?? null,
      texto_revisado:        contenido,
      producto:              producto as import('@/types/database').InsuranceProduct,
      aprobado:              result.risk_level === 'LOW',
      score_riesgo:          result.risk_level === 'LOW' ? 20 : result.risk_level === 'MEDIUM' ? 60 : 90,
      problemas:             result.detected_issues,
      modelo_ia:             result.ai_layer_used ? 'claude-sonnet-4-6' : 'deterministic',
      risk_level:            result.risk_level,
      canal:                 canal,
      detected_issues:       result.detected_issues,
      requires_human_review: result.requires_human_review,
      overall_summary:       result.overall_summary,
      compliance_notes:      result.compliance_notes,
      content_source:        'content_studio',
    }).select('id').single()

    const logId = (logData as { id?: string } | null)?.id ?? null

    // Update contenido.compliance_revisado if we have a contenido_id
    if (contenido_id) {
      await client.from('contenidos')
        .update({ compliance_revisado: true, compliance_log_id: logId })
        .eq('id', contenido_id).eq('user_id', user.id)
    }

    // Log usage
    await logUsage(user.id, 'compliance_center', supabase)

    return NextResponse.json({ ...result, log_id: logId })
  }

  // ── Generate or Modify (streaming SSE) ───────────────────────────────────
  if (action === 'generate' || action === 'modify') {
    // Check content_studio usage limit
    const limit = await checkUsageLimit(user.id, 'content_studio', supabase)
    if (!limit.allowed) {
      return NextResponse.json({
        error: `Límite de generación alcanzado (${limit.used}/${limit.max}). Actualiza tu plan.`
      }, { status: 429 })
    }

    const engineParams: EngineParams = action === 'generate'
      ? {
          mode: 'generate',
          userId: user.id,
          channelId: params.channelId as ChannelId,
          tema: params.tema as string,
          producto: params.producto as string,
          objetivo: params.objetivo as 'educar' | 'conectar' | 'convertir' | 'retener',
          tono_override: params.tono_override as string | undefined,
          instruccion_extra: params.instruccion_extra as string | undefined,
          growth_output_id: params.growth_output_id as string | undefined,
          contenido_origen_id: params.contenido_origen_id as string | undefined,
        }
      : {
          mode: 'modify' as const,
          userId: user.id,
          channelId: params.channelId as ChannelId,
          current_output: params.current_output as unknown as import('@/lib/content-studio/channel-registry').ContentOutput,
          modification: params.modification as import('@/lib/content-studio/content-engine').ModificationType,
          custom_instruction: params.custom_instruction as string | undefined,
        }

    const encoder = new TextEncoder()
    let fullOutput = ''

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of runContentEngine(engineParams)) {
            fullOutput += chunk
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
            )
          }

          // Log usage after successful generation
          await logUsage(user.id, 'content_studio', supabase)

          // Try to parse JSON — with one silent retry if it fails
          let parsedOutput: Record<string, unknown> | null = null
          let jsonFailed = false

          try {
            parsedOutput = JSON.parse(fullOutput) as Record<string, unknown>
          } catch {
            // First parse failed — attempt a silent correction call
            try {
              const correctionResponse = await anthropic.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: getMaxTokensForChannel(params.channelId as string),
                system: 'Eres un corrector de JSON. Recibes texto que debería ser JSON válido pero tiene errores de formato. Devuelve ÚNICAMENTE el JSON corregido, sin texto adicional, sin markdown, sin explicaciones.',
                messages: [{
                  role: 'user',
                  content: `Corrige este JSON malformado y devuelve solo el JSON válido:\n\n${fullOutput}`
                }]
              })
              const correctedText = correctionResponse.content[0]?.type === 'text'
                ? correctionResponse.content[0].text.trim()
                : ''
              parsedOutput = JSON.parse(correctedText) as Record<string, unknown>
            } catch {
              // Both attempts failed — send raw text with degraded flag
              jsonFailed = true
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                parsed_output: parsedOutput,
                raw: jsonFailed ? fullOutput : undefined,
                json_failed: jsonFailed,
              })}\n\n`
            )
          )
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Error al generar contenido'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}

// ─── Usage limit check ────────────────────────────────────────────────────────

async function checkUsageLimit(
  userId: string,
  module: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ allowed: boolean; used: number; max: number }> {
  const period = new Date().toISOString().slice(0, 7) + '-01'

  // Get usage count
  const { count } = await supabase
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('modulo', module)
    .eq('periodo_mes', period)

  const used = count ?? 0

  // Get plan limit
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan_tier')
    .eq('id', userId)
    .single()

  const plan = (profile as Record<string, string> | null)?.plan_tier ?? 'starter'

  const { data: limits } = await supabase
    .from('plan_limits')
    .select('max_contenidos_mes, max_compliance_mes')
    .eq('plan', plan)
    .single()

  const planLimits = limits as Record<string, number> | null
  const max = module === 'compliance_center'
    ? (planLimits?.max_compliance_mes ?? 15)
    : (planLimits?.max_contenidos_mes ?? 30)

  if (max === -1) return { allowed: true, used, max: -1 }
  return { allowed: used < max, used, max }
}

// ─── Log usage ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logUsage(userId: string, module: string, supabase: any) {
  const period = new Date().toISOString().slice(0, 7) + '-01'
  await supabase.from('ai_usage').insert({
    user_id: userId,
    modulo: module,
    operacion: module === 'compliance_center' ? 'compliance_check' : 'content_generate',
    tokens_total: 0, // Updated async in Phase 13 with actual token counts
    costo_usd: 0,
    fue_cacheado: false,
    periodo_mes: period,
  })
}
