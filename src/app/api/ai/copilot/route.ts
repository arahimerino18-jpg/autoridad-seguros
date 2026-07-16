import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildCopilotContext } from '@/lib/growth-engine/context-builder'
import { getSystemPromptForMode } from '@/lib/growth-engine/prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Max tokens per mode ──────────────────────────────────────────────────────
const MAX_TOKENS: Record<string, number> = {
  estratega: 1200,
  analista: 1400,
  campana: 2000,
  posicionamiento: 1600,
  chat: 800,
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json() as {
    modo: string
    params?: Record<string, unknown>
    conversacion?: Array<{ role: string; content: string }>
    session_id?: string
  }

  const { modo, params = {}, conversacion = [], session_id } = body

  if (!['estratega', 'analista', 'campana', 'posicionamiento', 'chat'].includes(modo)) {
    return NextResponse.json({ error: 'Modo inválido' }, { status: 400 })
  }

  // Build context
  const { context, formatted: contextFormatted } = await buildCopilotContext(user.id)

  // Build user message
  const userMessage = buildUserMessage(modo, params, contextFormatted, conversacion)

  // Build conversation for Claude
  const messages = modo === 'chat' && conversacion.length > 0
    ? [
        // For chat mode: include conversation history (last 10 messages for token efficiency)
        ...conversacion.slice(-10).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: userMessage },
      ]
    : [{ role: 'user' as const, content: userMessage }]

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''
      let sessionSaved = false

      try {
        const claudeStream = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: MAX_TOKENS[modo] ?? 1200,
          system: getSystemPromptForMode(modo),
          messages,
        })

        for await (const chunk of claudeStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            fullText += chunk.delta.text
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`
              )
            )
          }
        }

        // Parse campaign JSON if in campana mode
        let campanaData: Record<string, unknown> | null = null
        if (modo === 'campana') {
          const jsonMatch = fullText.match(/---JSON_CAMPANA---\n([\s\S]*?)\n---FIN_JSON---/)
          if (jsonMatch) {
            try {
              campanaData = JSON.parse(jsonMatch[1]) as Record<string, unknown>
            } catch {
              // JSON parse failed
            }
          }
        }

        // Save session to DB
        if (!sessionSaved) {
          sessionSaved = true
          const newMessage = { role: 'assistant', content: fullText, timestamp: new Date().toISOString() }

          if (session_id) {
            // Update existing session
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('copilot_sessions') as any)
              .update({
                conversacion: [
                  ...conversacion,
                  newMessage,
                ],
                tokens_usados: fullText.length / 4, // rough estimate
              })
              .eq('id', session_id)
              .eq('user_id', user.id)
          } else {
            // Create new session
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('copilot_sessions') as any)
              .insert({
                user_id: user.id,
                modo,
                parametros_modo: params,
                conversacion: [newMessage],
                tokens_usados: fullText.length / 4,
              })
          }
        }

        // Send completion event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              done: true,
              campana_data: campanaData,
              context_layers: context.available_layers,
            })}\n\n`
          )
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error inesperado'
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

// ─── Build user message per mode ─────────────────────────────────────────────

function buildUserMessage(
  modo: string,
  params: Record<string, unknown>,
  contextFormatted: string,
  conversacion: Array<{ role: string; content: string }>
): string {
  const base = contextFormatted + '\n\n'

  switch (modo) {
    case 'estratega': {
      const horizonte = (params.horizonte as string) ?? 'semana'
      return base +
        `Analiza mi situación actual y dame las recomendaciones más importantes para ${
          horizonte === 'hoy' ? 'HOY' : horizonte === 'semana' ? 'ESTA SEMANA' : 'ESTE MES'
        }. Considera todo el contexto disponible: mi perfil, el calendario de seguros, mi historial, y mis objetivos.`
    }

    case 'analista': {
      const periodo = (params.periodo_dias as number) ?? 30
      return base +
        `Analiza mi actividad de los últimos ${periodo} días y dame un diagnóstico honesto: ¿qué está funcionando, qué no, qué me estoy perdiendo, y qué debo cambiar esta semana?`
    }

    case 'campana': {
      const { producto, duracion, objetivo, tiempo_diario_min } = params
      return base +
        `Diseña una campaña de marketing completa para mí con estas características:
- Producto: ${producto ?? 'Medicare'}
- Duración: ${duracion ?? '2_semanas'}
- Objetivo: ${objetivo ?? 'leads'}
- Tiempo disponible: ${tiempo_diario_min ?? 30} minutos por día

Incluye el calendario de contenido completo y el JSON de campaña al final.`
    }

    case 'posicionamiento': {
      const { nicho_objetivo, plazo_semanas } = params
      return base +
        `Diseña mi estrategia de posicionamiento y autoridad para ${
          nicho_objetivo ? `el nicho: ${nicho_objetivo}` : 'mi mercado objetivo principal'
        } en un horizonte de ${plazo_semanas ?? 4} semanas.`
    }

    case 'chat': {
      // For chat mode, the user message is the last message in the conversation
      const lastUserMsg = conversacion.filter((m) => m.role === 'user').pop()
      const question = lastUserMsg?.content ?? params.pregunta ?? '¿Qué me recomiendas?'
      // Context is prepended only on first message to save tokens
      const isFirstMessage = conversacion.length === 0
      return isFirstMessage
        ? base + `Mi pregunta: ${question}`
        : String(question)
    }

    default:
      return base + 'Dame tu análisis y recomendaciones.'
  }
}
